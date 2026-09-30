// Per-user stale-while-revalidate cache. Synchronous (localStorage) so screens can paint
// cached data on the very first frame. Keys are namespaced by user id, so one account's
// data is never shown to another on a shared device.
const PREFIX = 'grit.c.'

export interface Cached<T> {
  data: T
  savedAt: number
}

function uid(): number | null {
  try {
    return JSON.parse(localStorage.getItem('grit.user') ?? 'null')?.id ?? null
  } catch {
    return null
  }
}

const fullKey = (key: string) => {
  const u = uid()
  return u ? `${PREFIX}${u}.${key}` : null
}

export function read<T>(key: string): Cached<T> | null {
  const k = fullKey(key)
  if (!k) return null
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as Cached<T>) : null
  } catch {
    return null
  }
}

function prune(count: number) {
  const rows: { k: string; at: number }[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith(PREFIX)) continue
    let at = 0
    try {
      at = JSON.parse(localStorage.getItem(k) ?? '{}').savedAt ?? 0
    } catch {
      /* corrupt entry: oldest */
    }
    rows.push({ k, at })
  }
  rows.sort((a, b) => a.at - b.at).slice(0, count).forEach((r) => localStorage.removeItem(r.k))
}

export function write<T>(key: string, data: T): number {
  const k = fullKey(key)
  const savedAt = Date.now()
  if (!k) return savedAt
  const value = JSON.stringify({ data, savedAt })
  try {
    localStorage.setItem(k, value)
  } catch {
    try {
      prune(8) // quota: drop the oldest entries and retry once
      localStorage.setItem(k, value)
    } catch {
      /* cache is best-effort */
    }
  }
  return savedAt
}

/** Remove every cached entry of the current user whose key starts with `prefix`. */
export function invalidate(prefix: string) {
  const start = fullKey(prefix)
  if (!start) return
  const doomed: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(start)) doomed.push(k)
  }
  doomed.forEach((k) => localStorage.removeItem(k))
}

export function clearAll() {
  const doomed: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(PREFIX)) doomed.push(k)
  }
  doomed.forEach((k) => localStorage.removeItem(k))
}

/** Cache keys shared by views and the prefetcher. */
export const CK = {
  memberGym: 'home/member',
  memberPt: 'home/memberpt',
  classes: 'classes',
  classDetail: (id: string | number) => `classes/${id}`,
  bills: 'bills',
  billDetail: (id: string | number) => `bills/${id}`,
  packages: (tab: string) => `packages/${tab}`,
  packageDetail: (tab: string, id: string | number) => `packages/${tab}/${id}`,
  memberships: 'memberships',
  membershipDetail: (id: string | number) => `memberships/${id}`,
  leave: 'leave',
}
