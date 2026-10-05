// What a class-detail row's `daftar` status means and what to do about it — shared between
// ClassDetailView.vue (the manual flow) and the auto-register watchlist check, so the two can never
// disagree about what counts as "registrable right now". Pure, no Vue/browser imports.

export type ActionKind = 'register' | 'waiting' | 'cancel'

export interface ClassAction {
  kind: ActionKind
  label: string
  danger?: boolean
}

const NOTICES: Record<string, string> = {
  'SUDAH TERDAFTAR': 'Anda sudah masuk waiting list kelas ini.',
  'TERDAFTAR WAITING LIST': 'Anda terdaftar sebagai waiting list kelas ini.',
  TIDAK: 'Anda bukan anggota premium, atau tidak terdaftar di paket kelas ini.',
  PINALTI: 'Anda belum bisa mengikuti jadwal ini karena masih dalam masa penalti.',
  DIBATALKAN: 'Anda sudah membatalkan kepesertaan di kelas ini.',
  BAYAR: 'Kelas ini berbayar. Silakan hubungi front desk untuk mendaftar.',
  'BAYAR WAITINGLIST': 'Pendaftaran Anda menunggu penyelesaian di front desk.',
}

/** What action (if any) applies for a `ClassDetail.daftar` status. Null when there's nothing to do. */
export function classActionFor(daftar: string | undefined): ClassAction | null {
  switch (daftar) {
    case 'YA':
    case 'BELUM TERDAFTAR':
      return { kind: 'register', label: 'Daftar Peserta' }
    case 'DAFTAR WAITING LIST':
      return { kind: 'waiting', label: 'Daftar Waiting List' }
    case 'PESERTA':
      return { kind: 'cancel', label: 'Batalkan Kepesertaan', danger: true }
    default:
      return null
  }
}

/** Human-readable explanation of the current `daftar` status, for display. */
export function classNoticeFor(daftar: string | undefined): string {
  const d = daftar ?? ''
  if (d === 'PESERTA') return 'Anda sudah menjadi peserta kelas ini.'
  if (d === 'DAFTAR WAITING LIST') return 'Kuota peserta sudah penuh. Daftar sebagai waiting list?'
  return NOTICES[d] ?? ''
}
