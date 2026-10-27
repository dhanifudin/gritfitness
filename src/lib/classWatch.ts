// Matches a watchlist entry (a recurring weekday+time+class the member wants auto-booked) against
// the real schedule rows of that day. Pure, no Vue/network — the actual fetch and booking call
// happen in the store; this only decides whether now is the moment to attempt it.
//
// The new API has no registration-window fields: the gym simply publishes a day's schedule a short
// while (≈1 day) ahead, and a published row is bookable until it is full or has started. So "the
// moment to attempt" = the watched occurrence's row exists, isn't full, and isn't already booked.
import { normalizeName } from './classInfo.ts'
import { ymd, weekdayOf } from './tracker.ts'

export interface WatchEntry {
  id: string
  weekday: number // Mon = 0, matches Slot.wd
  start_time: string // 'HH:MM'
  class_name: string
  package_id: number | null
  active: boolean
  last_attempt_date: string | null // 'YYYY-MM-DD' of the occurrence last attempted
}

/** Subset of a /schedule?date row this module needs. */
export interface WatchRow0 {
  id: number
  kelas: string
  jam_mulai: string
  penuh: boolean
  sudah_booking: boolean
}

/** How many days ahead to look for a watched occurrence's published row. The gym publishes about a
 *  day ahead, so 2 covers today + tomorrow without wasting requests on empty days. */
export const WATCH_HORIZON_DAYS = 2

/** Days until this weekly slot next happens (0 = today). */
export const nextOccurrence = (entry: { weekday: number }, now: Date) => (entry.weekday - weekdayOf(now) + 7) % 7

/** The YYYY-MM-DD this entry should be booked for next (today's occurrence counts until midnight). */
export function occurrenceYmd(entry: { weekday: number }, now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + nextOccurrence(entry, now))
  return ymd(d)
}

/**
 * The real row to book right now, or null when there's nothing to do — occurrence too far out,
 * no matching row published yet, already attempted for this occurrence, or the class already started.
 */
export function matchOpenRow(entry: WatchEntry, rowsOf: (date: string) => WatchRow0[] | undefined, now: Date): { date: string; row: WatchRow0 } | null {
  if (!entry.active) return null
  const days = nextOccurrence(entry, now)
  if (days >= WATCH_HORIZON_DAYS) return null
  const date = occurrenceYmd(entry, now)
  if (entry.last_attempt_date === date) return null
  if (days === 0 && entry.start_time <= `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`) return null

  const rows = rowsOf(date)
  if (!rows) return null
  const want = normalizeName(entry.class_name)
  const row = rows.find((r) => r.jam_mulai === entry.start_time && normalizeName(r.kelas) === want)
  return row ? { date, row } : null
}

type WatchResult = WatchEntry & { last_attempt_result?: string | null }

const SHORT_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
/** "Hari ini 17.00", "Besok 07.00", "Kam 08.00". */
export function watchWhen(entry: { weekday: number; start_time: string }, now: Date): string {
  const d = nextOccurrence(entry, now)
  return `${d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : SHORT_DAYS[entry.weekday]} ${entry.start_time.replace(':', '.')}`
}

const RESULTS: Record<string, { text: string; tone: 'good' | 'warn' | 'bad' }> = {
  registered: { text: 'Terbooking otomatis', tone: 'good' },
  already: { text: 'Sudah terbooking', tone: 'good' },
  waiting: { text: 'Masuk waiting list', tone: 'warn' },
  full: { text: 'Kelas penuh', tone: 'bad' },
  failed: { text: 'Gagal, booking manual', tone: 'bad' },
}

/** Second line of a watchlist row: the pending occurrence's attempt result, otherwise what we're waiting for. */
export function watchStatus(entry: WatchResult, now: Date): { text: string; tone: 'good' | 'warn' | 'bad' | 'info' } {
  const r = entry.last_attempt_date === occurrenceYmd(entry, now) && entry.last_attempt_result ? RESULTS[entry.last_attempt_result] : undefined
  return r ?? { text: 'Dibooking otomatis begitu jadwalnya terbit', tone: 'info' }
}

/** A watch row earns its place on Beranda until the coming occurrence is booked — after that the class
 *  shows under the booked classes instead, so keeping the row would just duplicate it. */
export function showOnHome(entry: WatchResult, now: Date): boolean {
  if (!entry.active) return false
  return !(entry.last_attempt_date === occurrenceYmd(entry, now) && (entry.last_attempt_result === 'registered' || entry.last_attempt_result === 'already'))
}
