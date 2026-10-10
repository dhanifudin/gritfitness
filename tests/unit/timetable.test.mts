// Run with: node tests/unit/timetable.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
const t = await import(ROOT + 'src/lib/timetable.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
const d = (s: string) => new Date(s + 'T10:00:00')
// weekDates
const w0 = t.weekDates(0, d('2026-10-01'))
ok('week of 2026-10-01 starts Mon 28 Sep, ends Sun 4 Oct', w0[0].getDate() === 28 && w0[0].getMonth() === 8 && w0[6].getDate() === 4 && w0[6].getMonth() === 9 && w0.length === 7)
ok('weekday index of Monday/Sunday', t.weekdayOf(w0[0]) === 0 && t.weekdayOf(w0[6]) === 6)
const w1 = t.weekDates(1, d('2026-10-01')); ok('offset +1 = 5..11 Okt', w1[0].getDate() === 5 && w1[6].getDate() === 11)
ok('Sunday input stays in the same Mon-Sun week', t.weekDates(0, d('2026-10-04'))[0].getDate() === 28)
ok('weekLabel', t.weekLabel(w0) === '28 Sep – 4 Okt', t.weekLabel(w0))
ok('weekLabel across month end (2026-10-29 Thu)', t.weekLabel(t.weekDates(0, d('2026-10-29'))) === '26 Okt – 1 Nov')
const slot = (wd: number, start: string, name: string, kelas = name) => ({ wd, start, end: '00:00', name, kelas, instructor: null, packageId: null, weeks: 3 })
const slots = [slot(3, '08:00', 'FUNCTIONAL'), slot(3, '09:00', 'POUND'), slot(3, '17:00', 'ZUMBA'), slot(3, '19:00', 'YOGA'), slot(5, '08:15', 'YOGA'), slot(0, '08:00', 'GLUTES')]
const real = (id: number, tanggal: string, jam: string, name: string) => ({ id, nama_jadwal_kelas: name, nama_kelas: name, instruktur: 'X', tanggal, jam_awal: jam, jam_akhir: '10:00', maksimal_member: 30, peserta: 5 })
const actual = [real(1135, '01/10/2026', '08:00', 'Functional Circuit'), real(1136, '01/10/2026', '09:00', 'POUND')]
const now = new Date('2026-10-01T12:00:00')
const thu = t.mergeDay(w0[3], actual, slots, now)
ok('today: 2 real + 2 remaining slots', thu.length === 4 && thu.filter(i => i.status === 'confirmed').length === 2, thu.map(i => i.start + ':' + i.status).join(','))
ok('today: same-hour slot superseded by real row (no duplicate 08:00/09:00)', thu.filter(i => i.start === '08:00').length === 1 && thu.filter(i => i.start === '09:00').length === 1)
ok('today: 17:00 and 19:00 stay predicted at noon', thu.find(i => i.start === '17:00')!.status === 'predicted' && thu.find(i => i.start === '19:00')!.status === 'predicted')
const late = t.mergeDay(w0[3], actual, slots, new Date('2026-10-01T18:00:00'))
ok('today at 18:00: 17:00 slot is ended, 19:00 still predicted', late.find(i => i.start === '17:00')!.status === 'ended' && late.find(i => i.start === '19:00')!.status === 'predicted')
const mon = t.mergeDay(w0[0], actual, slots, now); ok('past day: slot ended', mon.length === 1 && mon[0].status === 'ended')
const sat = t.mergeDay(w0[5], actual, slots, now); ok('future day: predicted', sat.length === 1 && sat[0].status === 'predicted' && sat[0].classId === undefined)
const sun = t.mergeDay(w0[6], actual, slots, now); ok('Sunday: empty', sun.length === 0)
const nextThu = t.mergeDay(w1[3], actual, slots, now); ok("next week's Thursday ignores today's real rows", nextThu.every(i => i.status === 'predicted') && nextThu.length === 4)
ok('sorted by start time', thu.map(i => i.start).join() === [...thu.map(i => i.start)].sort().join())
ok('two same-hour slots with different names both kept', t.mergeDay(w0[3], [], [slot(3, '19:00', 'YOGA A'), slot(3, '19:00', 'YOGA B')], now).length === 2)

// mineOf: the member's own status on a real row
ok('mineOf: Peserta', t.mineOf('Peserta') === 'peserta' && t.mineOf('PESERTA') === 'peserta')
ok('mineOf: Waiting List', t.mineOf('Waiting List') === 'waiting')
ok('mineOf: not registered / missing -> null', t.mineOf('Tidak Terdaftar') === null && t.mineOf(undefined) === null)
ok('mergeDay carries mine', t.mergeDay(d('2026-10-01'), [{ ...real(1135, '01/10/2026', '08:00', 'X'), status_saya: 'Peserta' }], [], d('2026-10-01')).find((i: any) => i.status === 'confirmed').mine === 'peserta')
