// Pure, Vue-free helpers for the Home screen's trend sentence, Act-zone nudges and rotating insight
// line. No fabricated numbers: every candidate here is grounded in data the member actually has.
// Kept framework-free (no Vue/browser imports) so the same decision functions can run inside a Deno
// Edge Function for push notifications without disagreeing with what the in-app UI shows.
import type { CostPerVisit } from './budget.ts'
import type { Signup } from './trackerData.ts'
import type { Slot } from './timetable.ts'
import { VISIT_MILESTONES, activityBreakdown, addDays, mondayOf, parseYmd, type Streaks, type Visit, visitDays, weekCounts, weekdayHistogram, weekdayOf, ymd } from './tracker.ts'

const WEEKDAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

const dayOfYear = (d: Date) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86_400_000)

export interface WeekTrend {
  recent: number
  /** average for the `weeks` completed weeks before the recent window; null when history doesn't fully cover it */
  prior: number | null
}

/** Average visit days/week for the most recent `weeks` (including the current, partial one) vs the `weeks` before that. */
export function weekTrend(visits: Visit[], now: Date, weeks = 4): WeekTrend {
  const all = weekCounts(visits, now, weeks * 2)
  const prior = all.slice(0, weeks)
  const recent = all.slice(weeks)
  const recentAvg = recent.reduce((s, w) => s + w.count, 0) / weeks
  const first = [...visitDays(visits)].sort()[0]
  const priorCovered = !!first && first <= prior[0].weekStart
  const priorAvg = priorCovered ? prior.reduce((s, w) => s + w.count, 0) / weeks : null
  return { recent: recentAvg, prior: priorAvg }
}

export interface FavouriteWeekdays {
  /** weekday indexes (Mon = 0) in calendar order, at most `limit` of them */
  days: number[]
  /** further weekdays tied for most visits that are not listed */
  extra: number
}

/**
 * The weekday(s) the member visits most over the last `weeks` weeks. Every weekday tied for the top count
 * is a favourite; when more than `limit` tie, the ones with the most recent visit are kept (recent habit
 * says more than an arbitrary weekday order) and the rest are only counted in `extra`.
 */
export function favouriteWeekdays(visits: Visit[], now: Date, weeks = 8, limit = 2): FavouriteWeekdays {
  const hist = weekdayHistogram(visits, now, weeks)
  const max = Math.max(...hist)
  if (max === 0) return { days: [], extra: 0 }
  const tied = hist.flatMap((c, i) => (c === max ? [i] : []))
  if (tied.length <= limit) return { days: tied, extra: 0 }

  const from = ymd(addDays(mondayOf(now), -7 * (weeks - 1)))
  const latest = new Map<number, string>()
  for (const d of visitDays(visits)) {
    if (d < from) continue
    const w = weekdayOf(parseYmd(d))
    if (d > (latest.get(w) ?? '')) latest.set(w, d)
  }
  const kept = [...tied]
    .sort((a, b) => (latest.get(b) ?? '').localeCompare(latest.get(a) ?? '') || a - b)
    .slice(0, limit)
    .sort((a, b) => a - b)
  return { days: kept, extra: tied.length - kept.length }
}

/** "Senin & Kamis" or "Senin & Kamis (+2 hari lain)"; null when there is no data. */
export function favouriteLabel(f: FavouriteWeekdays): string | null {
  if (!f.days.length) return null
  return f.days.map((d) => WEEKDAY_NAMES[d]).join(' & ') + (f.extra ? ` (+${f.extra} hari lain)` : '')
}

export interface FavouriteClassToday {
  className: string
  start: string
}

/**
 * The member's favourite class (from real attendance, last 30 days, at least 3 visits so one-off
 * classes don't count) when it's predicted to run today and the member hasn't signed up or attended
 * it yet today. Null when there's no clear favourite, it's not predicted today, or it's already handled.
 */
export function favouriteClassToday(args: { visits: Visit[]; now: Date; slots: Slot[]; signups: Signup[] }): FavouriteClassToday | null {
  const { visits, now, slots, signups } = args
  const { topClass } = activityBreakdown(visits, now, 30)
  if (!topClass || topClass.count < 3) return null

  const wd = weekdayOf(now)
  const today = ymd(now)
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const slot = slots.find((s) => s.wd === wd && s.start > nowTime && (s.name.toLowerCase() === topClass.name.toLowerCase() || s.kelas.toLowerCase() === topClass.name.toLowerCase()))
  if (!slot) return null

  const alreadyHandled = signups.some((s) => s.scheduled_on === today && s.status !== 'cancelled' && s.class_name.toLowerCase() === slot.name.toLowerCase())
  if (alreadyHandled) return null

  return { className: topClass.name, start: slot.start }
}

/** "Haven't tracked in a while" text once `sinceLast` reaches the threshold; null otherwise (or with no history yet). */
export function noTrackingNudge(sinceLast: number | null, threshold = 3): string | null {
  if (sinceLast == null || sinceLast < threshold) return null
  return `Sudah ${sinceLast} hari sejak latihan terakhir. Yuk balik lagi!`
}

export interface DailyInsight {
  kind: 'milestone' | 'weekday' | 'cpv' | 'streak'
  text: string
}

/** One sentence, rotated by day-of-year among only the candidates backed by real data. Null for a brand-new member. */
export function dailyInsight(
  args: { visits: Visit[]; now: Date; total: number; streak: Streaks; cpv: CostPerVisit },
  rupiah: (n: number) => string,
): DailyInsight | null {
  const { visits, now, total, streak, cpv } = args
  const candidates: DailyInsight[] = []

  const nextMilestone = VISIT_MILESTONES.find((m) => m > total)
  if (total > 0 && nextMilestone && !VISIT_MILESTONES.includes(total)) {
    candidates.push({ kind: 'milestone', text: `${total} latihan sejauh ini — ${nextMilestone - total} lagi menuju ${nextMilestone}.` })
  }

  const fav = favouriteLabel(favouriteWeekdays(visits, now))
  if (fav) candidates.push({ kind: 'weekday', text: `${fav} biasanya jadi hari latihanmu.` })

  if (cpv.perVisit != null) {
    candidates.push({ kind: 'cpv', text: `${rupiah(cpv.perVisit)} per latihan bulan ini.` })
  }

  if (streak.best >= 2 && streak.current === streak.best) {
    candidates.push({ kind: 'streak', text: `${streak.best} minggu beruntun — rantai terpanjangmu sejauh ini.` })
  }

  if (!candidates.length) return null
  return candidates[dayOfYear(now) % candidates.length]
}
