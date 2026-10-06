// Why a gym session ended. The gym allows one active session per account, so a login elsewhere (another
// browser, phone or the gym's own app) revokes this token long before its ~5h expiry: 'early'. Past the
// server-issued expiry it is a plain 'timeout'. Pure, no Vue.
export type EndReason = 'early' | 'timeout'

export function endReason(tokenExpired: string | null | undefined, now: number): EndReason {
  const exp = tokenExpired ? Date.parse(tokenExpired) : NaN
  return !Number.isNaN(exp) && now >= exp ? 'timeout' : 'early'
}

/** Milliseconds until the token expires (0 when already past), or null when the expiry is unknown. */
export function msUntilExpiry(tokenExpired: string | null | undefined, now: number): number | null {
  const exp = tokenExpired ? Date.parse(tokenExpired) : NaN
  return Number.isNaN(exp) ? null : Math.max(0, exp - now)
}
