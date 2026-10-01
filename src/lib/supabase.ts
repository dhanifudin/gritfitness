// Minimal PostgREST client for the "grit" schema on the shared Supabase project (no SDK dependency).
//
// Two credentials, in order of preference:
//  1. A "grit session" (opaque, 60-day refresh token) minted once by grit-auth, then refreshed on its
//     own via grit-refresh — this works even when the gym's own 5-hour bearer token has expired, since
//     the gym has no refresh mechanism of its own and the tracker's data is a separate, lower-stakes
//     concern from the gym account.
//  2. Falling back to the gym's bearer token via grit-auth, which also mints a fresh grit session for
//     next time — used when there is no stored session yet, or the stored one was rejected.
// Either way the resulting access JWT (role grit_member, claim grit_member_id) is what Row Level Security
// in schema "grit" understands. See docs/grit-supabase.md.
import { getToken } from '@/api/client'
import { CONFLICT, type Table } from './trackerData'

const URL_BASE = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/+$/, '')
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

export const trackerConfigured = !!URL_BASE && !!ANON_KEY

export class SyncError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// ---- grit session (refresh token), stored per member -----------------------------------------------
interface Session {
  refresh_token: string
  refresh_expires_at: number
}
const sessionKey = (memberId: number) => `grit.rt.${memberId}`

function loadSession(memberId: number): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(sessionKey(memberId)) ?? 'null') as Session | null
    return s && s.refresh_expires_at * 1000 > Date.now() ? s : null
  } catch {
    return null
  }
}
function saveSession(memberId: number, refresh_token?: string, refresh_expires_at?: number) {
  if (!refresh_token || !refresh_expires_at) return
  try {
    localStorage.setItem(sessionKey(memberId), JSON.stringify({ refresh_token, refresh_expires_at }))
  } catch {
    /* best effort */
  }
}
function clearSession(memberId: number) {
  try {
    localStorage.removeItem(sessionKey(memberId))
  } catch {
    /* best effort */
  }
}

/** Does this member have a usable credential to sync with — a live gym token, or a stored grit session? */
export function hasSyncCredential(memberId: number | null): boolean {
  return !!getToken() || (memberId != null && !!loadSession(memberId))
}

// ---- active member + access-token cache ------------------------------------------------------------
let activeMemberId: number | null = null
let cached: { token: string; exp: number } | null = null

/** Called by the tracker store whenever the active member changes (including to/from null). */
export function setActiveMember(memberId: number | null) {
  if (memberId === activeMemberId) return
  activeMemberId = memberId
  cached = null // the cached access token belongs to the previous member: never reuse it across a switch
}

export const dropTrackerToken = () => (cached = null)

// Single-flight: pull() fires several requests in parallel, and with no cached token yet they would
// otherwise each independently race to mint one. Racing is actively harmful for the session path (not
// just wasteful): grit-refresh ROTATES the token on every use, so the first racer's rotation invalidates
// the copy the others already read, and each of those then wrongly falls back to grit-auth. Concurrent
// callers instead await the one in-flight mint.
let minting: Promise<string> | null = null

/** Best-effort server-side revoke of this member's stored grit session (logout, or switching members). */
export async function revokeTrackerSession(memberId: number | null) {
  if (memberId == null) return
  const s = loadSession(memberId)
  clearSession(memberId)
  if (!s || !trackerConfigured) return
  try {
    await fetch(`${URL_BASE}/functions/v1/grit-refresh`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token, revoke: true }),
    })
  } catch {
    /* best effort: the local copy is already gone either way */
  }
}

async function trackerToken(): Promise<string> {
  const now = Date.now() / 1000
  if (cached && cached.exp - 60 > now) return cached.token
  if (minting) return minting
  minting = mintTrackerToken()
  try {
    return await minting
  } finally {
    minting = null
  }
}

async function mintTrackerToken(): Promise<string> {
  // 1. a stored grit session works on its own, with no gym session required
  const stored = activeMemberId != null ? loadSession(activeMemberId) : null
  if (stored) {
    try {
      const res = await fetch(`${URL_BASE}/functions/v1/grit-refresh`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: stored.refresh_token }),
      })
      const body = (await res.json().catch(() => null)) as
        | { token?: string; expires_at?: number; refresh_token?: string; refresh_expires_at?: number; error?: string }
        | null
      if (res.ok && body?.token && body.expires_at) {
        cached = { token: body.token, exp: body.expires_at }
        if (activeMemberId != null) saveSession(activeMemberId, body.refresh_token, body.refresh_expires_at)
        return body.token
      }
      if (res.status === 401 && activeMemberId != null) clearSession(activeMemberId) // expired/revoked: fall through
    } catch {
      // network error: fall through to the gym-token path (which will also fail if we're truly offline)
    }
  }

  // 2. fall back to minting via the gym's own bearer token (requires a live gym session)
  const gym = getToken()
  if (!gym) throw new SyncError(401, 'no gym session and no saved grit session')
  const res = await fetch(`${URL_BASE}/functions/v1/grit-auth`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${gym}` } })
  const body = (await res.json().catch(() => null)) as
    | { token?: string; expires_at?: number; refresh_token?: string; refresh_expires_at?: number; error?: string }
    | null
  if (!res.ok || !body?.token || !body.expires_at) throw new SyncError(res.status, body?.error ?? `grit-auth ${res.status}`)
  cached = { token: body.token, exp: body.expires_at }
  if (activeMemberId != null) saveSession(activeMemberId, body.refresh_token, body.refresh_expires_at)
  return body.token
}

async function request(path: string, init: { method: string; body?: unknown; prefer?: string }, retry = true): Promise<Response> {
  const token = await trackerToken()
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method: init.method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Accept-Profile': 'grit',
      'Content-Profile': 'grit',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (res.status === 401 && retry) {
    dropTrackerToken() // expired or rotated secret: mint a new one once
    return request(path, init, false)
  }
  if (!res.ok) throw new SyncError(res.status, `${init.method} ${path.split('?')[0]} -> ${res.status}`)
  return res
}

export const remote = {
  async select<T>(table: Table, query: string): Promise<T[]> {
    const res = await request(`${table}?${query}`, { method: 'GET' })
    return (await res.json()) as T[]
  },
  async upsert(table: Table, row: Record<string, unknown>): Promise<void> {
    await request(`${table}?on_conflict=${CONFLICT[table]}`, { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal' })
  },
  async remove(table: Table, column: string, value: string): Promise<void> {
    await request(`${table}?${column}=eq.${encodeURIComponent(value)}`, { method: 'DELETE', prefer: 'return=minimal' })
  },
}
