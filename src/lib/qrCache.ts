// Last successfully fetched check-in QR payloads, kept independent of the login session so the
// member can still show them at the gym door offline. The new API rotates the membership QR
// payload daily ("member|membership|YYYY-MM-DD|hash"), so a cached payload is only certainly
// valid on its own `tanggal` day — past that the QR view shows it with a staleness warning
// rather than dropping it (the door scanner may still accept it; better than nothing offline).
import type { ActiveMembership, MyClassDetail } from '@/api/types'

export interface QrEntry {
  payload: string
  /** the day the payload was issued for, YYYY-MM-DD */
  tanggal: string
  tier: string
  aktif_sampai: string // preformatted label
  /** end of the membership's last day, for the "sisa N hari" chip */
  expiresAt: number | null
  savedAt: number
}

export interface ClassQrEntry {
  schedule_id: number
  nama: string
  tanggal_label: string
  /** YYYY-MM-DD of the class day when derivable, else null (entry kept until shown stale) */
  day: string | null
  jam_mulai: string
  jam_selesai: string
  payload: string
  savedAt: number
}

interface Store {
  userId: number
  nama: string
  gym?: QrEntry
  classes?: ClassQrEntry[]
}

const KEY = 'grit.qr.v2'

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6,
  agu: 7, agt: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
}

/** End of the given day (local time) in ms, or null when the format is unknown.
 *  Accepts "29 Mar 2027", "Sabtu, 10 Okt 2026", "10/10/2026" and "2026-10-10". */
export function parseExpiry(s: string | null | undefined): number | null {
  const t = s?.trim().replace(/^[A-Za-z]+,\s*/, '')
  if (!t) return null
  let y: number, mo: number, d: number
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/)
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

/** Local YYYY-MM-DD. */
export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function load(): Store | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

function persist(s: Store | null) {
  try {
    if (!s || (!s.gym && !s.classes?.length)) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* best effort */
  }
}

/** Drops entries that can never be shown again (membership over, class day past). */
function fresh(): Store | null {
  const s = load()
  if (!s) return null
  let changed = false
  if (s.gym && s.gym.expiresAt !== null && Date.now() > s.gym.expiresAt) {
    delete s.gym
    changed = true
  }
  const today = localDay()
  const kept = (s.classes ?? []).filter((c) => c.payload && (c.day === null || c.day >= today))
  if (kept.length !== (s.classes?.length ?? 0)) {
    s.classes = kept
    changed = true
  }
  if (changed) persist(s)
  return s.gym || s.classes?.length ? s : null
}

export const loadQr = (): QrEntry | null => fresh()?.gym ?? null
export const cachedQrOwner = () => {
  const s = fresh()
  return s ? { userId: s.userId, nama: s.nama } : null
}
export const hasValidQr = () => !!fresh()

/** The cached membership QR is from an earlier day: it may no longer scan. */
export const qrStale = (e: Pick<QrEntry, 'tanggal'>, now = new Date()) => e.tanggal !== localDay(now)

function owned(user: { id: number; nama: string }): Store {
  let s = load()
  if (!s || s.userId !== user.id) s = { userId: user.id, nama: user.nama }
  s.nama = user.nama
  return s
}

/** Apply a successful /membership/active answer: aktif saves/updates, inactive removes. */
export function syncQr(user: { id: number; nama: string }, m: ActiveMembership) {
  const s = owned(user)
  if (m.aktif && m.qr_absensi && m.membership) {
    s.gym = {
      payload: m.qr_absensi,
      tanggal: m.tanggal ?? localDay(),
      tier: m.membership.tier,
      aktif_sampai: m.membership.aktif_sampai,
      expiresAt: parseExpiry(m.membership.aktif_sampai),
      savedAt: Date.now(),
    }
  } else {
    delete s.gym
  }
  persist(s)
}

/** Whole calendar days until the membership's last day: 0 = ends today, null = no known end date. */
export function daysLeft(e: Pick<QrEntry, 'expiresAt'>, now = Date.now()): number | null {
  if (e.expiresAt === null) return null
  const day = (t: number) => new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime()
  return Math.max(0, Math.round((day(e.expiresAt) - day(now)) / 86_400_000))
}

/** Save/update one upcoming class's QR from its detail answer (no payload = remove). */
export function syncClassQr(user: { id: number; nama: string }, scheduleId: number, d: MyClassDetail) {
  const s = owned(user)
  const classes = (s.classes ?? []).filter((c) => c.schedule_id !== scheduleId)
  if (d.upcoming && d.qr_absensi) {
    const exp = parseExpiry(d.kelas.tanggal)
    classes.push({
      schedule_id: scheduleId,
      nama: d.kelas.nama,
      tanggal_label: d.kelas.tanggal_label || d.kelas.tanggal,
      day: exp === null ? null : localDay(new Date(exp)),
      jam_mulai: d.kelas.jam_mulai,
      jam_selesai: d.kelas.jam_selesai,
      payload: d.qr_absensi,
      savedAt: Date.now(),
    })
  }
  s.classes = classes.sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || a.jam_mulai.localeCompare(b.jam_mulai))
  persist(s)
}

/** Drop cached class QRs whose schedule_id is no longer among the upcoming bookings. */
export function pruneClassQrs(user: { id: number; nama: string }, upcomingIds: number[]) {
  const s = owned(user)
  const keep = new Set(upcomingIds)
  s.classes = (s.classes ?? []).filter((c) => keep.has(c.schedule_id))
  persist(s)
}

export const loadClassQrs = (): ClassQrEntry[] => fresh()?.classes ?? []

/** The QR to open with at the gym door: a booked class running now-ish (2h before start until it
 *  ends, today) beats the membership QR. */
export function preselectQr(classes: Pick<ClassQrEntry, 'schedule_id' | 'day' | 'jam_mulai' | 'jam_selesai'>[], now = new Date()): string | null {
  const today = localDay(now)
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const cur = now.getHours() * 60 + now.getMinutes()
  const hit = classes.find((c) => c.day === today && cur >= minutes(c.jam_mulai) - 120 && cur <= minutes(c.jam_selesai))
  return hit ? 'c' + hit.schedule_id : null
}

export const clearQr = () => {
  localStorage.removeItem(KEY)
  localStorage.removeItem('grit.qr.v1') // pre-migration cache (base64 SVGs from the old API)
}
