// Run with: node tests/unit/qrCache.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
const store = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size } }
const q = await import(ROOT + 'src/lib/qrCache.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
const end = (s: string) => q.parseExpiry(s)
ok('29 Mar 2027', end('29 Mar 2027') === new Date(2027, 2, 29, 23, 59, 59, 999).getTime())
ok('30 Des 2026 (Indonesian month)', end('30 Des 2026') === new Date(2026, 11, 30, 23, 59, 59, 999).getTime())
ok('05 Agu 2026', end('05 Agu 2026') === new Date(2026, 7, 5, 23, 59, 59, 999).getTime())
ok('weekday prefix stripped (Sabtu, 10 Okt 2026)', end('Sabtu, 10 Okt 2026') === new Date(2026, 9, 10, 23, 59, 59, 999).getTime())
ok('DD/MM/YYYY and ISO', end('30/09/2026') === new Date(2026, 8, 30, 23, 59, 59, 999).getTime() && end('2026-10-01 10:00:00') === new Date(2026, 9, 1, 23, 59, 59, 999).getTime())
ok('garbage -> null', end('abc') === null && end('') === null && end(null) === null)

// ---- membership QR (daily-rotating payload) ----
const u = { id: 2870, nama: 'Dian' }
const active = (over: Record<string, unknown> = {}) => ({
  aktif: true,
  membership: { id: 15875, member_id: 2870, kode_member: '25CS0512', nama: 'DIAN', tier: 'MEMBERSHIP REG 6 MONTH', status: 'Aktif', tanggal_mulai: '30 Sep 2026', aktif_sampai: '29 Mar 2999', sisa_hari: 152, total_hari: 180 },
  qr_absensi: '2870|15875|2026-10-28|hash',
  tanggal: '2026-10-28',
  ...over,
})
q.syncQr(u, active() as any)
ok('active membership saves the payload', q.loadQr()?.payload === '2870|15875|2026-10-28|hash' && q.hasValidQr())
ok('tier and validity ride along', q.loadQr()?.tier.includes('MEMBERSHIP') && q.loadQr()?.aktif_sampai === '29 Mar 2999')
ok('qrStale: a payload from another day is stale', q.qrStale({ tanggal: '2000-01-01' }) === true && q.qrStale({ tanggal: q.localDay() }) === false)
q.syncQr(u, { aktif: false } as any)
ok('inactive answer removes the entry', q.loadQr() === null && !q.hasValidQr())
q.syncQr(u, active({ membership: { ...active().membership, aktif_sampai: '01 Jan 2000' } }) as any)
ok('membership past its end date is dropped on load', q.loadQr() === null)
q.syncQr({ id: 9, nama: 'B' }, active() as any)
ok('another member replaces the owner', q.cachedQrOwner()?.userId === 9)
const eod = (add: number) => { const d = new Date(); d.setDate(d.getDate() + add); d.setHours(23, 59, 59, 999); return d.getTime() }
ok('daysLeft: today 0, tomorrow 1, null stays null, past clamps to 0', q.daysLeft({ expiresAt: eod(0) }) === 0 && q.daysLeft({ expiresAt: eod(1) }) === 1 && q.daysLeft({ expiresAt: null }) === null && q.daysLeft({ expiresAt: eod(-3) }) === 0)
q.clearQr(); ok('clearQr', !q.hasValidQr())

// ---- class QRs (one per upcoming booking, via my-class detail) ----
{
  const detail = (over: Record<string, unknown> = {}, kelas: Record<string, unknown> = {}) => ({
    kelas: { nama: 'Lesmills Body Pump', kategori: 'Strength', tanggal: 'Sabtu, 10 Okt 2999', tanggal_label: 'Sabtu, 10 Okt 2999', jam_mulai: '16:00', jam_selesai: '17:00', ruangan: null, instruktur: null, nama_member: 'Dian', ...kelas },
    status_booking: 'confirmed', status_booking_label: 'Terkonfirmasi', kehadiran: null, kehadiran_label: null,
    upcoming: true, qr_absensi: 'payload-18032', bisa_cancel: true, batas_cancel_jam: 1,
    ...over,
  })
  q.syncClassQr(u, 1186, detail() as any)
  let rows = q.loadClassQrs()
  ok('class QR stored keyed by schedule_id', rows.length === 1 && rows[0].schedule_id === 1186 && rows[0].payload === 'payload-18032', JSON.stringify(rows))
  ok('class QR store counts as a valid QR', q.hasValidQr() === true)
  q.syncClassQr(u, 1186, detail({ upcoming: false }) as any)
  ok('a past/cancelled booking removes its QR', q.loadClassQrs().length === 0)
  q.syncClassQr(u, 1186, detail() as any)
  q.syncClassQr(u, 1200, detail({}, { jam_mulai: '18:00' }) as any)
  q.pruneClassQrs(u, [1200])
  rows = q.loadClassQrs()
  ok('prune keeps only the still-upcoming schedule ids', rows.length === 1 && rows[0].schedule_id === 1200)
  q.syncClassQr(u, 7, detail({}, { tanggal: 'Rabu, 01 Jan 2020' }) as any)
  ok('a class dated in the past is pruned on load', q.loadClassQrs().every((r: any) => r.schedule_id !== 7))
}
// ---- preselectQr ----
{
  const today = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d }
  const cls = [{ schedule_id: 5, jam_mulai: '16:00', jam_selesai: '17:00', day: q.localDay() }]
  ok('preselect: 2h before start -> the class QR', q.preselectQr(cls, today(14)) === 'c5')
  ok('preselect: during the class -> the class QR', q.preselectQr(cls, today(16)) === 'c5')
  ok('preselect: morning -> membership', q.preselectQr(cls, today(9)) === null)
  ok('preselect: after it ended -> membership', q.preselectQr(cls, today(18)) === null)
  ok('preselect: a class tomorrow never preselects', q.preselectQr([{ ...cls[0], day: '2999-01-01' }], today(16)) === null)
}
