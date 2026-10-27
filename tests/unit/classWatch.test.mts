// Run with: node tests/unit/classWatch.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
const R = ROOT.replace(/\/$/, '')
const cw = await import(R + '/src/lib/classWatch.ts')
const ca = await import(R + '/src/lib/classAction.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}

const NOW = new Date(2026, 9, 5, 7, 30) // Monday 5 Oct 2026, 07:30
const entry = (over: Partial<ReturnType<typeof baseEntry>> = {}) => ({ ...baseEntry(), ...over })
function baseEntry() {
  return { id: 'e1', weekday: 0, start_time: '08:00', class_name: 'Strength Development', package_id: 21, active: true, last_attempt_date: null as string | null }
}
const row = (over: Record<string, unknown> = {}) => ({
  id: 1153,
  kelas: 'Strength Development',
  jam_mulai: '08:00',
  penuh: false,
  sudah_booking: false,
  ...over,
})
const rowsOf = (rows: Record<string, unknown>[] | undefined) => (date: string) => (date === '2026-10-05' ? (rows as never) : undefined)

// ---- matchOpenRow: the row exists for the watched occurrence and the class hasn't started ----
{
  const r = cw.matchOpenRow(entry(), rowsOf([row()]), NOW)
  ok('matchOpenRow: published row, matching time+name -> the row', r?.row.id === 1153 && r?.date === '2026-10-05', JSON.stringify(r))
}
{
  const r = cw.matchOpenRow(entry({ class_name: 'LES MILLS strength development' }), rowsOf([row()]), NOW)
  ok('matchOpenRow: name match is normalized (case/Les Mills noise)', r?.row.id === 1153)
}
ok('matchOpenRow: not active -> null', cw.matchOpenRow(entry({ active: false }), rowsOf([row()]), NOW) === null)
ok('matchOpenRow: already attempted for this occurrence -> null', cw.matchOpenRow(entry({ last_attempt_date: '2026-10-05' }), rowsOf([row()]), NOW) === null)
ok('matchOpenRow: occurrence beyond the horizon -> null (no wasted fetch)', cw.matchOpenRow(entry({ weekday: 3 }), () => [] as never, NOW) === null)
ok('matchOpenRow: no matching row published yet -> null', cw.matchOpenRow(entry({ start_time: '09:00' }), rowsOf([row()]), NOW) === null)
ok('matchOpenRow: that day not fetched -> null', cw.matchOpenRow(entry(), () => undefined, NOW) === null)
{
  const later = new Date(2026, 9, 5, 8, 30) // class already started
  ok('matchOpenRow: today\'s class already started -> null', cw.matchOpenRow(entry(), rowsOf([row()]), later) === null)
}
ok('occurrenceYmd: today / +1', cw.occurrenceYmd({ weekday: 0 }, NOW) === '2026-10-05' && cw.occurrenceYmd({ weekday: 1 }, NOW) === '2026-10-06')

// ---- classActionFor / classNoticeFor (new booking decision table off the schedule row) ----
const brow = (over: Record<string, unknown> = {}) => ({ penuh: false, sudah_booking: false, booking_status: null, tagihan_id: null, ...over })
ok('bookable row -> book', ca.classActionFor(brow())?.kind === 'book')
ok('full row -> waiting (same POST, outline button)', ca.classActionFor(brow({ penuh: true }))?.kind === 'waiting')
ok('booked unpaid -> pay', ca.classActionFor(brow({ sudah_booking: true, booking_status: 'booked', tagihan_id: 7 }))?.kind === 'pay')
ok('confirmed -> no action', ca.classActionFor(brow({ sudah_booking: true, booking_status: 'confirmed' })) === null)
ok('notice: confirmed', ca.classNoticeFor(brow({ booking_status: 'confirmed' })).includes('sudah mengambil'))
ok('notice: unpaid mentions payment', ca.classNoticeFor(brow({ booking_status: 'booked' })).toLowerCase().includes('pembayaran'))
ok('notice: full mentions waiting list', ca.classNoticeFor(brow({ penuh: true })).toLowerCase().includes('waiting'))
ok('notice: plain bookable row -> empty', ca.classNoticeFor(brow()) === '')
ok('ATURAN_KELAS: the 4 gym rules ride along', ca.ATURAN_KELAS.length === 4 && ca.ATURAN_KELAS[2].includes('1 jam'))

// ---- nextOccurrence / watchWhen / watchStatus (Beranda list) ----
const e2 = (over: Record<string, unknown> = {}) => ({ id: 'w', weekday: 0, start_time: '17:00', class_name: 'X', package_id: 1, active: true, last_attempt_date: null as string | null, last_attempt_result: null as string | null, ...over })
ok('nextOccurrence: today = 0', cw.nextOccurrence({ weekday: 0 }, NOW) === 0)
ok('nextOccurrence: tomorrow = 1', cw.nextOccurrence({ weekday: 1 }, NOW) === 1)
ok('nextOccurrence: wraps past Sunday (Sunday slot on Monday = 6)', cw.nextOccurrence({ weekday: 6 }, NOW) === 6)
ok('nextOccurrence: yesterday\'s weekday is 6 days away', cw.nextOccurrence({ weekday: 6 }, new Date(2026, 9, 5 + 7)) === 6)
ok('watchWhen: today / tomorrow / weekday', cw.watchWhen(e2(), NOW) === 'Hari ini 17.00' && cw.watchWhen(e2({ weekday: 1, start_time: '07:30' }), NOW) === 'Besok 07.30' && cw.watchWhen(e2({ weekday: 3 }), NOW) === 'Kam 17.00')
ok('watchStatus: attempted this occurrence -> result in words', cw.watchStatus(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'registered' }), NOW).text === 'Terbooking otomatis' && cw.watchStatus(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'waiting' }), NOW).tone === 'warn')
ok('watchStatus: failed/full are the bad tone', cw.watchStatus(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'full' }), NOW).tone === 'bad' && cw.watchStatus(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'failed' }), NOW).tone === 'bad')
ok('watchStatus: old attempt falls back to the waiting hint', cw.watchStatus(e2({ last_attempt_date: '2026-10-01', last_attempt_result: 'registered' }), NOW).text === 'Dibooking otomatis begitu jadwalnya terbit')

// ---- showOnHome: a successful attempt clears the row until the next occurrence ----
ok('showOnHome: untouched active entry shows', cw.showOnHome(e2(), NOW))
ok('showOnHome: registered today hides', !cw.showOnHome(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'registered' }), NOW))
ok('showOnHome: already-registered today hides', !cw.showOnHome(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'already' }), NOW))
ok('showOnHome: waiting/full/failed stay visible', cw.showOnHome(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'waiting' }), NOW) && cw.showOnHome(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'full' }), NOW) && cw.showOnHome(e2({ last_attempt_date: '2026-10-05', last_attempt_result: 'failed' }), NOW))
ok('showOnHome: last week\'s success shows again', cw.showOnHome(e2({ last_attempt_date: '2026-09-28', last_attempt_result: 'registered' }), NOW))
ok('showOnHome: inactive never shows', !cw.showOnHome(e2({ active: false }), NOW))
