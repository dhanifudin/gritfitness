// Budget analysis: what the member paid GritFitness against how often they actually trained there.
// Pure functions (no Vue, no I/O) so they can be unit-tested with plain Node.
//
// "GritFitness activity" deliberately excludes the custom 'other' entries (Hyrox, running, …): those
// are not GritFitness services and have no fee attached, so they must not dilute the cost math. This is
// a different filter from tracker.ts's `counts` (which excludes recovery from the weekly goal, even
// though recovery *is* a paid GritFitness service and belongs here).
import { addDays, ymd, type Visit } from './tracker.ts'

export interface BillLike {
  status: string
  tanggal_invoice: string // 'YYYY-MM-DD HH:MM:SS'
  total_tagihan: string // raw numeric string, e.g. "1491750.00"
}

export const isPaid = (status: string) => status === 'Lunas' || status === 'Dibayar'
export const isGritActivity = (v: Pick<Visit, 'activity'>) => (v.activity ?? 'gym') !== 'other'

const billMonth = (b: BillLike) => b.tanggal_invoice.slice(0, 7) // 'YYYY-MM'
const billDate = (b: BillLike) => b.tanggal_invoice.slice(0, 10) // 'YYYY-MM-DD'
const amount = (b: BillLike) => Number(b.total_tagihan) || 0

export interface MonthSpend {
  month: string // 'YYYY-MM'
  total: number
}

/** Paid amount per calendar month, oldest first, for the last `months` months including the current one. */
export function monthlySpend(bills: BillLike[], now: Date, months = 6): MonthSpend[] {
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const byMonth = new Map<string, number>()
  for (const b of bills) {
    if (!isPaid(b.status)) continue
    const k = billMonth(b)
    byMonth.set(k, (byMonth.get(k) ?? 0) + amount(b))
  }
  return keys.map((month) => ({ month, total: byMonth.get(month) ?? 0 }))
}

/** Total paid in the given inclusive date range ('YYYY-MM-DD'); no range = all paid bills. */
export function totalSpent(bills: BillLike[], range?: { from: string; to: string }): number {
  return bills
    .filter((b) => isPaid(b.status))
    .filter((b) => !range || (billDate(b) >= range.from && billDate(b) <= range.to))
    .reduce((sum, b) => sum + amount(b), 0)
}

/** Distinct days with at least one GritFitness activity (any type except 'other') in an inclusive range. */
export function gritVisitDays(visits: Visit[], from: string, to: string): number {
  const days = new Set(visits.filter((v) => isGritActivity(v) && v.visited_on >= from && v.visited_on <= to).map((v) => v.visited_on))
  return days.size
}

export interface CostPerVisit {
  spent: number
  visits: number
  /** null when there were no GritFitness visits in the window, to avoid a divide-by-zero */
  perVisit: number | null
}

/** Paid spend vs GritFitness training days over the trailing `days` days (today included). */
export function costPerVisit(bills: BillLike[], visits: Visit[], now: Date, days = 30): CostPerVisit {
  const from = ymd(addDays(now, -(days - 1)))
  const to = ymd(now)
  const spent = totalSpent(bills, { from, to })
  const n = gritVisitDays(visits, from, to)
  return { spent, visits: n, perVisit: n > 0 ? spent / n : null }
}

export interface UnpaidSummary {
  count: number
  total: number
}

export function unpaidSummary(bills: BillLike[]): UnpaidSummary {
  const unpaid = bills.filter((b) => !isPaid(b.status))
  return { count: unpaid.length, total: unpaid.reduce((sum, b) => sum + amount(b), 0) }
}

export interface OtherActivitySpend {
  total: number
  /** entries with a cost entered; a custom activity logged without one isn't counted, not assumed free */
  count: number
}

/** Spend on non-GritFitness ('other') activities with a cost entered, over the trailing `days` days (today included). */
export function otherActivitySpend(visits: Visit[], now: Date, days = 30): OtherActivitySpend {
  const from = ymd(addDays(now, -(days - 1)))
  const to = ymd(now)
  const costed = visits.filter((v) => !isGritActivity(v) && v.visited_on >= from && v.visited_on <= to && v.cost != null)
  return { total: costed.reduce((sum, v) => sum + (v.cost ?? 0), 0), count: costed.length }
}
