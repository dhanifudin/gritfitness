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
