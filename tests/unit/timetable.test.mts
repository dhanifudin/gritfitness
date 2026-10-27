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
const real = (id: number, jam: string, name: string, over: Record<string, unknown> = {}) => ({ id, kelas: name, kategori: null, instruktur: 'X', jam_mulai: jam, jam_selesai: '10:00', slot_max: 30, slot_terisi: 5, penuh: false, sudah_booking: false, booking_status: null, ...over })
// rows are already per-day under the new API: pass them only for the day they belong to
const actual = [real(1135, '08:00', 'Functional Circuit'), real(1136, '09:00', 'POUND')]
const rowsFor = (date: Date) => (t.sameDay(date, d('2026-10-01')) ? actual : [])
const now = new Date('2026-10-01T12:00:00')
const thu = t.mergeDay(w0[3], rowsFor(w0[3]), slots, now)
ok('today: 2 real + 2 remaining slots', thu.length === 4 && thu.filter(i => i.status === 'confirmed').length === 2, thu.map(i => i.start + ':' + i.status).join(','))
ok('today: same-hour slot superseded by real row (no duplicate 08:00/09:00)', thu.filter(i => i.start === '08:00').length === 1 && thu.filter(i => i.start === '09:00').length === 1)
ok('today: 17:00 and 19:00 stay predicted at noon', thu.find(i => i.start === '17:00')!.status === 'predicted' && thu.find(i => i.start === '19:00')!.status === 'predicted')
const late = t.mergeDay(w0[3], rowsFor(w0[3]), slots, new Date('2026-10-01T18:00:00'))
ok('today at 18:00: 17:00 slot is ended, 19:00 still predicted', late.find(i => i.start === '17:00')!.status === 'ended' && late.find(i => i.start === '19:00')!.status === 'predicted')
const mon = t.mergeDay(w0[0], rowsFor(w0[0]), slots, now); ok('past day: slot ended', mon.length === 1 && mon[0].status === 'ended')
const sat = t.mergeDay(w0[5], rowsFor(w0[5]), slots, now); ok('future day: predicted', sat.length === 1 && sat[0].status === 'predicted' && sat[0].classId === undefined)
const sun = t.mergeDay(w0[6], rowsFor(w0[6]), slots, now); ok('Sunday: empty', sun.length === 0)
const nextThu = t.mergeDay(w1[3], rowsFor(w1[3]), slots, now); ok("next week's Thursday (no rows fetched for it) is all predicted", nextThu.every(i => i.status === 'predicted') && nextThu.length === 4)
ok('sorted by start time', thu.map(i => i.start).join() === [...thu.map(i => i.start)].sort().join())
ok('two same-hour slots with different names both kept', t.mergeDay(w0[3], [], [slot(3, '19:00', 'YOGA A'), slot(3, '19:00', 'YOGA B')], now).length === 2)

// mineOf: the member's own booking on a real row
ok('mineOf: confirmed booking', t.mineOf({ sudah_booking: true, booking_status: 'confirmed' }) === 'peserta')
ok('mineOf: booked-unpaid', t.mineOf({ sudah_booking: true, booking_status: 'booked' }) === 'unpaid')
ok('mineOf: sudah_booking without status still counts', t.mineOf({ sudah_booking: true, booking_status: null }) === 'peserta')
ok('mineOf: not booked -> null', t.mineOf({ sudah_booking: false, booking_status: null }) === null)
ok('mergeDay carries mine', t.mergeDay(d('2026-10-01'), [real(1135, '08:00', 'X', { sudah_booking: true, booking_status: 'confirmed' })], [], d('2026-10-01')).find((i: any) => i.status === 'confirmed').mine === 'peserta')
