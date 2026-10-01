// Run with: node tests/unit/activities.test.mts   (Node 22+, type stripping)
import { readFileSync } from 'node:fs'
const ROOT = new URL('../../', import.meta.url).pathname
const t = await import(ROOT + 'src/lib/tracker.ts')
const a = await import(ROOT + 'src/lib/activities.ts')
const classInfo = JSON.parse(readFileSync(ROOT + 'src/data/classInfo.json', 'utf8'))
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
let id = 0
const V = (day: string, extra: Record<string, unknown> = {}) => ({ client_id: 'v' + id++, visited_on: day, source: 'manual' as const, ...extra })
const NOW = new Date(2026, 9, 1, 12, 0) // Thu 1 Oct 2026

// ---- counting rule ----
const rec = V('2026-09-30', { activity: 'recovery', counts_toward_goal: false })
ok('recovery does not count toward the week', t.currentWeek([rec], NOW, 3).count === 0)
ok('...but the day is still an activity day (calendar "other")', t.anyDays([rec]).has('2026-09-30') && t.visitDays([rec]).size === 0)
const grid = t.monthGrid([rec, V('2026-10-01', { activity: 'gym' })], 2026, 8, NOW).flat()
ok('calendar: counted day visited, recovery-only day flagged other', grid.find((c: any) => c.date === '2026-10-01')?.visited !== undefined && grid.find((c: any) => c.date === '2026-09-30').other === true && grid.find((c: any) => c.date === '2026-09-30').visited === false)
ok('custom activity with counts=true counts (Hyrox)', t.currentWeek([V('2026-09-29', { activity: 'other', activity_name: 'Hyrox', counts_toward_goal: true })], NOW, 3).count === 1)
ok('custom activity with counts=false does not', t.currentWeek([V('2026-09-29', { activity: 'other', activity_name: 'Jalan santai', counts_toward_goal: false })], NOW, 3).count === 0)
ok('old rows without the field still count', t.currentWeek([V('2026-09-29')], NOW, 3).count === 1)
ok('two entries on one day count once (workout + recovery too)', t.currentWeek([V('2026-09-29'), V('2026-09-29', { activity: 'class', class_name: 'Zumba' }), V('2026-09-29', { activity: 'recovery', counts_toward_goal: false })], NOW, 3).count === 1)
ok('recovery never breaks or builds a streak', t.streaks([V('2026-09-14', { counts_toward_goal: false, activity: 'recovery' }), V('2026-09-15', { counts_toward_goal: false, activity: 'recovery' })], 2, NOW).best === 0)
ok('motivation/reminder ignore recovery-only members (treated as no visits)', t.computeStats([rec], 3, NOW).total === 0)

// ---- backfill ----
const base = [V('2026-09-14'), V('2026-09-15'), V('2026-09-28'), V('2026-09-29')] // week of 14 Sep: 2, week of 21 Sep: 0, this week: 2 (goal 2)
let s = t.streaks(base, 2, NOW)
ok('before backfill: missed week 21 Sep resets the streak', s.current === 1 && s.best === 1, JSON.stringify(s))
s = t.streaks([...base, V('2026-09-22'), V('2026-09-23')], 2, NOW)
ok('back-filling the missing week repairs the streak (3 weeks)', s.current === 3 && s.best === 3, JSON.stringify(s))
ok('a back-dated entry lands in the right week bar', t.weekCounts([...base, V('2026-09-22')], NOW, 3).map((w: any) => w.count).join() === '2,1,2')

// ---- breakdown ----
const mix = [V('2026-09-30', { activity: 'class', class_name: 'Zumba' }), V('2026-09-28', { activity: 'class', class_name: 'Zumba' }), V('2026-09-25', { activity: 'class', class_name: 'Yoga all Level' }), V('2026-09-27', { activity: 'other', activity_name: 'Hyrox' }), V('2026-09-20', { activity: 'other', activity_name: 'hyrox' }), V('2026-09-29', { activity: 'pt' }), V('2026-06-01', { activity: 'gym' })]
const bd = t.activityBreakdown(mix, NOW, 30)
ok('breakdown: 6 entries in 30 days (old one excluded)', bd.total === 6)
ok('breakdown groups custom names case-insensitively and counts classes together', bd.items.find((i: any) => i.label === 'Hyrox').count === 2 && bd.items.find((i: any) => i.key === 'class').count === 3)
ok('top class = Zumba x2', bd.topClass?.name === 'Zumba' && bd.topClass.count === 2)
ok('breakdown sorted by count desc', bd.items[0].count >= bd.items.at(-1).count)

