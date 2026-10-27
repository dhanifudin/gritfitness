// Shapes of the new member API (https://gritfitness.id/api/member/*), verified live 2026-10-28
// against the official member app's unminified client (gritfitness.id/member/js/api.js).

export interface User {
  id: number
  kode: string
  nama: string
  email: string | null
  telepon: string // "628…"
  jenis_kelamin: string | null
  tanggal_lahir: string | null // YYYY-MM-DD
  alamat: string | null
  foto: string | null
  pelajar: boolean
  status_pelajar: 'menunggu' | 'disetujui' | 'ditolak' | null
  status_pelajar_label: string | null
  pelajar_terverifikasi: boolean
  pelajar_alasan_tolak: string | null
}

/** verify-otp: `registered` logs in; `new` carries a register_token for /auth/register. */
export interface VerifyOtpResponse {
  status: 'registered' | 'new'
  access_token?: string
  user?: User
  register_token?: string
  message?: string
}

export interface Membership {
  id: number
  tier: string
  status: string // 'active' | 'expired' | …
  status_label: string
  aktif: boolean
  tanggal_mulai: string // preformatted, "30 Sep 2026"
  aktif_sampai: string
  sisa_hari: number
  total_hari: number
}

/** GET /membership/active */
export interface ActiveMembership {
  aktif: boolean
  membership?: Membership & { member_id: number; kode_member: string; nama: string }
  /** daily-rotating payload "memberId|membershipId|YYYY-MM-DD|hash", rendered client-side */
  qr_absensi?: string
  tanggal?: string // the day the payload is valid for
}

/** One /schedule or /classes/:id/schedule row. */
export interface ScheduleRow {
  id: number // schedule id, used for booking
  kelas: string
  deskripsi: string | null
  syarat_ketentuan: string | null // newline-separated
  tanggal?: string // only on /classes/:id/schedule
  tanggal_label?: string
  jam_mulai: string // "16:00"
  jam_selesai: string
  ruangan: string | null
  instruktur: string | null
  slot_terisi: number
  slot_max: number
  penuh: boolean
  harga_normal: number
  harga_akhir: number
  gratis: boolean
  diskon: boolean
  sudah_booking: boolean
  booking_status: 'confirmed' | 'booked' | null // booked = unpaid
  tagihan_id: number | null
}

export interface ClassInfo {
  id: number
  nama: string
  kategori: string | null
  deskripsi: string | null
  syarat_ketentuan?: string | null
  durasi_menit: number
}

/** GET /classes — class catalog entry. */
export interface ClassCatalogItem extends ClassInfo {
  ada_jadwal: boolean
  harga_mulai: number | null
  gratis: boolean
  termasuk_paket: boolean
}

export type BookingStatus = 'confirmed' | 'booked' | 'cancelled' | 'no_show'
export type Kehadiran = 'hadir' | 'izin' | 'tidak_hadir'

/** GET /my-classes rows (mendatang + riwayat). */
export interface MyClass {
  id: number // booking id
  schedule_id: number
  nama: string
  kategori: string | null
  tanggal: string // "Sabtu, 10 Okt 2026"
  jam_mulai: string
  jam_selesai: string
  ruangan: string | null
  instruktur: string | null
  status_booking: BookingStatus
  status_booking_label: string
  kehadiran: Kehadiran | null
  kehadiran_label: string | null
}

/** GET /my-classes/:scheduleId */
export interface MyClassDetail {
  kelas: {
    nama: string
    kategori: string | null
    tanggal: string
    tanggal_label: string
    jam_mulai: string
    jam_selesai: string
    ruangan: string | null
    instruktur: string | null
    nama_member: string
  }
  status_booking: BookingStatus
  status_booking_label: string
  kehadiran: Kehadiran | null
  kehadiran_label: string | null
  upcoming: boolean
  qr_absensi: string | null
  bisa_cancel: boolean
  batas_cancel_jam: number
}

export interface BookingResult {
  message?: string
  status?: string // 'pending_payment' → go pay tagihan_id
  tagihan_id?: number
}

/** GET /dashboard */
export interface Dashboard {
  user: { nama: string; kode: string; telepon: string; foto: string | null }
  membership: { tier: string; status: string; aktif_sampai: string; sisa_hari: number; total_hari: number } | null
  kelas_berikutnya: { schedule_id: number; nama: string; tanggal_label: string; jam: string; ruangan: string | null; instruktur: string | null } | null
  notif_latest_at: string | null
}

export interface Paket {
  id: number
  nama: string
  harga: number
  durasi_hari: number
  benefit: string[]
  deskripsi: string | null
  tipe: string | null // 'pelajar' gets a tag
}
export interface PaketDetail extends Paket {
  syarat_ketentuan: string[]
  is_tier_aktif: boolean
}
export interface PtPaket {
  id: number
  nama: string
  jumlah_sesi: number
  harga: number
  harga_per_sesi: number
  masa_berlaku_hari: number
}

export interface Invoice {
  id: number
  nomor: string
  judul?: string
  jenis_label: string
  keterangan?: string | null
  jumlah: number
  jatuh_tempo_label: string
  status: string // 'lunas' | 'terlambat' | …
  status_label: string
  lunas: boolean
  dapat_dibayar: boolean
  pembayaran?: {
    status: 'pending' | 'berhasil' | 'gagal'
    status_label: string
    catatan: string | null
    bukti_transfer: string | null
    pengirim: string | null
  } | null
}
export interface BankAccount {
  id: number
  bank_name: string
  branch: string | null
  account_number: string
  account_holder: string
}
export interface InvoiceDetail {
  invoice: Invoice
  bank_accounts: BankAccount[]
}

export interface Cuti {
  durasi: number
  status: string // 'pending' | 'ditolak' | 'disetujui' | …
  status_label: string
  tanggal_mulai: string
  tanggal_selesai: string
  alasan: string | null
}

export interface ProgressEntry {
  tanggal: string
  berat_kg: number
  tinggi_cm?: number
  bmi: number | null
  bmi_kategori?: string | null
  bmi_color?: 'green' | 'red' | string | null
  lemak_persen: number | null
  massa_otot_kg?: number | null
}

export interface Notification {
  icon: 'payment' | 'calendar' | 'gift' | 'promo' | 'bell' | string
  title: string
  body: string
  time_label: string
  created_at: string // ISO
}

export interface ActionResult {
  success?: boolean
  message?: string
}
