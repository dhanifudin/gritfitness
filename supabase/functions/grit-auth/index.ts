// grit-auth: exchanges a valid GritFitness (gym) bearer token for (1) a short-lived Supabase access JWT
// that RLS in schema "grit" understands, and (2) a long-lived "grit session" (refresh token) that lets
// the client keep syncing to Supabase afterwards WITHOUT the gym token — the gym's own 5-hour token has
// no refresh mechanism of its own, and the tracker's data is a separate, low-stakes concern from the gym
// account, so it should not be blocked by that expiry. See docs/grit-supabase.md.
//
//   POST /functions/v1/grit-auth      Authorization: Bearer <gym token>
//   -> 200 { token, expires_at, member_id, refresh_token, refresh_expires_at }
//   -> 401 { error } when the gym rejects the token
//
// The gym API is the only source of identity: we call its /validate-token and trust nothing from the
// client. The refresh token this mints is scoped only to the member's own rows in schema grit, exactly
// like the access token — it grants nothing in the gym account, bills or other apps, and nothing in any
// other Supabase schema (see grit-refresh for how it's used afterwards).
// Secrets (set with `supabase secrets set`; grit-prefixed because secrets are shared project-wide):
//   GRIT_JWT_SECRET       the project's JWT secret (Settings > API > JWT), used to sign the access token
//   GRIT_ALLOWED_ORIGINS  optional, comma separated, extends the default CORS allow-list
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform (used only to manage sessions).
import { cors, createSession, json, mintAccessToken, resolveAllowedOrigins } from '../_shared/grit.ts'

const GYM_API = 'https://gritfitness.id/api'
const allowedOrigins = resolveAllowedOrigins()

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin, allowedOrigins) })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin, allowedOrigins)

  const secret = Deno.env.get('GRIT_JWT_SECRET')
  if (!secret) return json({ error: 'server not configured' }, 500, origin, allowedOrigins)

  const auth = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S{20,}$/.test(auth)) return json({ error: 'missing gym token' }, 401, origin, allowedOrigins)

  let gym: { isValid?: boolean; user?: { id?: unknown } }
  try {
    const res = await fetch(`${GYM_API}/validate-token`, {
      headers: { Authorization: auth, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 401 || res.status === 403) return json({ error: 'invalid gym token' }, 401, origin, allowedOrigins)
    if (!res.ok) return json({ error: 'gym service unavailable' }, 502, origin, allowedOrigins)
    gym = await res.json()
  } catch {
    return json({ error: 'gym service unavailable' }, 502, origin, allowedOrigins)
  }

  const memberId = Number(gym.user?.id)
  if (!gym.isValid || !Number.isSafeInteger(memberId) || memberId <= 0) return json({ error: 'invalid gym token' }, 401, origin, allowedOrigins)

  const access = await mintAccessToken(memberId, secret)
  let session: { refresh_token: string; refresh_expires_at: number } | null = null
  try {
    session = await createSession(memberId)
  } catch {
    // the grit session is what lets sync survive the gym token expiring; a transient DB hiccup here
    // must not fail the whole request, since the access token alone still works for this call
  }
  return json({ ...access, member_id: memberId, ...(session ?? {}) }, 200, origin, allowedOrigins)
})
