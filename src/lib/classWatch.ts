// Matches a watchlist entry (a recurring weekday+time+class the member wants auto-registered) against
// today's real jadwal-kelas rows. Pure, no Vue/network — the actual fetch and classRegister/classWaiting
// call happen in the store; this only decides whether now is the moment to attempt it.
//
// `GET /jadwal-kelas` only ever returns today's rows (confirmed live — a date query param is silently
// ignored), so a future occurrence's real id genuinely doesn't exist yet. Each row that does exist
// carries its own authoritative `tanggal_mulai_daftar`/`tanggal_tutup_daftar` window (confirmed live:
// not a fixed clock time) — that window, not a guessed time, is what gates the attempt.
import { ymd, weekdayOf } from './tracker.ts'

export interface WatchEntry {
  id: string
  weekday: number // Mon = 0, matches Slot.wd
  start_time: string // 'HH:MM'
  class_name: string
  package_id: number | null
  active: boolean
  last_attempt_date: string | null // 'YYYY-MM-DD'
}

export interface JadwalRow {
  id: number
  id_paket_kelas?: number
  nama_jadwal_kelas: string
  jam_awal: string
  tanggal_mulai_daftar?: string
  tanggal_tutup_daftar?: string
}

/** 'YYYY-MM-DD HH:MM:SS' parsed as local time (same convention used elsewhere in this app). */
function parseLocal(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * The real row to register for right now, or null when there's nothing to do — not today's weekday,
 * no matching row published yet, outside its registration window, or already attempted today.
 */
export function matchOpenRow(entry: WatchEntry, actual: JadwalRow[], now: Date): JadwalRow | null {
  if (!entry.active) return null
  if (entry.last_attempt_date === ymd(now)) return null
  if (weekdayOf(now) !== entry.weekday) return null

  const row = actual.find((r) => r.jam_awal === entry.start_time && (r.id_paket_kelas === entry.package_id || r.nama_jadwal_kelas === entry.class_name))
  if (!row) return null

  const opens = parseLocal(row.tanggal_mulai_daftar)
  const closes = parseLocal(row.tanggal_tutup_daftar)
  if (!opens || !closes) return null // window unknown: don't guess, wait for a row that states it
  if (now < opens || now > closes) return null

  return row
}
