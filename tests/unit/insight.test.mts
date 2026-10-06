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

// favouriteWeekdays ---------------------------------------------------------------------------------
const lab = (v: any) => i.favouriteLabel(i.favouriteWeekdays(v, NOW, 8))
{
  // three Thursdays (2026-09-10/17/24), one Monday -> Thursday wins
  const v = V('2026-09-10', '2026-09-17', '2026-09-24', '2026-09-14')
  ok('favouriteWeekdays: clear winner', lab(v) === 'Kamis', lab(v))
}
ok('favouriteWeekdays: no data -> null', lab([]) === null)
{
  // one Monday, one Tuesday: tie -> both listed in calendar order
  const v = V('2026-09-15', '2026-09-14')
  ok('favouriteWeekdays: 2-way tie lists both', lab(v) === 'Senin & Selasa', lab(v))
}
{
  // Mon 09-14, Tue 09-15, Wed 09-16, Thu 09-17 all once: 4-way tie -> two most recent (Wed, Thu) + 2 more
  const v = V('2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17')
  const f = i.favouriteWeekdays(v, NOW, 8)
  ok('favouriteWeekdays: 4-way tie keeps the 2 most recent', f.days.join() === '2,3' && f.extra === 2, JSON.stringify(f))
  ok('favouriteWeekdays: 4-way tie label has the remainder', lab(v) === 'Rabu & Kamis (+2 hari lain)', lab(v))
}
{
  // 3-way tie where the oldest weekday is Monday: recency drops Monday, not "first in the week" order
  const v = V('2026-09-07', '2026-09-23', '2026-09-24')
  ok('favouriteWeekdays: 3-way tie drops the least recent', lab(v) === 'Rabu & Kamis (+1 hari lain)', lab(v))
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

// favouriteClassToday -------------------------------------------------------------------------------
const zumbaSlot = { wd: 3, start: '17:00', end: '18:00', name: 'ZUMBA PARTY', kelas: 'Zumba', instructor: null, packageId: 1, weeks: 4 }
const classVisit = (d: string) => ({ client_id: 'cv' + d, visited_on: d, source: 'class' as const, activity: 'class' as const, class_name: 'ZUMBA PARTY' })
{
  const visits = [classVisit('2026-09-10'), classVisit('2026-09-17'), classVisit('2026-09-24')]
  const res = i.favouriteClassToday({ visits, now: NOW, slots: [zumbaSlot], signups: [] })
  ok('favouriteClassToday: favourite predicted today, not signed up -> match', res?.className === 'ZUMBA PARTY' && res?.start === '17:00', JSON.stringify(res))
}
{
  const visits = [classVisit('2026-09-10'), classVisit('2026-09-17'), classVisit('2026-09-24')]
  const signups = [{ schedule_id: 1, class_name: 'ZUMBA PARTY', scheduled_on: '2026-10-01', start_time: '17:00', status: 'planned' as const }]
  const res = i.favouriteClassToday({ visits, now: NOW, slots: [zumbaSlot], signups })
  ok('favouriteClassToday: already signed up today -> null', res === null, JSON.stringify(res))
}
{
  const visits = [classVisit('2026-09-10'), classVisit('2026-09-17'), classVisit('2026-09-24')]
  const res = i.favouriteClassToday({ visits, now: NOW, slots: [], signups: [] })
  ok('favouriteClassToday: no matching slot today -> null', res === null, JSON.stringify(res))
}
{
  const visits = [classVisit('2026-09-10'), classVisit('2026-09-17')] // only 2x, below the confidence threshold
  const res = i.favouriteClassToday({ visits, now: NOW, slots: [zumbaSlot], signups: [] })
  ok('favouriteClassToday: below count threshold -> null', res === null, JSON.stringify(res))
}

// noTrackingNudge -------------------------------------------------------------------------------------
ok('noTrackingNudge: no history -> null', i.noTrackingNudge(null) === null)
ok('noTrackingNudge: below threshold -> null', i.noTrackingNudge(2) === null)
ok('noTrackingNudge: at threshold -> text', i.noTrackingNudge(3)?.includes('3 hari'))
ok('noTrackingNudge: well past threshold -> text', i.noTrackingNudge(10)?.includes('10 hari'))
