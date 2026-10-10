// Weekly class timetable: real rows from the API (today only) merged with the recurring timetable
// inferred from past schedules (src/data/timetable.json, built by scripts/build-timetable.mjs).
// Pure functions (no Vue, no I/O) so they can be unit-tested with plain Node.

export interface Slot {
  wd: number // Monday = 0
  start: string // HH:MM
  end: string
  name: string
  kelas: string
  instructor: string | null
  packageId: number | null
  weeks: number
}

/** Subset of the API's jadwal-kelas row this module needs. */
export interface ActualClass {
  id: number
  id_paket_kelas?: number
  nama_jadwal_kelas: string
  nama_kelas: string
  instruktur: string | null
  tanggal: string // DD/MM/YYYY
  jam_awal: string
  jam_akhir: string
  maksimal_member: number
  peserta: number
  foto_url?: string
  /** "Peserta" | "Waiting List" | "Tidak Terdaftar" — the member's own status on this row */
  status_saya?: string
}

export type DayStatus = 'confirmed' | 'predicted' | 'ended'

export interface DayItem {
  key: string
  status: DayStatus
  /** the member's own registration on a real row */
  mine?: 'peserta' | 'waiting' | null
  start: string
  end: string
  name: string
  kelas: string
  instructor: string | null
  packageId: number | null
  classId?: number
  peserta?: number
  max?: number
  fotoUrl?: string
}

export function mineOf(statusSaya: string | null | undefined): 'peserta' | 'waiting' | null {
  const s = (statusSaya ?? '').toLowerCase()
  if (s.includes('peserta')) return 'peserta'
  if (s.includes('waiting')) return 'waiting'
  return null
}

export const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const weekdayOf = (d: Date) => (d.getDay() + 6) % 7 // Mon = 0
export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function parseDmy(s: string): Date {
  const [d, m, y] = s.split('/').map(Number)
  return new Date(y, m - 1, d)
}

/** The 7 local dates Mon..Sun of the current week shifted by `offset` weeks. */
export function weekDates(offset = 0, today = new Date()): Date[] {
  const monday = addDays(startOfDay(today), -weekdayOf(today))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, 7 * offset + i))
}

/** "28 Sep – 4 Okt" */
export function weekLabel(dates: Date[]): string {
  const f = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return `${f(dates[0])} – ${f(dates[6])}`
}

/**
 * Classes of one day. Real rows are `confirmed`; recurring-timetable slots fill the rest as
 * `predicted` (future) or `ended` (already past). A predicted slot is dropped when a real row
 * starts at the same time, because the real row supersedes it.
 */
export function mergeDay(date: Date, actual: ActualClass[], slots: Slot[], now = new Date()): DayItem[] {
  const today = startOfDay(now)
  const day = startOfDay(date)
  const isPast = day < today
  const isToday = day.getTime() === today.getTime()

  const real = actual.filter((a) => sameDay(parseDmy(a.tanggal), date))
  const items: DayItem[] = real.map((a) => ({
    key: `c${a.id}`,
    status: 'confirmed',
    mine: mineOf(a.status_saya),
    start: a.jam_awal,
    end: a.jam_akhir,
    name: a.nama_jadwal_kelas,
    kelas: a.nama_kelas,
    instructor: a.instruktur,
    packageId: a.id_paket_kelas ?? null,
    classId: a.id,
    peserta: a.peserta,
    max: a.maksimal_member,
    fotoUrl: a.foto_url,
  }))

  const nowTime = hhmm(now)
  for (const s of slots) {
    if (s.wd !== weekdayOf(date)) continue
    if (real.some((a) => a.jam_awal === s.start)) continue
    items.push({
      key: `p${s.wd}-${s.start}-${s.name}`,
      status: isPast || (isToday && s.start <= nowTime) ? 'ended' : 'predicted',
      start: s.start,
      end: s.end,
      name: s.name,
      kelas: s.kelas,
      instructor: s.instructor,
      packageId: s.packageId,
    })
  }
  return items.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name))
}
