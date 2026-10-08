// Run with: node tests/unit/tracker.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
import { readFileSync } from 'node:fs'
const R = ROOT.replace(/\/$/, '')
const t = await import(R + '/src/lib/tracker.ts')
const msgs = JSON.parse(readFileSync(R + '/src/data/motivation.json', 'utf8'))
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
let id = 0
const V = (...days: string[]) => days.map((d) => ({ client_id: 'c' + id++, visited_on: d, source: 'checkin' as const }))
const NOW = new Date(2026, 9, 1, 12, 0) // Thu 1 Oct 2026, noon

// dates
ok('mondayOf(Thu 1 Oct) = 28 Sep', t.ymd(t.mondayOf(NOW)) === '2026-09-28')
ok('mondayOf(Sunday 4 Oct) = 28 Sep', t.ymd(t.mondayOf(new Date(2026, 9, 4))) === '2026-09-28')
ok('year boundary: Monday of 1 Jan 2027 (Fri) = 28 Dec 2026', t.ymd(t.mondayOf(new Date(2027, 0, 1))) === '2026-12-28')

// current week
let v = V('2026-09-28', '2026-09-30', '2026-09-30') // duplicate day
let w = t.currentWeek(v, NOW, 3)
ok('distinct days: 2 visits, remaining 1, not met', w.count === 2 && w.remaining === 1 && !w.met)
ok('daysLeft on Thursday = 4; Monday = 7; Sunday = 1', w.daysLeft === 4 && t.currentWeek(v, new Date(2026, 8, 28), 3).daysLeft === 7 && t.currentWeek(v, new Date(2026, 9, 4), 3).daysLeft === 1)
ok('goal met flag', t.currentWeek(V('2026-09-28', '2026-09-29', '2026-09-30'), NOW, 3).met)

// weekCounts
const wc = t.weekCounts(V('2026-09-28', '2026-09-30', '2026-09-22', '2026-09-14', '2026-09-15', '2026-09-16'), NOW, 3)
ok('weekCounts oldest first, current last', wc.map((x: any) => x.weekStart + ':' + x.count).join() === '2026-09-14:3,2026-09-21:1,2026-09-28:2' && wc[2].isCurrent)

// streaks (goal 2)
let s = t.streaks(V('2026-09-07', '2026-09-08', '2026-09-14', '2026-09-15', '2026-09-22', '2026-09-28', '2026-09-29'), 2, NOW)
ok('a missed completed week resets; met current week adds 1 -> current 1, best 2', s.current === 1 && s.best === 2, JSON.stringify(s))
s = t.streaks(V('2026-09-14', '2026-09-15', '2026-09-21', '2026-09-22', '2026-09-28', '2026-09-29'), 2, NOW)
ok('three met weeks incl. current -> current 3', s.current === 3 && s.best === 3, JSON.stringify(s))
s = t.streaks(V('2026-09-14', '2026-09-15', '2026-09-21', '2026-09-22'), 2, NOW)
ok('unfinished current week never breaks the streak -> current 2', s.current === 2 && s.best === 2, JSON.stringify(s))
s = t.streaks(V('2026-09-14', '2026-09-15'), 2, NOW)
ok('last completed week missed -> current 0 (best kept)', s.current === 0 && s.best === 1, JSON.stringify(s))
ok('no visits -> 0/0', JSON.stringify(t.streaks([], 3, NOW)) === '{"current":0,"best":0}')
ok('streak across year boundary', t.streaks(V('2026-12-21', '2026-12-22', '2026-12-28', '2026-12-29', '2027-01-04', '2027-01-05'), 2, new Date(2027, 0, 6)).current === 3)

// averages / histogram
v = V(...[7, 14, 21].flatMap((d) => [`2026-09-${String(d).padStart(2, '0')}`, `2026-09-${String(d + 1).padStart(2, '0')}`]), '2026-09-28') // 3 completed weeks x2
ok('averagePerWeek over completed weeks = 2.0', t.averagePerWeek(v, NOW, 4) === 2, String(t.averagePerWeek(v, NOW, 4)))
ok('averagePerWeek: no data -> 0', t.averagePerWeek([], NOW, 4) === 0)
ok('weekdayHistogram counts Tuesdays', t.weekdayHistogram(V('2026-09-15', '2026-09-22', '2026-09-29'), NOW, 8)[1] === 3)

// calendar
const g = t.monthGrid(V('2026-10-01', '2026-10-03'), 2026, 9, NOW)
ok('Oct 2026 grid: 5 rows x 7, first cell 28 Sep outside month', g.length === 5 && g.every((r: any) => r.length === 7) && g[0][0].date === '2026-09-28' && !g[0][0].inMonth)
ok('visited / today / future flags', g[0][3].visited && g[0][3].isToday && g[0][5].visited && g[0][5].future && !g[0][4].visited)

