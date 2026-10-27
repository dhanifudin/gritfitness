// What a schedule row's booking state means and what to do about it — shared between the class
// detail sheet (manual flow) and the auto-register watchlist check, so the two can never disagree
// about what counts as "bookable right now". Pure, no Vue/browser imports.

export type ActionKind = 'book' | 'waiting' | 'pay'

export interface ClassAction {
  kind: ActionKind
  label: string
}

export interface BookableRow {
  penuh: boolean
  sudah_booking: boolean
  booking_status: 'confirmed' | 'booked' | null
  tagihan_id: number | null
}

/** What action (if any) applies to a schedule row. Null when there's nothing to do (already in). */
export function classActionFor(row: BookableRow): ClassAction | null {
  if (row.booking_status === 'confirmed') return null
  if (row.booking_status === 'booked') return { kind: 'pay', label: 'Lanjutkan Pembayaran' }
  if (row.penuh) return { kind: 'waiting', label: 'Ikut Waiting List' }
  return { kind: 'book', label: 'Ambil Kelas Ini' }
}

/** Human-readable explanation of the row's booking state, for display. */
export function classNoticeFor(row: BookableRow): string {
  if (row.booking_status === 'confirmed') return 'Kamu sudah mengambil kelas ini.'
  if (row.booking_status === 'booked') return 'Booking menunggu pembayaran. Selesaikan pembayaran agar slot tidak hangus.'
  if (row.penuh) return 'Kuota peserta sudah penuh. Ikut sebagai waiting list?'
  return ''
}

/** The rules every participant agrees to before booking (verbatim from the gym). */
export const ATURAN_KELAS = [
  'Setiap peserta kelas wajib men-scan barcode saat mengikuti kelas.',
  'Jika tidak scan barcode sebelum kelas, dianggap tidak hadir dan mendapat pinalti: tidak dapat memesan kelas yang sama berikutnya selama 1 kali.',
  'Cancel kelas maksimal 1 jam sebelum kelas dimulai.',
  'Cancel kelas tidak dapat dilakukan 1 jam sebelum kelas dimulai, dan jika tidak hadir pinalti akan berlaku.',
]
