// Self-tracker maths: weekly counts, goal streaks, calendar, badges, motivation and reminders.
// Pure functions of (visits, now): no Vue, no I/O, so they can be unit-tested with plain Node.
// A "week" is Monday..Sunday (same as the class schedule); several logs on one day count as one visit.

import { activityMeta } from './activities.ts'

export interface Visit {
  client_id: string
  visited_on: string // local date, YYYY-MM-DD
  visited_at?: string | null // ISO timestamp
  source: 'checkin' | 'class' | 'manual'
  class_name?: string | null
  note?: string | null
  energy?: number | null // 1..5
  /** what was done; missing on old rows = 'gym' ('class' when source is 'class') */
  activity?: 'gym' | 'class' | 'pt' | 'recovery' | 'other'
  activity_name?: string | null // custom name for 'other' (e.g. Hyrox)
  /** only workouts count toward the weekly goal / streak; missing = counts */
  counts_toward_goal?: boolean
  duration_min?: number | null
  class_id?: number | null
}

export interface Settings {
  goal_per_week: number
  goal_weight_kg?: number | null
  reminder_hour?: number | null
  consented_at?: string | null
}

export const DEFAULT_SETTINGS: Settings = { goal_per_week: 3, reminder_hour: 17 }

// ---- dates (local time) ------------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const weekdayOf = (d: Date) => (d.getDay() + 6) % 7 // Mon = 0
export const mondayOf = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -weekdayOf(d))
const dayDiff = (a: Date, b: Date) => Math.round((parseYmd(ymd(b)).getTime() - parseYmd(ymd(a)).getTime()) / 86_400_000)

// ---- core ---------------------------------------------------------------------------------------------
/** Does this entry count toward the weekly goal / streak / stats? (recovery and opted-out custom entries do not) */
export const counts = (v: Visit) => v.counts_toward_goal !== false

/** Days with at least one counted workout. */
export const visitDays = (visits: Visit[]) => new Set(visits.filter(counts).map((v) => v.visited_on))
/** Days with any recorded activity, counted or not. */
export const anyDays = (visits: Visit[]) => new Set(visits.map((v) => v.visited_on))

export interface WeekCount {
  weekStart: string // Monday, YYYY-MM-DD
  count: number
  isCurrent: boolean
}

/** Distinct visit days per week for the last `n` weeks, oldest first, ending with the current week. */
export function weekCounts(visits: Visit[], now: Date, n = 8): WeekCount[] {
  const days = [...visitDays(visits)]
  const thisMonday = mondayOf(now)
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(thisMonday, -7 * (n - 1 - i))
    const from = ymd(start)
    const to = ymd(addDays(start, 6))
    return { weekStart: from, count: days.filter((d) => d >= from && d <= to).length, isCurrent: i === n - 1 }
  })
}

export interface WeekProgress {
  count: number
  goal: number
  remaining: number
  /** days left in the week including today (1 on Sunday, 7 on Monday) */
  daysLeft: number
  met: boolean
}

export function currentWeek(visits: Visit[], now: Date, goal: number): WeekProgress {
  const count = weekCounts(visits, now, 1)[0].count
  return { count, goal, remaining: Math.max(0, goal - count), daysLeft: 7 - weekdayOf(now), met: count >= goal }
}

export interface Streaks {
  /** consecutive weeks that reached the goal, ending now; the unfinished week only adds when already met */
  current: number
  best: number
}

export function streaks(visits: Visit[], goal: number, now: Date): Streaks {
  const days = [...visitDays(visits)].sort()
  if (!days.length) return { current: 0, best: 0 }
  const thisMonday = mondayOf(now)
  let cursor = mondayOf(parseYmd(days[0]))
  const set = new Set(days)
  let run = 0
  let best = 0
  let lastCompletedRun = 0
  while (cursor <= thisMonday) {
    let count = 0
    for (let i = 0; i < 7; i++) if (set.has(ymd(addDays(cursor, i)))) count++
    const isCurrent = cursor.getTime() === thisMonday.getTime()
    if (count >= goal) {
      run++
      best = Math.max(best, run)
    } else if (!isCurrent) {
      run = 0 // a finished week below the goal breaks the streak; the running week never does
    }
    if (!isCurrent) lastCompletedRun = run
    cursor = addDays(cursor, 7)
  }
  const currentMet = weekCounts(visits, now, 1)[0].count >= goal
  return { current: currentMet ? lastCompletedRun + 1 : lastCompletedRun, best }
}

