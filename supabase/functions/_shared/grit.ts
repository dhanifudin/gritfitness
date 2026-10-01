// Shared helpers for the grit-* Edge Functions (grit-auth, grit-refresh). Underscore-prefixed folders
// are not deployed as their own function by the Supabase CLI; this one is bundled into each caller.
//
// Covers: CORS, HS256 JWT signing for the short-lived Supabase access token, and a thin PostgREST client
// against the service-role key for schema grit's internal bookkeeping table (grit.member_sessions) —
// that table is never exposed to the browser (no grant to grit_member/anon/authenticated; see
// grit_006_sessions.sql), so only these two functions can ever read or write it.

export const DEFAULT_ORIGINS = ['https://grit.ulfillah.com', 'http://localhost:5173', 'http://127.0.0.1:4173']

export function resolveAllowedOrigins(): Set<string> {
  return new Set([
    ...DEFAULT_ORIGINS,
    ...(Deno.env.get('GRIT_ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  ])
}

const enc = new TextEncoder()

export function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? enc.encode(data) : new Uint8Array(data)
  let s = ''
  for (const byte of bytes) s += String.fromCharCode(byte)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${body}`))
  return `${head}.${body}.${b64url(sig)}`
}

export function cors(origin: string | null, allowed: Set<string>): Record<string, string> {
  const ok = origin && allowed.has(origin) ? origin : ''
  return {
    ...(ok ? { 'Access-Control-Allow-Origin': ok, Vary: 'Origin' } : { Vary: 'Origin' }),
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
  }
}

export function json(body: unknown, status: number, origin: string | null, allowed: Set<string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin, allowed) },
  })
}

/** SHA-256 of a UTF-8 string, as lowercase hex. Only the hash of a grit session token is ever stored. */
export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(s))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** A random 256-bit opaque token, base64url-encoded. High enough entropy that guessing is infeasible. */
export function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return b64url(bytes.buffer)
}

export const ACCESS_TTL_SECONDS = 60 * 60 // Supabase access JWT lifetime
export const SESSION_TTL_SECONDS = 60 * 24 * 60 * 60 // grit session (refresh token) lifetime: 60 days

/** PostgREST against schema grit, authenticated with the service-role key (bypasses RLS). */
async function gritServiceRequest(path: string, init: { method: string; body?: unknown; prefer?: string }): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('service role not configured')
  return fetch(`${url}/rest/v1/${path}`, {
    method: init.method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Accept-Profile': 'grit',
      'Content-Profile': 'grit',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

/** Mint a 1 h Supabase access JWT for this member (role grit_member, RLS-scoped to their own rows). */
export async function mintAccessToken(memberId: number, secret: string): Promise<{ token: string; expires_at: number }> {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + ACCESS_TTL_SECONDS
  const token = await signJwt(
    { iss: 'grit-auth', aud: 'authenticated', role: 'grit_member', sub: `grit:${memberId}`, grit_member_id: memberId, iat: now, exp },
    secret,
  )
  return { token, expires_at: exp }
}

/** Issue a new grit session for this member. Only the SHA-256 hash of the token is persisted. */
export async function createSession(memberId: number): Promise<{ refresh_token: string; refresh_expires_at: number }> {
  const token = randomToken()
  const hash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
  const res = await gritServiceRequest('member_sessions', {
    method: 'POST',
    body: { member_id: memberId, token_hash: hash, expires_at: expiresAt.toISOString() },
    prefer: 'return=minimal',
  })
  if (!res.ok) throw new Error(`createSession failed: ${res.status}`)
  return { refresh_token: token, refresh_expires_at: Math.floor(expiresAt.getTime() / 1000) }
}

export interface SessionRow {
  id: string
  member_id: number
  expires_at: string
  revoked_at: string | null
}

/** Look up a session by the hash of its plaintext token. Expired or revoked rows are treated as absent. */
export async function findSessionByHash(hash: string): Promise<SessionRow | null> {
  const res = await gritServiceRequest(`member_sessions?token_hash=eq.${hash}&select=id,member_id,expires_at,revoked_at`, { method: 'GET' })
  if (!res.ok) return null
  const rows = (await res.json()) as SessionRow[]
  const row = rows[0]
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) return null
  return row
}

export async function revokeSessionById(id: string): Promise<void> {
  const res = await gritServiceRequest(`member_sessions?id=eq.${id}`, {
    method: 'PATCH',
    body: { revoked_at: new Date().toISOString() },
    prefer: 'return=minimal',
  })
  if (!res.ok) throw new Error(`revokeSessionById failed: ${res.status}`)
}
