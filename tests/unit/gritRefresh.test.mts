// Run with: node tests/unit/gritRefresh.test.mts   (Node 22+, type stripping)
const ROOT = new URL('../../', import.meta.url).pathname
import { createHash, createHmac } from 'node:crypto'
let handler: (r: Request) => Promise<Response>
;(globalThis as any).Deno = {
  env: {
    get: (k: string) =>
      ({ GRIT_JWT_SECRET: 'test-secret-123', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' } as any)[k],
  },
  serve: (h: any) => (handler = h),
}

// in-memory stand-in for grit.member_sessions, reached only via the service-role PostgREST calls.
// Any call to a non-Supabase host (i.e. the gym API) is a bug: grit-refresh must never depend on it.
const sessions: { id: string; member_id: number; token_hash: string; expires_at: string; revoked_at: string | null }[] = []
let nextId = 1
const gymCalls: string[] = []

const seed = (memberId: number, expiresInMs: number, revoked = false) => {
  const token = 'seed-token-' + nextId + '-padding-to-clear-the-min-length-check'
  const id = String(nextId++)
  sessions.push({
    id,
    member_id: memberId,
    token_hash: createHash('sha256').update(token).digest('hex'),
    expires_at: new Date(Date.now() + expiresInMs).toISOString(),
    revoked_at: revoked ? new Date().toISOString() : null,
  })
  return token
}

globalThis.fetch = (async (url: string, init: any = {}) => {
  if (url.includes('/rest/v1/member_sessions')) {
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
    if (init.method === 'PATCH') {
      const id = u.searchParams.get('id')?.replace('eq.', '')
      const patch = JSON.parse(init.body)
      const row = sessions.find((s) => s.id === id)
      if (row) Object.assign(row, patch)
      return new Response('', { status: 204 })
    }
    return new Response('not used in this test', { status: 404 })
  }
  gymCalls.push(url) // grit-refresh must never reach here
  return new Response('{}', { status: 200 })
}) as any

await import(ROOT + 'supabase/functions/grit-refresh/index.ts')
const ok = (n: string, c: boolean, x = '') => {
  if (!c) process.exitCode = 1
  console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''))
}
const req = (body: unknown, method = 'POST', headers: Record<string, string> = {}) =>
  new Request('https://x/functions/v1/grit-refresh', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })

let r = await handler(req(undefined, 'OPTIONS'))
ok('preflight: 204', r.status === 204)
r = await handler(req(undefined, 'GET')); ok('GET rejected (405)', r.status === 405)
r = await handler(req({})); ok('missing refresh_token -> 400', r.status === 400)
r = await handler(req('not json', 'POST')); ok('malformed JSON body -> 400', r.status === 400)
r = await handler(req({ refresh_token: 'garbage-unknown-token-xyz' })); ok('unknown token -> 401', r.status === 401)

const good = seed(7994, 60 * 86400 * 1000)
r = await handler(req({ refresh_token: good }))
const body = await r.json()
ok('valid session -> 200 with a fresh access token for the right member', r.status === 200 && typeof body.token === 'string' && body.member_id === 7994)
const [h, p, s] = body.token.split('.')
ok('access token: correct claims and signature', JSON.parse(Buffer.from(p, 'base64url').toString()).grit_member_id === 7994 && createHmac('sha256', 'test-secret-123').update(h + '.' + p).digest('base64url') === s)
ok('rotation issues a NEW refresh token, different from the old one', typeof body.refresh_token === 'string' && body.refresh_token !== good)
ok('rotation revokes the old row', sessions.find((row) => row.token_hash === createHash('sha256').update(good).digest('hex'))?.revoked_at != null)

r = await handler(req({ refresh_token: good }))
ok('the rotated-away token cannot be used a second time', r.status === 401)

r = await handler(req({ refresh_token: body.refresh_token }))
const second = await r.json()
ok('the newly-rotated token works, and rotates again', r.status === 200 && second.refresh_token !== body.refresh_token)

const expired = seed(555, -1000) // already in the past
r = await handler(req({ refresh_token: expired })); ok('expired session -> 401', r.status === 401)

const revoked = seed(777, 60 * 86400 * 1000, true)
r = await handler(req({ refresh_token: revoked })); ok('already-revoked session -> 401', r.status === 401)

const toRevoke = seed(888, 60 * 86400 * 1000)
r = await handler(req({ refresh_token: toRevoke, revoke: true }))
const revokeBody = await r.json()
ok('explicit revoke: 200 {revoked:true}', r.status === 200 && revokeBody.revoked === true)
r = await handler(req({ refresh_token: toRevoke })); ok('a revoked token cannot then be refreshed', r.status === 401)

ok('never once called the gym API: fully independent of the gym token', gymCalls.length === 0, gymCalls.join(','))