export const totalVisitDays = (visits: Visit[]) => visitDays(visits).size
export const lastVisitOn = (visits: Visit[]) => [...visitDays(visits)].sort().at(-1) ?? null
export const visitedToday = (visits: Visit[], now: Date) => visitDays(visits).has(ymd(now))

/** Whole days since the last visit (0 = today), null when there is none. */
export function daysSinceLastVisit(visits: Visit[], now: Date): number | null {
  const last = lastVisitOn(visits)
  return last ? Math.max(0, dayDiff(parseYmd(last), now)) : null
}

/** Average visit days per week over the last `weeks` COMPLETED weeks (fewer if the history is shorter). */
export function averagePerWeek(visits: Visit[], now: Date, weeks: number): number {
  const first = [...visitDays(visits)].sort()[0]
  if (!first) return 0
  const available = Math.max(0, Math.round(dayDiff(mondayOf(parseYmd(first)), mondayOf(now)) / 7)) // completed weeks since first
  const n = Math.min(weeks, available)
  if (n === 0) return 0
  const completed = weekCounts(visits, now, n + 1).slice(0, n)
  return completed.reduce((s, w) => s + w.count, 0) / n
}

/** Visits per weekday (Mon = 0) over the last `weeks` weeks, including this one. */
export function weekdayHistogram(visits: Visit[], now: Date, weeks = 8): number[] {
  const from = ymd(addDays(mondayOf(now), -7 * (weeks - 1)))
  const out = [0, 0, 0, 0, 0, 0, 0]
  for (const d of visitDays(visits)) if (d >= from) out[weekdayOf(parseYmd(d))]++
  return out
}

export interface Cell {
  date: string
  day: number
  inMonth: boolean
  visited: boolean // a counted workout
  other: boolean // only non-counting activity (e.g. recovery)
  isToday: boolean
  future: boolean
}

/** Calendar rows (Mon..Sun) covering `month` (0-11) of `year`. */
export function monthGrid(visits: Visit[], year: number, month: number, now: Date): Cell[][] {
  const days = visitDays(visits)
  const any = anyDays(visits)
  const today = ymd(now)
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const rows: Cell[][] = []
  for (let cur = mondayOf(first); cur <= last; cur = addDays(cur, 7)) {
    rows.push(
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(cur, i)
        const key = ymd(d)
        return { date: key, day: d.getDate(), inMonth: d.getMonth() === month, visited: days.has(key), other: !days.has(key) && any.has(key), isToday: key === today, future: key > today }
      }),
    )
  }
  return rows
}

// ---- badges --------------------------------------------------------------------------------------------
export interface Badge {
  key: string
  title: string
  desc: string
  unlocked: boolean
  value: number
  target: number
}

/** Total-visit milestones used by both the badge list and the Home insight line. */
export const VISIT_MILESTONES = [10, 25, 50, 100, 200]

const hourOf = (v: Visit) => (v.visited_at ? new Date(v.visited_at).getHours() : null)

/** Longest gap in days between two consecutive visit days. */
function longestGap(visits: Visit[]): number {
  const days = [...visitDays(visits)].sort()
  let gap = 0
  for (let i = 1; i < days.length; i++) gap = Math.max(gap, dayDiff(parseYmd(days[i - 1]), parseYmd(days[i])))
  return gap
}

