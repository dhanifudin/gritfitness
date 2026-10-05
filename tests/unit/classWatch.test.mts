// Run with: node tests/unit/classWatch.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
const R = ROOT.replace(/\/$/, '')
const cw = await import(R + '/src/lib/classWatch.ts')
const ca = await import(R + '/src/lib/classAction.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}

const NOW = new Date(2026, 9, 5, 7, 30) // Monday 5 Oct 2026, 07:30 — matches the real row this round's plan was grounded on
const entry = (over: Partial<ReturnType<typeof baseEntry>> = {}) => ({ ...baseEntry(), ...over })
function baseEntry() {
  return { id: 'e1', weekday: 0, start_time: '08:00', class_name: 'Strength Development', package_id: 21, active: true, last_attempt_date: null as string | null }
}
const row = (over: Record<string, unknown> = {}) => ({
  id: 1153,
  id_paket_kelas: 21,
  nama_jadwal_kelas: 'Strength Development',
  jam_awal: '08:00',
  tanggal_mulai_daftar: '2026-10-04 15:00:00',
  tanggal_tutup_daftar: '2026-10-05 08:00:00',
  ...over,
})

// ---- matchOpenRow ----
{
  const r = cw.matchOpenRow(entry(), [row()], NOW)
  ok('matchOpenRow: open window, matching weekday+time+packageId -> the row', r?.id === 1153, JSON.stringify(r))
}
{
  const r = cw.matchOpenRow(entry({ package_id: 999, class_name: 'Strength Development' }), [row()], NOW)
  ok('matchOpenRow: package_id mismatch but class_name matches -> still the row', r?.id === 1153)
}
ok('matchOpenRow: not active -> null', cw.matchOpenRow(entry({ active: false }), [row()], NOW) === null)
ok('matchOpenRow: already attempted today -> null', cw.matchOpenRow(entry({ last_attempt_date: '2026-10-05' }), [row()], NOW) === null)
ok('matchOpenRow: different weekday -> null (not today)', cw.matchOpenRow(entry({ weekday: 2 }), [row()], NOW) === null)
ok('matchOpenRow: no matching row at all -> null', cw.matchOpenRow(entry({ start_time: '09:00' }), [row()], NOW) === null)
{
  const before = new Date(2026, 9, 4, 12, 0) // before tanggal_mulai_daftar
  ok('matchOpenRow: before the registration window opens -> null', cw.matchOpenRow(entry(), [row()], before) === null)
}
{
  const after = new Date(2026, 9, 5, 9, 0) // after tanggal_tutup_daftar
  ok('matchOpenRow: after the registration window closes -> null', cw.matchOpenRow(entry(), [row()], after) === null)
}
{
  const r = cw.matchOpenRow(entry(), [row({ tanggal_mulai_daftar: undefined, tanggal_tutup_daftar: undefined })], NOW)
  ok('matchOpenRow: window unknown (fields missing) -> null, never guess', r === null)
}

// ---- classAction / classNotice (extracted from ClassDetailView, same decision table) ----
ok('classActionFor: BELUM TERDAFTAR -> register', ca.classActionFor('BELUM TERDAFTAR')?.kind === 'register')
ok('classActionFor: YA -> register', ca.classActionFor('YA')?.kind === 'register')
ok('classActionFor: DAFTAR WAITING LIST -> waiting', ca.classActionFor('DAFTAR WAITING LIST')?.kind === 'waiting')
ok('classActionFor: PESERTA -> cancel (danger)', ca.classActionFor('PESERTA')?.kind === 'cancel' && ca.classActionFor('PESERTA')?.danger === true)
ok('classActionFor: PINALTI -> no action', ca.classActionFor('PINALTI') === null)
ok('classActionFor: unknown/undefined -> no action', ca.classActionFor(undefined) === null)
ok('classNoticeFor: PESERTA -> already a participant message', ca.classNoticeFor('PESERTA').includes('peserta'))
ok('classNoticeFor: PINALTI -> penalty message', ca.classNoticeFor('PINALTI').includes('penalti'))
ok('classNoticeFor: BELUM TERDAFTAR -> no notice (plain register case)', ca.classNoticeFor('BELUM TERDAFTAR') === '')
