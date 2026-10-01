// Run with: node tests/unit/gritAuth.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
import { createHash, createHmac } from 'node:crypto'
let handler: (r: Request) => Promise<Response>
;(globalThis as any).Deno = {
  env: {
    get: (k: string) =>
      ({ GRIT_JWT_SECRET: 'test-secret-123', GRIT_ALLOWED_ORIGINS: 'https://extra.example', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' } as any)[k],
  },
  serve: (h: any) => (handler = h),
}

// in-memory stand-in for grit.member_sessions, reached only via the service-role PostgREST calls
const sessions: { id: string; member_id: number; token_hash: string; expires_at: string; revoked_at: string | null }[] = []
let nextId = 1
let gymReply: any = { status: 200, body: { isValid: true, user: { id: 7994 } } }
let sessionsBroken = false // simulate the DB write failing, to test the non-fatal fallback
const calls: string[] = []

globalThis.fetch = (async (url: string, init: any = {}) => {
  if (url.includes('/rest/v1/member_sessions')) {
    if (sessionsBroken) return new Response('db down', { status: 500 })
    const u = new URL(url)
    if (init.method === 'POST') {
      const row = JSON.parse(init.body)
      sessions.push({ id: String(nextId++), member_id: row.member_id, token_hash: row.token_hash, expires_at: row.expires_at, revoked_at: null })
      return new Response('', { status: 201 })
    }
    if (init.method === 'GET') {
      const hash = u.searchParams.get('token_hash')?.replace('eq.', '')
      return new Response(JSON.stringify(sessions.filter((s) => s.token_hash === hash)), { status: 200 })
    }
    return new Response('not used in this test', { status: 404 })
  }
  calls.push(url + ' ' + init.headers.Authorization.slice(0, 12))
  if (gymReply === 'throw') throw new Error('net')
  return new Response(JSON.stringify(gymReply.body), { status: gymReply.status })
}) as any

await import(ROOT + 'supabase/functions/grit-auth/index.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
const GOOD = 'Bearer ' + 'x'.repeat(60)
const req = (method: string, headers: Record<string, string> = {}) => new Request('https://x/functions/v1/grit-auth', { method, headers })

let r = await handler(req('OPTIONS', { Origin: 'https://grit.ulfillah.com' }))
ok('preflight: 204 + allowed origin echoed', r.status === 204 && r.headers.get('access-control-allow-origin') === 'https://grit.ulfillah.com')
r = await handler(req('OPTIONS', { Origin: 'https://evil.example' }))
ok('preflight: unknown origin gets no allow-origin', r.status === 204 && !r.headers.get('access-control-allow-origin'))
r = await handler(req('OPTIONS', { Origin: 'https://extra.example' }))
ok('GRIT_ALLOWED_ORIGINS extends the list', r.headers.get('access-control-allow-origin') === 'https://extra.example')
r = await handler(req('GET', { Authorization: GOOD })); ok('GET rejected (405)', r.status === 405)
r = await handler(req('POST')); ok('no token -> 401, gym API not called', r.status === 401 && calls.length === 0)
r = await handler(req('POST', { Authorization: 'Bearer short' })); ok('malformed token -> 401', r.status === 401 && calls.length === 0)

r = await handler(req('POST', { Authorization: GOOD, Origin: 'https://grit.ulfillah.com' }))
const body = await r.json()
ok('valid gym token -> 200 with access token', r.status === 200 && typeof body.token === 'string' && body.member_id === 7994, 'ttl ' + (body.expires_at - Math.floor(Date.now() / 1000)))
ok('response is not cacheable', r.headers.get('cache-control') === 'no-store')
const [h, p, s] = body.token.split('.')
const claims = JSON.parse(Buffer.from(p, 'base64url').toString())
ok('signature verifies with the secret (HS256)', createHmac('sha256', 'test-secret-123').update(h + '.' + p).digest('base64url') === s)
ok('wrong secret does not verify', createHmac('sha256', 'other').update(h + '.' + p).digest('base64url') !== s)
ok('claims: role grit_member, member id, 1h expiry', claims.role === 'grit_member' && claims.grit_member_id === 7994 && claims.exp - claims.iat === 3600 && claims.sub === 'grit:7994')
ok('header alg HS256', JSON.parse(Buffer.from(h, 'base64url').toString()).alg === 'HS256')

// --- grit session (refresh token) issuance ---
ok('also returns a grit session: refresh_token + ~60 day expiry', typeof body.refresh_token === 'string' && body.refresh_token.length > 30 && body.refresh_expires_at - Math.floor(Date.now() / 1000) > 59 * 86400)
ok('only the SHA-256 hash is stored, never the plaintext token', sessions.length === 1 && sessions[0].token_hash === createHash('sha256').update(body.refresh_token).digest('hex') && !sessions.some((row) => row.token_hash === body.refresh_token))
ok('stored session is tied to the right member and not pre-revoked', sessions[0].member_id === 7994 && sessions[0].revoked_at === null)

sessionsBroken = true
r = await handler(req('POST', { Authorization: GOOD }))
const degraded = await r.json()
ok('session store unreachable: still 200 with an access token, no refresh_token (non-fatal)', r.status === 200 && typeof degraded.token === 'string' && degraded.refresh_token === undefined)
sessionsBroken = false

gymReply = { status: 401, body: { message: 'Token tidak valid' } }
r = await handler(req('POST', { Authorization: GOOD })); ok('gym says 401 -> 401', r.status === 401)
gymReply = { status: 200, body: { isValid: false } }
r = await handler(req('POST', { Authorization: GOOD })); ok('isValid=false -> 401', r.status === 401)
gymReply = { status: 200, body: { isValid: true, user: { id: 'abc' } } }
r = await handler(req('POST', { Authorization: GOOD })); ok('non-numeric member id -> 401 (no token minted)', r.status === 401)
gymReply = { status: 200, body: { isValid: true, user: {} } }
r = await handler(req('POST', { Authorization: GOOD })); ok('missing member id -> 401', r.status === 401)
gymReply = { status: 500, body: {} }
r = await handler(req('POST', { Authorization: GOOD })); ok('gym 500 -> 502', r.status === 502)
gymReply = 'throw'
r = await handler(req('POST', { Authorization: GOOD })); ok('gym unreachable -> 502', r.status === 502)
const txt = await r.text(); ok('error bodies never contain the gym token', !txt.includes('xxxxxxxx'))
