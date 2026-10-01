// Remembers the member's phone number on this device so the login screen can prefill it.
// This is a convenience only: a real OTP is still required on every login. Never cleared on
// logout (that would defeat the point); only an explicit "Ganti nomor" tap clears it.
const KEY = 'grit.lastPhone'

export const getLastPhone = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const saveLastPhone = (noHp: string) => {
  try {
    localStorage.setItem(KEY, noHp)
  } catch {
    /* best effort */
  }
}

export const clearLastPhone = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* best effort */
  }
}
