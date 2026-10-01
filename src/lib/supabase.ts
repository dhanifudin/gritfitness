// Minimal PostgREST client for the "grit" schema on the shared Supabase project (no SDK dependency).
// Identity: the gym's bearer token is exchanged by the `grit-auth` Edge Function for a short-lived Supabase JWT
// (role grit_member, claim grit_member_id) that Row Level Security understands. See docs/grit-supabase.md.
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

let cached: { token: string; exp: number } | null = null
export const dropTrackerToken = () => (cached = null)

async function trackerToken(): Promise<string> {
  const now = Date.now() / 1000
  if (cached && cached.exp - 60 > now) return cached.token
  const gym = getToken()
  if (!gym) throw new SyncError(401, 'no gym session')
  const res = await fetch(`${URL_BASE}/functions/v1/grit-auth`, { method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${gym}` } })
  const body = (await res.json().catch(() => null)) as { token?: string; expires_at?: number; error?: string } | null
  if (!res.ok || !body?.token || !body.expires_at) throw new SyncError(res.status, body?.error ?? `grit-auth ${res.status}`)
  cached = { token: body.token, exp: body.expires_at }
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