export function badgesFor(visits: Visit[], goal: number, now: Date): Badge[] {
  const total = totalVisitDays(visits)
  const { best } = streaks(visits, goal, now)
  const bestWeek = Math.max(0, ...weekCounts(visits, now, 520).map((w) => w.count)) // up to 10 years
  const early = new Set(visits.filter((v) => counts(v) && (hourOf(v) ?? 99) < 8).map((v) => v.visited_on)).size
  const gap = longestGap(visits)
  const hitGoalOnce = weekCounts(visits, now, 520).some((w) => w.count >= goal)
  const typeKey = (v: Visit) => (v.activity === 'other' ? `other:${(v.activity_name ?? '').toLowerCase()}` : (v.activity ?? (v.source === 'class' ? 'class' : 'gym')))
  const byMonth = new Map<string, Set<string>>()
  for (const v of visits) {
    const m = v.visited_on.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? new Set()).add(typeKey(v)))
  }
  const versatile = Math.max(0, ...[...byMonth.values()].map((x) => x.size))
  const classesTried = new Set(visits.filter((v) => (v.activity === 'class' || v.source === 'class') && (v.class_id != null || v.class_name)).map((v) => v.class_id ?? v.class_name!.toLowerCase())).size
  const mk = (key: string, title: string, desc: string, value: number, target: number): Badge => ({ key, title, desc, value: Math.min(value, target), target, unlocked: value >= target })
  return [
    mk('first_visit', 'Langkah pertama', 'Catat latihan pertamamu', total, 1),
    ...VISIT_MILESTONES.map((n) => mk(`visits_${n}`, `${n} latihan`, `Total ${n} hari latihan`, total, n)),
    mk('goal_first', 'Target tercapai', 'Capai target mingguan untuk pertama kali', hitGoalOnce ? 1 : 0, 1),
    mk('streak_4', 'Konsisten 4 minggu', 'Capai target 4 minggu berturut-turut', best, 4),
    mk('streak_8', 'Konsisten 8 minggu', 'Capai target 8 minggu berturut-turut', best, 8),
    mk('streak_12', 'Konsisten 12 minggu', 'Capai target 12 minggu berturut-turut', best, 12),
    mk('streak_26', 'Konsisten 26 minggu', 'Capai target 26 minggu berturut-turut', best, 26),
    mk('week_5', 'Minggu padat', '5 hari latihan dalam satu minggu', bestWeek, 5),
    mk('early_bird', 'Si pagi', '5 latihan sebelum jam 08.00', early, 5),
    mk('comeback', 'Bangkit lagi', 'Kembali berlatih setelah jeda 14 hari atau lebih', gap >= 14 ? 1 : 0, 1),
    mk('versatile', 'Serba bisa', '3 jenis aktivitas berbeda dalam satu bulan', versatile, 3),
    mk('class_explorer', 'Pencoba kelas', 'Coba 5 kelas yang berbeda', classesTried, 5),
  ]
}

// ---- stats bundle, motivation, reminders ------------------------------------------------------------------
export interface Stats {
  week: WeekProgress
  streak: Streaks
  total: number
  today: boolean
  sinceLast: number | null
  avg4: number
  avg12: number
}

export function computeStats(visits: Visit[], goal: number, now: Date): Stats {
  return {
    week: currentWeek(visits, now, goal),
    streak: streaks(visits, goal, now),
    total: totalVisitDays(visits),
    today: visitedToday(visits, now),
    sinceLast: daysSinceLastVisit(visits, now),
    avg4: averagePerWeek(visits, now, 4),
    avg12: averagePerWeek(visits, now, 12),
  }
}

export type Situation = 'start' | 'done_today' | 'goal_met' | 'one_left' | 'behind' | 'comeback' | 'streak_keep' | 'steady'
export type Messages = Record<Situation, string[]> & { tips: string[] }

export interface Motivation {
  situation: Situation
  tone: 'good' | 'push' | 'neutral'
  text: string
  tip: string
}

const dayOfYear = (d: Date) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86_400_000)
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

