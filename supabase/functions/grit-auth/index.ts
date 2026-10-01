// grit-auth: exchanges a valid GritFitness (gym) bearer token for a short-lived Supabase JWT that RLS in
// schema "grit" understands.
//
//   POST /functions/v1/grit-auth      Authorization: Bearer <gym token>
//   -> 200 { token, expires_at, member_id }     (token: role "grit_member", claim grit_member_id)
//   -> 401 { error } when the gym rejects the token
//
// The gym API is the only source of identity: we call its /validate-token and trust nothing from the client.
// Secrets (set with `supabase secrets set`; names are grit-prefixed because secrets are shared project-wide):
//   GRIT_JWT_SECRET       the project's JWT secret (Settings > API > JWT), used to sign the token
//   GRIT_ALLOWED_ORIGINS  optional, comma separated, extends the default CORS allow-list

const GYM_API = 'https://gritfitness.id/api'
const TOKEN_TTL_SECONDS = 60 * 60
const DEFAULT_ORIGINS = ['https://grit.ulfillah.com', 'http://localhost:5173', 'http://127.0.0.1:4173']

const allowedOrigins = new Set([
  ...DEFAULT_ORIGINS,
  ...(Deno.env.get('GRIT_ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
])

const enc = new TextEncoder()
const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? enc.encode(data) : new Uint8Array(data)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${head}.${body}`))
  return `${head}.${body}.${b64url(sig)}`
}

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && allowedOrigins.has(origin) ? origin : ''
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed, Vary: 'Origin' } : { Vary: 'Origin' }),
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
  }
}

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin) },
  })

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin)

  const secret = Deno.env.get('GRIT_JWT_SECRET')
  if (!secret) return json({ error: 'server not configured' }, 500, origin)

  const auth = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S{20,}$/.test(auth)) return json({ error: 'missing gym token' }, 401, origin)

  let gym: { isValid?: boolean; user?: { id?: unknown } }
  try {
    const res = await fetch(`${GYM_API}/validate-token`, {
      headers: { Authorization: auth, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401 || res.status === 403) return json({ error: 'invalid gym token' }, 401, origin)
    if (!res.ok) return json({ error: 'gym service unavailable' }, 502, origin)
    gym = await res.json()
  } catch {
    return json({ error: 'gym service unavailable' }, 502, origin)
  }

  const memberId = Number(gym.user?.id)
  if (!gym.isValid || !Number.isSafeInteger(memberId) || memberId <= 0) return json({ error: 'invalid gym token' }, 401, origin)

  const now = Math.floor(Date.now() / 1000)
  const exp = now + TOKEN_TTL_SECONDS
  const token = await signJwt(
    { iss: 'grit-auth', aud: 'authenticated', role: 'grit_member', sub: `grit:${memberId}`, grit_member_id: memberId, iat: now, exp },
    secret,
  )
  return json({ token, expires_at: exp, member_id: memberId }, 200, origin)
})
