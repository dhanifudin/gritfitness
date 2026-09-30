// Last successfully fetched check-in QR, kept independent of the login session so the member
// can still show it after the (5 h) token expires. The QR is static per membership, so it stays
// valid until the membership's end date; each entry is dropped once that day is over.
import type { ActiveMember } from '@/api/types'

export type QrKind = 'gym' | 'pt'

export interface QrEntry {
  nama_paket: string
  qr_code: string // base64 SVG
  tanggal_mulai: string
  tanggal_selesai: string
  expiresAt: number | null
  savedAt: number
}
interface Store {
  userId: number
  nama: string
  entries: Partial<Record<QrKind, QrEntry>>
}

const KEY = 'grit.qr.v1'

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6,
  agu: 7, agt: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
}

/** End of the given day (local time) in ms, or null when the format is unknown. */
export function parseExpiry(s: string | null | undefined): number | null {
  const t = s?.trim()
  if (!t) return null
  let y: number, mo: number, d: number
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/) // 29 Mar 2027 / 30 Des 2026
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] !== undefined) {
    ;[d, mo, y] = [+m[1], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[3]]
  } else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    ;[d, mo, y] = [+m[1], +m[2] - 1, +m[3]]
  } else if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    ;[y, mo, d] = [+m[1], +m[2] - 1, +m[3]]
  } else {
    return null
  }
  return new Date(y, mo, d, 23, 59, 59, 999).getTime()
}

function load(): Store | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

function persist(s: Store | null) {
  try {
    if (!s || !Object.keys(s.entries).length) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* best effort */
  }
}

/** Drops expired entries as a side effect. */
function fresh(): Store | null {
  const s = load()
  if (!s) return null
  let changed = false
  for (const k of Object.keys(s.entries) as QrKind[]) {
    const e = s.entries[k]
    if (!e?.qr_code || (e.expiresAt !== null && Date.now() > e.expiresAt)) {
      delete s.entries[k]
      changed = true
    }
  }
  if (changed) persist(s)
  return Object.keys(s.entries).length ? s : null
}

export const loadQr = (kind: QrKind): QrEntry | null => fresh()?.entries[kind] ?? null
export const cachedQrOwner = () => {
  const s = fresh()
  return s ? { userId: s.userId, nama: s.nama } : null
}
export const hasValidQr = () => !!fresh()

export function saveQr(user: { id: number; nama: string }, kind: QrKind, m: ActiveMember) {
  let s = load()
  if (!s || s.userId !== user.id) s = { userId: user.id, nama: user.nama, entries: {} }
  s.nama = user.nama
  s.entries[kind] = {
    nama_paket: m.nama_paket,
    qr_code: m.qr_code,
    tanggal_mulai: m.tanggal_mulai,
    tanggal_selesai: m.tanggal_selesai,
    expiresAt: parseExpiry(m.tanggal_selesai),
    savedAt: Date.now(),
  }
  persist(s)
}

export function removeQr(kind: QrKind) {
  const s = load()
  if (!s) return
  delete s.entries[kind]
  persist(s)
}

/**
 * Apply a successful server answer: a QR updates the cache, an {error} (leave, no active package)
 * removes it. Network/401 failures never reach this, so they never delete anything.
 */
export function syncQr(user: { id: number; nama: string }, kind: QrKind, m: ActiveMember) {
  if (m.error || !m.qr_code) removeQr(kind)
  else saveQr(user, kind, m)
}

/** Whole calendar days until the membership's last day: 0 = ends today, null = no known end date. */
export function daysLeft(e: Pick<QrEntry, 'expiresAt'>, now = Date.now()): number | null {
  if (e.expiresAt === null) return null
  const day = (t: number) => new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime()
  return Math.max(0, Math.round((day(e.expiresAt) - day(now)) / 86_400_000))
}

export const clearQr = () => localStorage.removeItem(KEY)
