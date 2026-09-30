import { api } from './client'
import type { ActiveMember, JadwalKelas, LoginResponse, PaketMembership, Tagihan } from './types'

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