/** Pick the message that fits the member's situation today; the variant rotates by day so it stays fresh. */
export function motivation(stats: Stats, now: Date, messages: Messages): Motivation {
  const { week, streak, total, today, sinceLast } = stats
  let situation: Situation
  if (total === 0) situation = 'start'
  else if (today && week.met) situation = 'goal_met'
  else if (today) situation = 'done_today'
  else if (week.met) situation = 'goal_met'
  else if (week.remaining === 1 && week.daysLeft >= 1) situation = 'one_left'
  else if (week.remaining > week.daysLeft || (weekdayOf(now) >= 2 && week.count === 0)) situation = 'behind'
  else if (sinceLast !== null && sinceLast >= 7) situation = 'comeback'
  else if (streak.current >= 2 && week.count === 0) situation = 'streak_keep'
  else situation = 'steady'

  const pool = messages[situation]
  const doy = dayOfYear(now)
  const vars = { n: week.count, goal: week.goal, remaining: week.remaining, streak: streak.current, days: sinceLast ?? 0, total }
  const tone: Motivation['tone'] = situation === 'goal_met' || situation === 'done_today' ? 'good' : situation === 'behind' || situation === 'comeback' || situation === 'one_left' ? 'push' : 'neutral'
  return { situation, tone, text: fill(pool[doy % pool.length], vars), tip: messages.tips[doy % messages.tips.length] }
}

export interface Reminder {
  show: boolean
  reason: 'risk' | 'usual_day' | null
  text: string
}

/**
 * In-app nudge. 'risk': the goal now needs a workout on (almost) every remaining day.
 * 'usual_day': today is a weekday the member usually trains on, it is past their reminder hour, and nothing is logged yet.
 */
export function reminder(visits: Visit[], settings: Settings, now: Date): Reminder {
  const stats = computeStats(visits, settings.goal_per_week, now)
  const none: Reminder = { show: false, reason: null, text: '' }
  if (stats.total === 0 || stats.today || stats.week.met) return none
  const { remaining, daysLeft } = stats.week
  if (remaining >= daysLeft) {
    return { show: true, reason: 'risk', text: `Target minggu ini butuh ${remaining} latihan lagi, tersisa ${daysLeft} hari. Hari ini waktu yang pas!` }
  }
  const hour = settings.reminder_hour ?? 17
  const usual = weekdayHistogram(visits, now, 6)[weekdayOf(now)]
  if (now.getHours() >= hour && usual >= 3) {
    return { show: true, reason: 'usual_day', text: 'Biasanya kamu latihan di hari ini. Sudah latihan? Catat atau sempatkan sebentar.' }
  }
  return none
}

// ---- activity breakdown and missing days -----------------------------------------------------------------
export interface BreakdownItem {
  key: string
  label: string
  emoji: string
  count: number
}

/** Entries per activity in the last `days` days (today included), plus the most frequent class. */
export function activityBreakdown(visits: Visit[], now: Date, days = 30): { items: BreakdownItem[]; total: number; topClass: { name: string; count: number } | null } {
  const from = ymd(addDays(now, -(days - 1)))
  const to = ymd(now)
  const items = new Map<string, BreakdownItem>()
  const classes = new Map<string, { name: string; count: number }>()
  let total = 0
  for (const v of visits) {
    if (v.visited_on < from || v.visited_on > to) continue
    total++
    const a = v.activity ?? (v.source === 'class' ? 'class' : 'gym')
    const key = a === 'other' ? `other:${(v.activity_name ?? '').toLowerCase()}` : a
    const meta = activityMeta(a)
    const cur = items.get(key) ?? { key, label: a === 'other' ? v.activity_name || 'Lainnya' : meta.label, emoji: meta.emoji, count: 0 }
    cur.count++
    items.set(key, cur)
    if (a === 'class' && v.class_name) {
      const c = classes.get(v.class_name.toLowerCase()) ?? { name: v.class_name, count: 0 }
      c.count++
      classes.set(v.class_name.toLowerCase(), c)
    }
  }
  const top = [...classes.values()].sort((x, y) => y.count - x.count || x.name.localeCompare(y.name))[0] ?? null
  return { items: [...items.values()].sort((x, y) => y.count - x.count || x.label.localeCompare(y.label)), total, topClass: top }
}

/**
 * Past days (yesterday backwards, at most `n`) with no recorded activity at all. Empty for a member with no
 * entries yet, and never reaches back before their first entry.
 */
export function missingDays(visits: Visit[], now: Date, n = 7): string[] {
  const days = anyDays(visits)
  const first = [...days].sort()[0]
  if (!first) return []
  const out: string[] = []
  for (let i = 1; i <= n; i++) {
    const d = ymd(addDays(now, -i))
    if (d < first) break
    if (!days.has(d)) out.push(d)
  }
  return out
}
