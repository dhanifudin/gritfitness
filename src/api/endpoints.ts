import { api } from './client'
import type {
  ActionResult, ActiveMembership, BookingResult, ClassCatalogItem, ClassInfo, Cuti, Dashboard, Invoice, InvoiceDetail,
  Membership, MyClass, MyClassDetail, Notification, Paket, PaketDetail, ProgressEntry, PtPaket, ScheduleRow, User,
  VerifyOtpResponse,
} from './types'

// Auth — OTP is sent via WhatsApp; 429 means "previous OTP still valid", treated as sent.
export const requestOtp = (no_hp: string) => api<{ success?: boolean; message?: string; cooldown_seconds?: number }>('/auth/request-otp', { method: 'POST', body: { no_hp }, okOn: [429] })
export const verifyOtp = (no_hp: string, otp: string) => api<VerifyOtpResponse>('/auth/verify-otp', { method: 'POST', body: { no_hp, otp } })
export const register = (form: FormData) => api<VerifyOtpResponse>('/auth/register', { method: 'POST', body: form })
export const profileUpdate = (form: FormData) => api<{ user: User }>('/auth/profile', { method: 'POST', body: form })
export const me = async () => (await api<{ user: User }>('/auth/me')).user
export const logout = () => api<ActionResult>('/auth/logout', { method: 'POST' })

export const dashboard = () => api<Dashboard>('/dashboard')

// Schedule & booking
export const schedule = async (date?: string) => (await api<{ tanggal: string; data: ScheduleRow[] }>(`/schedule${date ? `?date=${date}` : ''}`)).data
export const classSchedule = (classId: number | string) => api<{ kelas: ClassInfo; data: ScheduleRow[] }>(`/classes/${classId}/schedule`)
export const book = (schedule_id: number) => api<BookingResult>('/bookings', { method: 'POST', body: { schedule_id } })
export const myClasses = () => api<{ mendatang: MyClass[]; riwayat: MyClass[] }>('/my-classes')
export const myClassDetail = (scheduleId: number | string) => api<MyClassDetail>(`/my-classes/${scheduleId}`)
export const cancelClass = (scheduleId: number) => api<ActionResult>(`/my-classes/${scheduleId}/cancel`, { method: 'POST', body: {} })

// Catalog
export const paketList = () => api<{ data: Paket[]; tier_aktif_id: number | null }>('/packages')
export const paketDetail = (id: number | string) => api<PaketDetail>(`/packages/${id}`)
export const classCatalog = async () => (await api<{ data: ClassCatalogItem[] }>('/classes')).data
export const ptPaketList = async () => (await api<{ data: PtPaket[] }>('/pt-packages')).data
export const ptPaketDetail = async (id: number | string) => (await api<{ paket: PtPaket }>(`/pt-packages/${id}`)).paket
export const ptPaketBuy = (id: number) => api<{ invoice: { id: number } }>(`/pt-packages/${id}/buy`, { method: 'POST' })
export const subscribe = (tier_id: number) => api<{ invoice: { id: number } }>('/subscriptions', { method: 'POST', body: { tier_id } })

// Invoices / payments
export const invoices = async () => (await api<{ invoices: Invoice[] }>('/invoices')).invoices
export const invoiceDetail = (id: number | string) => api<InvoiceDetail>(`/invoices/${id}`)
export const uploadBukti = (id: number | string, form: FormData) => api<InvoiceDetail & ActionResult>(`/invoices/${id}/bukti`, { method: 'POST', body: form })

// Membership & QR
export const membershipActive = () => api<ActiveMembership>('/membership/active')
export const memberships = async () => (await api<{ memberships: Membership[] }>('/memberships')).memberships

// Cuti
export const cutiList = async () => (await api<{ cuti: Cuti[] }>('/leaves')).cuti
export const cutiSave = (b: { tanggal_mulai: string; tanggal_selesai: string; alasan: string }) => api<ActionResult>('/leaves', { method: 'POST', body: b })

// Progress (body metrics, server-side)
export const progressList = () => api<{ latest: ProgressEntry | null; history: ProgressEntry[] }>('/progress')
export const progressSave = (b: { berat_kg: number; tinggi_cm: number; lemak_persen?: number; massa_otot_kg?: number; diukur_pada?: string; catatan?: string }) =>
  api<ActionResult>('/progress', { method: 'POST', body: b })

// Notifications (read state is client-side)
export const notifications = async () => (await api<{ notifications: Notification[] }>('/notifications')).notifications
