// Run with: node tests/unit/insight.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
const R = ROOT.replace(/\/$/, '')
const i = await import(R + '/src/lib/insight.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
let id = 0
const V = (...days: string[]) => days.map((d) => ({ client_id: 'c' + id++, visited_on: d, source: 'checkin' as const }))
const NOW = new Date(2026, 9, 1, 12, 0) // Thu 1 Oct 2026, noon
const rupiah = (n: number) => `Rp${n}`
const noCpv = { spent: 0, visits: 0, perVisit: null }

// weekTrend --------------------------------------------------------------------------------------
{
  // member only 2 weeks old: the 4-weeks-before window isn't covered -> prior must be null, not a fabricated 0
  const v = V('2026-09-28', '2026-09-29', '2026-09-22')
  const tr = i.weekTrend(v, NOW, 4)
  ok('weekTrend: short history -> prior null', tr.prior === null, JSON.stringify(tr))
}
{
  // 8+ full weeks of history: prior window fully covered -> real number
  const v = V('2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22', '2026-09-28', '2026-09-29', '2026-09-30')
  const tr = i.weekTrend(v, NOW, 4)
  ok('weekTrend: long history -> prior is a number', typeof tr.prior === 'number', JSON.stringify(tr))
  ok('weekTrend: recent reflects the last 4 weeks incl. current', tr.recent === 3 / 4, JSON.stringify(tr))
}
ok('weekTrend: no visits -> recent 0, prior null', i.weekTrend([], NOW, 4).recent === 0 && i.weekTrend([], NOW, 4).prior === null)

// favouriteWeekday ---------------------------------------------------------------------------------
{
  // three Thursdays (2026-09-10/17/24), one Monday -> Thursday wins
  const v = V('2026-09-10', '2026-09-17', '2026-09-24', '2026-09-14')
  ok('favouriteWeekday: clear winner', i.favouriteWeekday(v, NOW, 8) === 'Kamis', i.favouriteWeekday(v, NOW, 8))
}
ok('favouriteWeekday: no data -> null', i.favouriteWeekday([], NOW, 8) === null)
{
  // one Monday, one Tuesday: tie -> null
  const v = V('2026-09-14', '2026-09-15')
  ok('favouriteWeekday: tie -> null', i.favouriteWeekday(v, NOW, 8) === null)
}

// dailyInsight --------------------------------------------------------------------------------------
ok('dailyInsight: brand-new member -> null', i.dailyInsight({ visits: [], now: NOW, total: 0, streak: { current: 0, best: 0 }, cpv: noCpv }, rupiah) === null)
{
  // only cpv eligible
  const res = i.dailyInsight({ visits: [], now: NOW, total: 0, streak: { current: 0, best: 0 }, cpv: { spent: 90000, visits: 3, perVisit: 30000 } }, rupiah)
  ok('dailyInsight: cpv-only candidate picked', res?.kind === 'cpv', JSON.stringify(res))
}
{
  // total exactly on a milestone -> no milestone candidate (already unlocked, redundant)
  const res = i.dailyInsight({ visits: [], now: NOW, total: 10, streak: { current: 0, best: 0 }, cpv: noCpv }, rupiah)
  ok('dailyInsight: exactly-at-milestone -> no eligible candidate -> null', res === null, JSON.stringify(res))
}
{
  // streak callout only when current run IS the best (and >=2)
  const res = i.dailyInsight({ visits: [], now: NOW, total: 0, streak: { current: 3, best: 3 }, cpv: noCpv }, rupiah)
  ok('dailyInsight: best-streak-ever candidate picked', res?.kind === 'streak', JSON.stringify(res))
  const res2 = i.dailyInsight({ visits: [], now: NOW, total: 0, streak: { current: 1, best: 3 }, cpv: noCpv }, rupiah)
  ok('dailyInsight: not-the-best-streak -> not eligible -> null', res2 === null, JSON.stringify(res2))
}
{
  // several eligible candidates -> rotates by day-of-year, deterministic for a fixed date
  const args = { visits: [], now: NOW, total: 7, streak: { current: 2, best: 2 }, cpv: { spent: 90000, visits: 3, perVisit: 30000 } }
  const a = i.dailyInsight(args, rupiah)
  const b = i.dailyInsight(args, rupiah)
  ok('dailyInsight: deterministic for the same day', a?.kind === b?.kind && a?.text === b?.text, JSON.stringify([a, b]))
  const kinds = new Set([
    i.dailyInsight({ ...args, now: new Date(2026, 9, 1) }, rupiah)?.kind,
    i.dailyInsight({ ...args, now: new Date(2026, 9, 2) }, rupiah)?.kind,
    i.dailyInsight({ ...args, now: new Date(2026, 9, 3) }, rupiah)?.kind,
  ])
  ok('dailyInsight: rotates across days among eligible candidates', kinds.size > 1, JSON.stringify([...kinds]))
}
