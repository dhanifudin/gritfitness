export interface User {
  id: number
  nama: string
  email: string
  jenis_kelamin: string
  no_hp: string
  foto: string | null
  alamat: string | null
  tanggal_lahir: string | null
  tipe: string
  ajukan_pelajar: string
  token_expired: string
}
export interface LoginResponse extends User {
  access_token: string
  token_type: string
}
/** /member/list/:id and /memberpt/list/:id — either an active package or {error} */
export interface ActiveMember {
  id: number
  nama_paket: string
  qr_code: string // base64 SVG
  tanggal_mulai: string
  tanggal_selesai: string
  error?: string
}
export interface Tagihan {
  id: number
  kode: string
  jenis_paket: string
  paket?: string
  tanggal_invoice: string
  total_tagihan: string
  total?: string
  total_rp?: string
  status: string
  invoice_url: string | null
  expired: number
}
export interface JadwalKelas {
  id: number
  id_paket_kelas?: number
  nama_jadwal_kelas: string
  nama_kelas: string
  instruktur: string | null
  tanggal: string
  jam_awal: string
  jam_akhir: string
  maksimal_member: number
  peserta: number
  foto_url: string
  status_saya?: string
  /** registration window, 'YYYY-MM-DD HH:MM:SS' — confirmed present on live responses though not
   *  consistently 19:00-day-before/07:00-same-day; always trust these over any guessed clock time. */
  tanggal_mulai_daftar?: string
  tanggal_tutup_daftar?: string
}
export interface PaketMembership {
  id: number
  nama: string
  durasi: number
  satuan_durasi: string
  harga: string
  jumlah_pertemuan: number | null
  tipe: string
  jenis: string
}

export interface ClassDetail {
  id: number
  id_paket_kelas?: number
  nama_kelas: string
  nama_jadwal_kelas: string
  tanggal: string
  jam_awal: string
  jam_akhir: string
  instruktur: string | null
  max_member: number
  peserta: number
  waitinglist: number
  harga_rp?: string
  daftar: string
  id_peserta?: number
}
export interface ActionResult {
  success?: boolean
  message?: string
}
export interface PackageDetail {
  id: number
  nama: string
  durasi: number
  satuan_durasi: string
  harga: string
  total_durasi?: number
  jumlah_pertemuan: number | null
  tipe: string
  jenis: string
}
export interface ClassPackage {
  id: number
  nama: string
  harga: string
  foto: string
  kelas_khusus: string
  durasi_waktu: number
  maksimal_member: number
  deskripsi?: string
  kategori?: string
  instruktur?: string
  jadwal?: { id: number; tanggal: string; jam_awal: string; jam_akhir: string }[]
}
export interface BillDetail extends Tagihan {
  paket: string
  tanggal: string
  total_rp: string
  dibayar_rp: string
  belum_rp: string
  nama_member: string
}
export interface Membership {
  id: number
  nama_paket: string
  jenis: string
  tanggal_mulai: string
  tanggal_selesai: string
  status: string
  harga: string
  status_bayar?: string
  kode_registrasi?: string
  total_durasi?: number
  nama_member?: string
}
export interface Cuti {
  id: number
  status_cuti: string
  nama_kegiatan: string
  tgl_awal: string | null
  tgl_akhir: string | null
  status_paket: string
  status_bayar: string
}
export interface Region {
  id: string
  text: string
}
