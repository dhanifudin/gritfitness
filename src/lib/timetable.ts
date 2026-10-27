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

/** Subset of a /schedule?date row this module needs (rows are already per-day). */
export interface ActualClass {
  id: number
  kelas: string
  kategori?: string | null
  instruktur: string | null
  jam_mulai: string
  jam_selesai: string
  slot_max: number
  slot_terisi: number
  penuh: boolean
  sudah_booking: boolean
  booking_status: 'confirmed' | 'booked' | null
}

export type DayStatus = 'confirmed' | 'predicted' | 'ended'

export interface DayItem {
  key: string
  status: DayStatus
  /** the member's own booking on a real row */
  mine?: 'peserta' | 'unpaid' | null
  start: string
  end: string
  name: string
  kelas: string
  instructor: string | null
  packageId: number | null
  classId?: number
  peserta?: number
  max?: number
  penuh?: boolean
}

/** The member's own standing on a row: confirmed booking, or one still waiting on payment. */
export function mineOf(row: Pick<ActualClass, 'sudah_booking' | 'booking_status'>): 'peserta' | 'unpaid' | null {
  if (row.booking_status === 'confirmed') return 'peserta'
  if (row.booking_status === 'booked') return 'unpaid'
  return row.sudah_booking ? 'peserta' : null
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
 * Classes of one day. Real rows (already fetched for exactly this date) are `confirmed`;
 * recurring-timetable slots fill the rest as `predicted` (future) or `ended` (already past).
 * A predicted slot is dropped when a real row starts at the same time, because the real row
 * supersedes it.
 */
export function mergeDay(date: Date, actual: ActualClass[], slots: Slot[], now = new Date()): DayItem[] {
  const today = startOfDay(now)
  const day = startOfDay(date)
  const isPast = day < today
  const isToday = day.getTime() === today.getTime()

  const items: DayItem[] = actual.map((a) => ({
    key: `c${a.id}`,
    status: 'confirmed',
    mine: mineOf(a),
    start: a.jam_mulai,
    end: a.jam_selesai,
    name: a.kelas,
    kelas: a.kategori ?? a.kelas,
    instructor: a.instruktur,
    packageId: null,
    classId: a.id,
    peserta: a.slot_terisi,
    max: a.slot_max,
    penuh: a.penuh,
  }))

  const nowTime = hhmm(now)
  for (const s of slots) {
    if (s.wd !== weekdayOf(date)) continue
    if (actual.some((a) => a.jam_mulai === s.start)) continue
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
