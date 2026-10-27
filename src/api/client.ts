const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://gritfitness.id/api/member'

export class ApiError extends Error {
  status: number
  body?: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn)

const tokenKey = 'grit.token'
export const getToken = () => localStorage.getItem(tokenKey)
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey)

interface Options {
  method?: 'GET' | 'POST'
  body?: unknown
  /** treat 404 as "no data" and return this value instead of throwing */
  emptyOn404?: unknown
  /** extra statuses whose body is returned instead of throwing (e.g. 429 on request-otp = OTP still valid) */
  okOn?: number[]
}

/** First human-readable message out of a Laravel error body ({message} or {errors:{field:[…]}}). */
export function apiMessage(data: unknown): string | undefined {
  const d = data as { message?: string; errors?: Record<string, string[]> } | null
  const fieldErr = d?.errors && Object.values(d.errors)[0]?.[0]
  return fieldErr ?? d?.message
}

export async function api<T>(path: string, { method = 'GET', body, emptyOn404, okOn }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)

  if (res.status === 401 && token) onUnauthorized()
  if (res.status === 404 && emptyOn404 !== undefined) return emptyOn404 as T
  if (!res.ok && !okOn?.includes(res.status)) {
    const sessionEnded = res.status === 401 && !!token && !path.startsWith('/auth/')
    throw new ApiError(res.status, sessionEnded ? 'Sesi berakhir. Masuk lagi untuk memuat data terbaru.' : (apiMessage(data) ?? `Permintaan gagal (${res.status})`), data)
  }
  return data as T
}