// badges
const many = V(...Array.from({ length: 12 }, (_, i) => t.ymd(new Date(2026, 8, 1 + i * 2))))
const bs = t.badgesFor(many, 3, NOW); const B = (k: string) => bs.find((b: any) => b.key === k)
ok('12 days: first/10 unlocked, 25 locked with progress', B('first_visit').unlocked && B('visits_10').unlocked && !B('visits_25').unlocked && B('visits_25').value === 12 && B('visits_25').target === 25)
const early = [...Array(5)].map((_, i) => ({ client_id: 'e' + i, visited_on: t.ymd(new Date(2026, 8, 1 + i)), visited_at: new Date(2026, 8, 1 + i, 6, 30).toISOString(), source: 'checkin' as const }))
ok('early bird after 5 pre-08:00 visits', t.badgesFor(early, 3, NOW).find((b: any) => b.key === 'early_bird').unlocked && !t.badgesFor(early.slice(0, 4), 3, NOW).find((b: any) => b.key === 'early_bird').unlocked)
ok('comeback badge needs a 14+ day gap', t.badgesFor(V('2026-08-01', '2026-08-20'), 3, NOW).find((b: any) => b.key === 'comeback').unlocked && !t.badgesFor(V('2026-08-01', '2026-08-10'), 3, NOW).find((b: any) => b.key === 'comeback').unlocked)
ok('week_5 badge', t.badgesFor(V('2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'), 3, NOW).find((b: any) => b.key === 'week_5').unlocked)
ok('goal_first badge', t.badgesFor(V('2026-09-14', '2026-09-15', '2026-09-16'), 3, NOW).find((b: any) => b.key === 'goal_first').unlocked)
ok('no visits -> nothing unlocked', t.badgesFor([], 3, NOW).every((b: any) => !b.unlocked))

// motivation
const M = (vis: any[], goal = 3, now = NOW) => t.motivation(t.computeStats(vis, goal, now), now, msgs)
ok('no visits -> start', M([]).situation === 'start')
ok('visited today, goal not met -> done_today (good)', M(V('2026-10-01')).situation === 'done_today' && M(V('2026-10-01')).tone === 'good')
ok('goal met -> goal_met', M(V('2026-09-28', '2026-09-29', '2026-09-30')).situation === 'goal_met')
ok('1 left -> one_left', M(V('2026-09-14', '2026-09-28', '2026-09-30')).situation === 'one_left')
ok('Wednesday+ with 0 this week -> behind', M(V('2026-09-14'), 3, new Date(2026, 9, 1)).situation === 'behind')
ok('needs more visits than days left -> behind', M(V('2026-09-14'), 3, new Date(2026, 9, 3)).situation === 'behind')
ok('Monday, last visit 9 days ago -> comeback', M(V('2026-09-21'), 3, new Date(2026, 9, 5)).situation === 'comeback')
ok('streak 2 weeks, nothing yet this week (Monday) -> streak_keep', M(V('2026-09-14', '2026-09-15', '2026-09-16', '2026-09-21', '2026-09-22', '2026-09-23'), 3, new Date(2026, 8, 28)).situation === 'streak_keep')
ok('otherwise steady', M(V('2026-09-28', '2026-09-14'), 3, new Date(2026, 8, 29)).situation === 'steady', M(V('2026-09-28', '2026-09-14'), 3, new Date(2026, 8, 29)).situation)
const all = ['start', 'done_today', 'goal_met', 'one_left', 'behind', 'comeback', 'streak_keep', 'steady']
ok('every message pool has text and fills every {token}', all.every((k) => msgs[k].length >= 3 && msgs[k].every((m: string) => !!m)) && msgs.tips.length >= 10)
const filled = M(V('2026-09-14', '2026-09-28', '2026-09-30'))
ok('placeholders replaced', !/[{}]/.test(filled.text) && /\d/.test(filled.text) , filled.text)
ok('message rotates by day', new Set([0, 1, 2].map((d) => M(V('2026-09-28'), 3, new Date(2026, 9, 1 + d)).text)).size > 1)

// reminders
const S = { goal_per_week: 3, reminder_hour: 17 }
ok('no visits ever -> no reminder', !t.reminder([], S, NOW).show)
ok('already trained today -> no reminder', !t.reminder(V('2026-10-01'), S, NOW).show)
ok('goal met -> no reminder', !t.reminder(V('2026-09-28', '2026-09-29', '2026-09-30'), S, NOW).show)
const rr = t.reminder(V('2026-09-14'), S, new Date(2026, 9, 3, 9, 0)) // Sat: 3 needed, 2 days left
ok('risk: needs more visits than days left', rr.show && rr.reason === 'risk', rr.text)
const usual = V('2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24') // Thursdays
ok('usual weekday, after reminder hour, nothing logged -> usual_day', t.reminder(usual, S, new Date(2026, 9, 1, 18, 0)).reason === 'usual_day')
ok('usual weekday but before reminder hour -> quiet', !t.reminder(usual, S, new Date(2026, 9, 1, 9, 0)).show)
ok('non-usual weekday -> quiet', !t.reminder(usual, S, new Date(2026, 8, 28, 18, 0)).show)

// momentOn --------------------------------------------------------------------------------------
{
  const a = t.momentOn('2026-10-06', '17:00')
  ok('momentOn: HH:MM is that local date and time', a.getFullYear() === 2026 && a.getMonth() === 9 && a.getDate() === 6 && a.getHours() === 17 && a.getMinutes() === 0)
  const b = t.momentOn('2026-10-06', '08:15:00')
  ok('momentOn: HH:MM:SS (server format) is accepted', b.getHours() === 8 && b.getMinutes() === 15)
  ok('momentOn: missing / empty / garbage / out of range -> null', t.momentOn('2026-10-06', null) === null && t.momentOn('2026-10-06', '') === null && t.momentOn('2026-10-06', 'soon') === null && t.momentOn('2026-10-06', '25:00') === null && t.momentOn('2026-10-06', '10:75') === null)
  ok('momentOn: bad date -> null', t.momentOn('not-a-date', '10:00') === null)
}
