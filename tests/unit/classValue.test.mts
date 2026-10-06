// Run with: node tests/unit/classValue.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const c = await import(ROOT + '/src/lib/classValue.ts')
const ok = (n: string, v: boolean, x = '') => {
  if (!v) process.exitCode = 1
  console.log((v ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
const su = (id: number, on: string, status: string, price: number | null) => ({ schedule_id: id, class_name: 'X', scheduled_on: on, status, price })

ok('parsePrice: raw API string', c.parsePrice('75000.00') === 75000)
ok('parsePrice: number passes through', c.parsePrice(75000) === 75000)
ok('parsePrice: empty / junk / zero -> null', c.parsePrice('') === null && c.parsePrice('Rp. 75.000') === null && c.parsePrice('0.00') === null && c.parsePrice(undefined) === null)

const list = [
  su(1, '2026-10-01', 'planned', 75000),
  su(2, '2026-10-02', 'attended', 75000),
  su(3, '2026-10-03', 'cancelled', 75000),
  su(4, '2026-10-04', 'planned', null),
  su(5, '2026-09-20', 'attended', 75000),
]
{
  const r = c.classSavings(list, '2026-10-01', '2026-10-31')
  ok('classSavings: planned + attended count, cancelled / unpriced / out of range do not', r.saved === 150000 && r.count === 2, JSON.stringify(r))
}
ok('classSavings: inclusive window edges', c.classSavings(list, '2026-10-02', '2026-10-02').saved === 75000)
ok('classSavings: empty -> zero', c.classSavings([], '2026-10-01', '2026-10-31').saved === 0)

{
  const e = c.classEfficiency({ saved: 225000, spent: 1500000, visits: 10 })
  ok('classEfficiency: payback %', Math.abs(e.paybackPct - 15) < 1e-9 && !e.exceedsCost, JSON.stringify(e))
  ok('classEfficiency: effective cost per visit', e.effectivePerVisit === 127500, String(e.effectivePerVisit))
}
{
  const e = c.classEfficiency({ saved: 300000, spent: 200000, visits: 4 })
  ok('classEfficiency: savings beyond the membership cost', e.exceedsCost && e.effectivePerVisit === 0)
}
{
  const e = c.classEfficiency({ saved: 75000, spent: 0, visits: 0 })
  ok('classEfficiency: no spend / no visits -> null, not NaN', e.paybackPct === null && e.effectivePerVisit === null && !e.exceedsCost)
}
