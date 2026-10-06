// Run with: node tests/unit/classOpen.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const c = await import(ROOT + '/src/lib/classOpen.ts')
const ok = (n: string, v: boolean, x = '') => {
  if (!v) process.exitCode = 1
  console.log((v ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
const SUN = 6, MON = 0, TUE = 1, SAT = 5

// morning class (Monday 08:00): registration opens Sunday 15:00
const morning = { weekday: MON, start_time: '08:00' }
ok('morning: not due Sunday 14:59', !c.nudgeDue(morning, { weekday: SUN, hour: 14 + 59 / 60 }))
ok('morning: due Sunday 15:00', c.nudgeDue(morning, { weekday: SUN, hour: 15 }))
ok('morning: due Sunday 23:30', c.nudgeDue(morning, { weekday: SUN, hour: 23.5 }))
ok('morning: not due on Monday itself', !c.nudgeDue(morning, { weekday: MON, hour: 9 }))
ok('morning: not due two days before', !c.nudgeDue(morning, { weekday: SAT, hour: 20 }))

// afternoon class (Monday 17:00): registration opens Monday 07:00
const afternoon = { weekday: MON, start_time: '17:00' }
ok('afternoon: not due Monday 06:59', !c.nudgeDue(afternoon, { weekday: MON, hour: 6 + 59 / 60 }))
ok('afternoon: due Monday 07:00', c.nudgeDue(afternoon, { weekday: MON, hour: 7 }))
ok('afternoon: not due the evening before', !c.nudgeDue(afternoon, { weekday: SUN, hour: 20 }))

// cutoff: 11:59 is morning, 12:00 is afternoon
ok('11:59 is a morning class', c.isMorningClass('11:59') && c.registrationOpening('11:59').hour === 15)
ok('12:00 is an afternoon class', !c.isMorningClass('12:00') && c.registrationOpening('12:00').hour === 7)

// week wraparound: a Monday morning class opens on Sunday, a Sunday morning class on Saturday
ok('wrap: Sunday-opening for a Monday morning class', c.nudgeDue({ weekday: MON, start_time: '06:00' }, { weekday: SUN, hour: 16 }))
ok('wrap: Saturday-opening for a Sunday morning class', c.nudgeDue({ weekday: SUN, start_time: '09:00' }, { weekday: SAT, hour: 16 }))
ok('wrap: Tuesday class opens Monday', c.nudgeDue({ weekday: TUE, start_time: '07:00' }, { weekday: MON, hour: 15 }))

// labels
ok('label: morning class names the day before', c.opensLabel(MON, '08:00') === 'Minggu 15.00', c.opensLabel(MON, '08:00'))
ok('label: afternoon class names the same day', c.opensLabel(MON, '17:00') === 'Senin 07.00', c.opensLabel(MON, '17:00'))

// jakartaFields: 2026-10-04T17:30Z is Monday 00:30 in Jakarta
{
  const j = c.jakartaFields(new Date('2026-10-04T17:30:00Z'))
  ok('jakartaFields: crosses midnight into Monday', j.weekday === MON && Math.abs(j.hour - 0.5) < 1e-9, JSON.stringify(j))
  const k = c.jakartaFields(new Date('2026-10-05T07:59:00Z'))
  ok('jakartaFields: Monday 14:59 WIB', k.weekday === MON && Math.abs(k.hour - (14 + 59 / 60)) < 1e-9, JSON.stringify(k))
}