// ---- missing days ----
ok('missingDays: none for a brand-new member', t.missingDays([], NOW).length === 0)
ok('missingDays: yesterday missing when only older entries', t.missingDays([V('2026-09-27')], NOW).join() === '2026-09-30,2026-09-29,2026-09-28')
ok('missingDays: a recovery entry fills the day', !t.missingDays([V('2026-09-27'), V('2026-09-30', { activity: 'recovery', counts_toward_goal: false })], NOW).includes('2026-09-30'))
ok('missingDays: never reaches before the first entry', !t.missingDays([V('2026-09-29')], NOW).includes('2026-09-28'))
ok('missingDays: capped at n days', t.missingDays([V('2026-08-01')], NOW, 3).length === 3)
ok('missingDays: today is never "missing"', !t.missingDays([V('2026-09-20')], NOW).includes('2026-10-01'))

// ---- badges ----
const bs = (v: any[]) => t.badgesFor(v, 3, NOW)
const B = (v: any[], k: string) => bs(v).find((b: any) => b.key === k)
ok('Serba bisa: 3 different activity types in one month', B([V('2026-09-01'), V('2026-09-02', { activity: 'class', class_name: 'Zumba' }), V('2026-09-03', { activity: 'other', activity_name: 'Hyrox' })], 'versatile').unlocked && !B([V('2026-09-01'), V('2026-09-02', { activity: 'class', class_name: 'Zumba' })], 'versatile').unlocked)
ok('Serba bisa: types in different months do not combine', !B([V('2026-07-01'), V('2026-08-02', { activity: 'pt' }), V('2026-09-03', { activity: 'other', activity_name: 'X' })], 'versatile').unlocked)
const five = ['Zumba', 'Yoga all Level', 'Boxing', 'Pound', 'Barre'].map((n, i) => V(`2026-09-0${i + 1}`, { activity: 'class', class_name: n }))
ok('Pencoba kelas after 5 different classes (not 4, not repeats)', B(five, 'class_explorer').unlocked && !B(five.slice(0, 4), 'class_explorer').unlocked && !B([...five.slice(0, 4), V('2026-09-09', { activity: 'class', class_name: 'zumba' })], 'class_explorer').unlocked)
ok('early bird ignores non-counting entries', !B(Array.from({ length: 5 }, (_, i) => V(`2026-09-0${i + 1}`, { activity: 'recovery', counts_toward_goal: false, visited_at: new Date(2026, 8, i + 1, 6, 0).toISOString() })), 'early_bird').unlocked)

// ---- activity helpers ----
ok('labels', a.activityLabel({ activity: 'class', class_name: 'Zumba' }) === 'Zumba' && a.activityLabel({ activity: 'other', activity_name: 'Hyrox' }) === 'Hyrox' && a.activityLabel({ activity: 'pt' }) === 'Personal Trainer' && a.activityLabel({}) === 'Gym')
ok('defaults: only recovery does not count', a.ACTIVITIES.filter((x: any) => !x.counts).map((x: any) => x.key).join() === 'recovery')
const groups = a.classGroups(classInfo)
ok('class groups: 3 categories, 28 classes, sorted', groups.length === 3 && groups.reduce((n: number, g: any) => n + g.classes.length, 0) === 28 && groups[0].category <= groups[1].category)
const yoga = a.searchClasses(groups, 'YOGA').flatMap((g: any) => g.classes.map((c: any) => c.name))
ok('search "yoga" finds the yoga classes only', yoga.length === 3 && yoga.every((n: string) => /yoga/i.test(n)), yoga.join(', '))
ok('empty search returns everything; no match returns none', a.searchClasses(groups, '  ').length === 3 && a.searchClasses(groups, 'zzz').length === 0)
