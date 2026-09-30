import { api } from './client'
import type {
  ActionResult, ActiveMember, BillDetail, ClassDetail, ClassPackage, Cuti, JadwalKelas, LoginResponse, Membership,
  PackageDetail, PaketMembership, Tagihan,
} from './types'
import type { Region } from './types'

export const requestOtp = (no_hp: string) => api<{ message?: string }>('/request-otp', { method: 'POST', body: { no_hp } })
export const verifyOtp = (no_hp: string, otp: string) => api<LoginResponse>('/verify-otp', { method: 'POST', body: { no_hp, otp } })
export const logout = () => api('/logout', { method: 'POST' })
export const validateToken = () => api('/validate-token', { method: 'POST' })

export const memberAktif = (userId: number) => api<ActiveMember>(`/member/list/${userId}`, { emptyOn404: { error: 'none' } })
export const memberPtAktif = (userId: number) => api<ActiveMember>(`/memberpt/list/${userId}`, { emptyOn404: { error: 'none' } })

export const jadwalKelas = () => api<JadwalKelas[]>('/jadwal-kelas', { emptyOn404: [] })
export const tagihan = async () => (await api<{ data_tagihan: Tagihan[] }>('/tagihan', { emptyOn404: { data_tagihan: [] } })).data_tagihan
export const paketMemberships = () => api<PaketMembership[]>('/paket/memberships/list', { emptyOn404: [] })
export const paketPt = () => api<PaketMembership[]>('/paket/membershippt/list', { emptyOn404: [] })

export const classDetail = (id: number | string) => api<ClassDetail>(`/jadwal-kelas/detail/${id}`)
export const classRegister = (id: number) => api<ActionResult>('/jadwal-kelas/daftar', { method: 'POST', body: { membership_id: id } })
export const classWaiting = (id: number) => api<ActionResult>('/jadwal-kelas/daftar/waiting', { method: 'POST', body: { membership_id: id } })
export const classCancel = (participantId: number, alasan: string) =>
  api<ActionResult>('/jadwal-kelas/daftar/batal', { method: 'POST', body: { membership_id: participantId, alasan } })

export const packageDetail = (id: number | string) => api<PackageDetail>(`/paket/memberships/detail/${id}`)
export const paketKelas = () => api<ClassPackage[]>('/paket/kelas/list', { emptyOn404: [] })
export const paketKelasDetail = (id: number | string) => api<ClassPackage>(`/paket/kelas/detail/${id}`)

export const billDetail = (id: number | string) => api<BillDetail>(`/tagihan/detail/${id}`)

export const memberships = (uid: number) => api<Membership[]>(`/member/listMemberships/${uid}`, { emptyOn404: [] })
export const membershipDetail = (id: number | string) => api<Membership & { invoice?: Tagihan }>(`/memberships/detail/${id}`)

export const cutiList = (uid: number) => api<{ data_cuti: Cuti[]; cek_member: string }>(`/cuti/${uid}`, { emptyOn404: { data_cuti: [], cek_member: '' } })
export const cutiSave = (b: { awal: string; akhir: string; keterangan: string }) => api<ActionResult>('/cuti/simpan', { method: 'POST', body: b })

export const profileUpdate = (form: FormData) => api<ActionResult>('/profil/update', { method: 'POST', body: form })

export const regionSearch = async (q: string) => (await api<{ results: Region[] }>(`/region?q=${encodeURIComponent(q)}`, { emptyOn404: { results: [] } })).results
export const registerOtp = (no_hp: string) => api<ActionResult>('/daftar/otp', { method: 'POST', body: { no_hp } })
export const register = (form: FormData) => api<ActionResult>('/daftar', { method: 'POST', body: form })
