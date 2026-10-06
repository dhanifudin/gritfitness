// When the gym opens class registration, as far as the member's own observation goes: a morning class
// opens at 15:00 the day before, an afternoon class at 07:00 the same day. Only a heuristic, used to time
// the "classopen" push nudge and a hint in the class sheet — the actual auto-register decision always
// comes from each row's own tanggal_mulai_daftar/tanggal_tutup_daftar (see classWatch.ts).
// Pure and framework-free: shared with the grit-push-check Edge Function, like insight.ts.

export const MORNING_CUTOFF = '12:00' // a class starting before this is a "morning" class
export const REGISTRATION_OPENS = {
  morning: { daysBefore: 1, hour: 15 },
  afternoon: { daysBefore: 0, hour: 7 },
} as const

export const WEEKDAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

export const isMorningClass = (start_time: string) => start_time < MORNING_CUTOFF
export const registrationOpening = (start_time: string) => (isMorningClass(start_time) ? REGISTRATION_OPENS.morning : REGISTRATION_OPENS.afternoon)

/** Weekday (Mon = 0) on which registration for a class on `weekday` opens. */
const openWeekday = (weekday: number, start_time: string) => (((weekday - registrationOpening(start_time).daysBefore) % 7) + 7) % 7

/** Is it past the usual opening time on the opening day? `now` is wall-clock time in Jakarta. */
export function nudgeDue(entry: { weekday: number; start_time: string }, now: { weekday: number; hour: number }): boolean {
  return now.weekday === openWeekday(entry.weekday, entry.start_time) && now.hour >= registrationOpening(entry.start_time).hour
}

/** "Minggu 15.00": when registration for this weekly slot usually opens. */
export function opensLabel(weekday: number, start_time: string): string {
  return `${WEEKDAY_NAMES[openWeekday(weekday, start_time)]} ${String(registrationOpening(start_time).hour).padStart(2, '0')}.00`
}

/** Jakarta has no DST; a fixed +7h offset is exact, not an approximation. Mon = 0, hour has a minute fraction. */
export function jakartaFields(d: Date): { weekday: number; hour: number } {
  const jk = new Date(d.getTime() + 7 * 3600_000)
  return { weekday: (jk.getUTCDay() + 6) % 7, hour: jk.getUTCHours() + jk.getUTCMinutes() / 60 }
}
