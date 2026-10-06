// What free class registration is worth to a member. Classes are free for members but paid for
// non-members, so the (non-member) price of a class the member registered for is money the
// membership saved them. Pure, no Vue/network — unit-testable with plain Node.
import type { Signup } from './trackerData.ts'

/** "75000.00" -> 75000; anything that is not a positive number -> null. */
export function parsePrice(raw: string | number | null | undefined): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface ClassSavings {
  saved: number
  count: number
}

/** Sum of the priced, non-cancelled sign-ups whose class date falls in the inclusive range ('YYYY-MM-DD'). */
export function classSavings(signups: Signup[], from: string, to: string): ClassSavings {
  let saved = 0
  let count = 0
  for (const s of signups) {
    if (s.status === 'cancelled' || s.price == null || s.price <= 0) continue
    if (s.scheduled_on < from || s.scheduled_on > to) continue
    saved += s.price
    count++
  }
  return { saved, count }
}

export interface ClassEfficiency {
  saved: number
  /** saved / membership spend over the same window; null without any spend to compare against */
  paybackPct: number | null
  /** true when the classes alone are worth more than the membership cost */
  exceedsCost: boolean
  /** (spend - saved) / training days, never negative; null without training days */
  effectivePerVisit: number | null
}

export function classEfficiency(args: { saved: number; spent: number; visits: number }): ClassEfficiency {
  const { saved, spent, visits } = args
  return {
    saved,
    paybackPct: spent > 0 ? (saved / spent) * 100 : null,
    exceedsCost: spent > 0 && saved > spent,
    effectivePerVisit: visits > 0 ? Math.max(0, spent - saved) / visits : null,
  }
}
