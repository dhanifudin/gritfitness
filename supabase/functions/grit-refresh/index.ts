// grit-refresh: mints a fresh Supabase access JWT from a previously-issued grit session (refresh token),
// with NO dependency on the gym's own bearer token or the gym API — this is what lets the tracker keep
// syncing after the gym's 5-hour token has expired, without forcing a fresh OTP login just to log a
// workout. See grit-auth for how the session is first created, and docs/grit-supabase.md for setup.
//
//   POST /functions/v1/grit-refresh   { refresh_token }
//   -> 200 { token, expires_at, member_id, refresh_token, refresh_expires_at }
//      (the token is ROTATED — the old one is revoked and stops working immediately, same as any
//      refresh-token rotation scheme)
//   -> 401 { error } when the token is unknown, expired, or already revoked
//
//   POST /functions/v1/grit-refresh   { refresh_token, revoke: true }
//   -> 200 { revoked: true }   (used on explicit logout; the caller treats this as best-effort)
//
// Secrets: GRIT_JWT_SECRET (to sign the new access token), GRIT_ALLOWED_ORIGINS (optional CORS extra).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
import { cors, createSession, findSessionByHash, json, mintAccessToken, resolveAllowedOrigins, revokeSessionById, sha256Hex } from '../_shared/grit.ts'

const allowedOrigins = resolveAllowedOrigins()

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin, allowedOrigins) })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin, allowedOrigins)

  const secret = Deno.env.get('GRIT_JWT_SECRET')
  if (!secret) return json({ error: 'server not configured' }, 500, origin, allowedOrigins)

  let body: { refresh_token?: unknown; revoke?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400, origin, allowedOrigins)
  }
  const refreshToken = body.refresh_token
  if (typeof refreshToken !== 'string' || refreshToken.length < 20) {
    return json({ error: 'missing refresh_token' }, 400, origin, allowedOrigins)
  }

  const hash = await sha256Hex(refreshToken)
  const row = await findSessionByHash(hash)
  if (!row) return json({ error: 'expired or invalid session' }, 401, origin, allowedOrigins)

  if (body.revoke === true) {
    await revokeSessionById(row.id).catch(() => {})
    return json({ revoked: true }, 200, origin, allowedOrigins)
  }

  // rotate: the old token must not work again after this
  await revokeSessionById(row.id).catch(() => {})
  const access = await mintAccessToken(row.member_id, secret)
  const session = await createSession(row.member_id)
  return json({ ...access, member_id: row.member_id, ...session }, 200, origin, allowedOrigins)
})
