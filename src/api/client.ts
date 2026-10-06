const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://gritfitness.id/api'

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
}

// Paths must not have a trailing slash: the server 301-redirects them to plain http://.
export async function api<T>(path: string, { method = 'GET', body, emptyOn404 }: Options = {}): Promise<T> {
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
  if (!res.ok) {
    const msg = (data as { message?: string; error?: string } | null)?.message ?? (data as { error?: string } | null)?.error
    const sessionEnded = res.status === 401 && !!token && !path.startsWith('/verify-otp') && !path.startsWith('/request-otp')
    throw new ApiError(res.status, sessionEnded ? 'Sesi berakhir. Masuk lagi untuk memuat data terbaru.' : (msg ?? `Permintaan gagal (${res.status})`), data)
  }
  return data as T
}
