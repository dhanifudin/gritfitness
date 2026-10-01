// Run with: node tests/unit/budget.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
const b = await import(ROOT + 'src/lib/budget.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}

const NOW = new Date(2026, 9, 1, 12, 0) // Thu 1 Oct 2026
let vid = 0
const V = (day: string, activity = 'gym') => ({ client_id: 'v' + vid++, visited_on: day, source: 'manual' as const, activity })
const bill = (invoice: string, total: string, status = 'Lunas') => ({ status, tanggal_invoice: invoice, total_tagihan: total })

// ---- isGritActivity / isPaid ----
ok('isGritActivity: gym/class/pt/recovery are Grit, other is not', b.isGritActivity({ activity: 'gym' }) && b.isGritActivity({ activity: 'class' }) && b.isGritActivity({ activity: 'pt' }) && b.isGritActivity({ activity: 'recovery' }) && !b.isGritActivity({ activity: 'other' }))
ok('isGritActivity: missing activity defaults to gym (counted)', b.isGritActivity({}))
ok('isPaid: Lunas and Dibayar only', b.isPaid('Lunas') && b.isPaid('Dibayar') && !b.isPaid('Belum Dibayar') && !b.isPaid('Belum Lunas') && !b.isPaid('Expired'))

// ---- monthlySpend ----
const bills = [
  bill('2026-08-05 10:00:00', '1000000.00'),
  bill('2026-09-10 10:00:00', '500000.00'),
  bill('2026-09-20 10:00:00', '250000.00'),
  bill('2026-10-01 10:00:00', '300000.00'),
  bill('2026-09-15 10:00:00', '999999.00', 'Belum Dibayar'), // unpaid: excluded
]
const ms = b.monthlySpend(bills, NOW, 3)
ok('monthlySpend: 3 months oldest first, current last', ms.map((m: any) => m.month).join() === '2026-08,2026-09,2026-10')
ok('monthlySpend: sums paid bills per month, ignores unpaid', ms[0].total === 1000000 && ms[1].total === 750000 && ms[2].total === 300000)
ok('monthlySpend: a month with no bills is 0, not missing', b.monthlySpend([], NOW, 2).every((m: any) => m.total === 0))

// ---- totalSpent ----
ok('totalSpent: all paid bills, no range', b.totalSpent(bills) === 1000000 + 500000 + 250000 + 300000)
ok('totalSpent: within a range excludes outside dates and unpaid', b.totalSpent(bills, { from: '2026-09-01', to: '2026-09-30' }) === 750000)
ok('totalSpent: empty list is 0', b.totalSpent([]) === 0)

// ---- gritVisitDays ----
const visits = [V('2026-09-28'), V('2026-09-29', 'class'), V('2026-09-29', 'pt'), V('2026-09-30', 'recovery'), V('2026-09-27', 'other')]
ok('gritVisitDays: counts recovery, excludes other, same-day dup counts once', b.gritVisitDays(visits, '2026-09-27', '2026-09-30') === 3)
ok('gritVisitDays: range excludes the Hyrox-only day entirely when narrowed', b.gritVisitDays(visits, '2026-09-28', '2026-09-30') === 3 && b.gritVisitDays(visits, '2026-09-27', '2026-09-27') === 0)
ok('gritVisitDays: no visits -> 0', b.gritVisitDays([], '2026-01-01', '2026-12-31') === 0)

// ---- costPerVisit ----
const cpv = b.costPerVisit(bills, visits, NOW, 30)
ok('costPerVisit: spent sums the trailing-30-day paid bills', cpv.spent === 750000 + 300000, JSON.stringify(cpv))
ok('costPerVisit: visits excludes the Hyrox day (3, not 4)', cpv.visits === 3)
ok('costPerVisit: perVisit = spent / visits', Math.abs(cpv.perVisit - (750000 + 300000) / 3) < 1e-9)
ok('costPerVisit: zero visits -> perVisit null (no divide by zero)', b.costPerVisit(bills, [V('2026-01-01', 'other')], NOW, 30).perVisit === null)
ok('costPerVisit: zero spend but visits -> perVisit 0', b.costPerVisit([], visits, NOW, 30).perVisit === 0)

// ---- unpaidSummary ----
const us = b.unpaidSummary(bills)
ok('unpaidSummary: counts and sums only non-paid statuses', us.count === 1 && us.total === 999999)
ok('unpaidSummary: all paid -> zero', b.unpaidSummary([bill('2026-09-01 00:00:00', '100', 'Lunas')]).count === 0)
ok('unpaidSummary: empty -> zero', b.unpaidSummary([]).count === 0 && b.unpaidSummary([]).total === 0)
