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
ok('DD/MM/YYYY and ISO', end('30/09/2026') === new Date(2026, 8, 30, 23, 59, 59, 999).getTime() && end('2026-10-01 10:00:00') === new Date(2026, 9, 1, 23, 59, 59, 999).getTime())
ok('garbage -> null', end('abc') === null && end('') === null && end(null) === null)
const u = { id: 7, nama: 'A' }
const m = (sel: string) => ({ id: 1, nama_paket: 'P', qr_code: 'QQ', tanggal_mulai: '1 Jan 2026', tanggal_selesai: sel })
q.saveQr(u, 'gym', m('29 Mar 2999'))
ok('valid entry loads', q.loadQr('gym')?.qr_code === 'QQ' && q.hasValidQr())
q.saveQr(u, 'pt', m('01 Jan 2000'))
ok('expired entry is not returned and is deleted', q.loadQr('pt') === null && JSON.parse(store.get('grit.qr.v1')!).entries.pt === undefined)
q.syncQr(u, 'gym', { ...m('29 Mar 2999'), error: 'Cuti' } as any)
ok('{error} from the server removes the entry', q.loadQr('gym') === null && !q.hasValidQr())
q.saveQr(u, 'gym', m('unparseable'))
ok('unparseable date never expires', q.loadQr('gym') !== null)
q.saveQr({ id: 8, nama: 'B' }, 'gym', m('29 Mar 2999'))
ok('another member replaces the owner', q.cachedQrOwner()?.userId === 8)
const eod = (add: number) => { const d = new Date(); d.setDate(d.getDate() + add); d.setHours(23, 59, 59, 999); return d.getTime() }
ok('daysLeft: today 0, tomorrow 1, null stays null, past clamps to 0', q.daysLeft({ expiresAt: eod(0) }) === 0 && q.daysLeft({ expiresAt: eod(1) }) === 1 && q.daysLeft({ expiresAt: null }) === null && q.daysLeft({ expiresAt: eod(-3) }) === 0)
q.clearQr(); ok('clearQr', !q.hasValidQr())

// ---- class QRs (per registered class) ----
{
  const user = { id: 7994, nama: 'Dian' }
  localStorage.removeItem('grit.qr.v1')
  q.syncClassQrs(user, [
    { id: 18032, nama_paket: 'Lesmills Body Pump', nama_jadwal_kelas: 'BODY PUMP', qr_code: 'QQ==', tanggal: '10 Oct 2026', jam_awal: '16:00', jam_akhir: '17:00' },
    { id: 18033, nama_paket: 'Zumba', nama_jadwal_kelas: 'ZUMBA', qr_code: '', tanggal: '10 Oct 2026', jam_awal: '18:00', jam_akhir: '19:00' },
  ])
  const rows = q.loadClassQrs()
  ok('classQrs: stored, empty qr dropped', rows.length === 1 && rows[0].id === 18032 && rows[0].expiresAt !== null, JSON.stringify(rows.map((r: any) => r.id)))
  ok('classQrs: store counts as a valid QR', q.hasValidQr() === true)
  q.syncClassQrs(user, [])
  ok('classQrs: an empty successful answer clears them', q.loadClassQrs().length === 0)
  // expiry pruning: a class dated yesterday disappears
  q.syncClassQrs(user, [{ id: 1, nama_paket: 'X', nama_jadwal_kelas: 'X', qr_code: 'QQ==', tanggal: '01 Jan 2020', jam_awal: '08:00', jam_akhir: '09:00' }])
  ok('classQrs: expired class pruned on load', q.loadClassQrs().length === 0)
}
// ---- preselectQr ----
{
  const today = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d }
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999)
  const cls = [{ id: 5, jam_awal: '16:00', jam_akhir: '17:00', expiresAt: endToday.getTime() }]
  ok('preselect: 2h before start -> the class QR', q.preselectQr(cls, today(14)) === 'c5')
  ok('preselect: during the class -> the class QR', q.preselectQr(cls, today(16)) === 'c5')
  ok('preselect: morning -> membership', q.preselectQr(cls, today(9)) === null)
  ok('preselect: after it ended -> membership', q.preselectQr(cls, today(18)) === null)
  const tomorrow = new Date(endToday.getTime() + 86_400_000)
  ok('preselect: a class tomorrow never preselects', q.preselectQr([{ ...cls[0], expiresAt: tomorrow.getTime() }], today(16)) === null)
}
