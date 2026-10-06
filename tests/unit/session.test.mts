// Run with: node tests/unit/session.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const s = await import(ROOT + '/src/lib/session.ts')
const ok = (n: string, v: boolean, x = '') => {
  if (!v) process.exitCode = 1
  console.log((v ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
const EXP = '2026-10-06T19:00:29.162880Z'
const t = Date.parse(EXP)
ok('endReason: before expiry -> early (revoked elsewhere)', s.endReason(EXP, t - 60_000) === 'early')
ok('endReason: at/after expiry -> timeout', s.endReason(EXP, t) === 'timeout' && s.endReason(EXP, t + 1) === 'timeout')
ok('endReason: unknown expiry -> early', s.endReason(undefined, t) === 'early' && s.endReason('garbage', t) === 'early')
ok('msUntilExpiry: counts down', s.msUntilExpiry(EXP, t - 5000) === 5000)
ok('msUntilExpiry: never negative', s.msUntilExpiry(EXP, t + 9999) === 0)
ok('msUntilExpiry: unknown -> null', s.msUntilExpiry(null, t) === null)
