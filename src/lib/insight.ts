// Pure, Vue-free helpers for the Home screen's trend sentence and rotating insight line.
// No fabricated numbers: every candidate here is grounded in data the member actually has.
import type { CostPerVisit } from './budget.ts'
import { VISIT_MILESTONES, type Streaks, type Visit, visitDays, weekCounts, weekdayHistogram } from './tracker.ts'

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

/** The weekday (Mon..Sun) the member visits most over the last `weeks` weeks, or null without a clear favourite. */
export function favouriteWeekday(visits: Visit[], now: Date, weeks = 8): string | null {
  const hist = weekdayHistogram(visits, now, weeks)
  const max = Math.max(...hist)
  if (max === 0) return null
  if (hist.filter((c) => c === max).length > 1) return null // tie: no clear favourite
  return WEEKDAY_NAMES[hist.indexOf(max)]
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

  const fav = favouriteWeekday(visits, now)
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
