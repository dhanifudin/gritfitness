# GritFitness tracker: Supabase setup (schema `grit`)

The tracker stores member data on the **shared Supabase project** that `lulu` and `bomi` also use. Grit is
built so it cannot interfere with them, and so they cannot read grit's data.

## What grit adds to the shared project (and nothing else)

| Where | What |
|---|---|
| schema `grit` | 9 tables: `members`, `visits`, `class_signups`, `body_metrics`, `badges`, `member_sessions`, `push_subscriptions`, `push_log`, `migrations`, plus 2 helper functions |
| role | `grit_member` (NOLOGIN) and its membership in `authenticator`, so PostgREST can switch to it |
| API settings | `grit` appended to **Exposed schemas** (Dashboard, API settings; keep `public`, `lulu`, `bomi`) |
| Edge Functions | `grit-auth`, `grit-refresh`, `grit-push-check` |
| Secrets | `GRIT_JWT_SECRET`, `GRIT_CRON_SECRET`, `GRIT_VAPID_PUBLIC_KEY`, `GRIT_VAPID_PRIVATE_KEY`, `GRIT_VAPID_SUBJECT` (optionally `GRIT_ALLOWED_ORIGINS`) |
| Scheduling | one `pg_cron` job, `grit-push-check` (every 30 min), named to match lulu's `lulu-reminder-*` convention so the two don't collide |

How isolation works:

- The app's tokens carry `role: grit_member`, not `authenticated`. That role can use schema `grit` only: it has no
  rights on `public`, `lulu`, `bomi`, and `anon`/`authenticated` have no rights on `grit` (the lulu/bomi convention
  of granting those two is deliberately not followed).
- Row Level Security: every table allows a member only rows whose `member_id` equals the `grit_member_id` claim
  of their token. The claim is minted by `grit-auth` only after it has asked the gym's own API
  (`/validate-token`) whether the member's gym token is valid.
- The gym's own bearer token lasts 5 hours and has no refresh mechanism. So that the tracker doesn't need a
  fresh gym OTP login just to keep syncing, `grit-auth` also issues a 60-day **grit session** (an opaque,
  rotating refresh token; only its SHA-256 hash is stored, in `grit.member_sessions`). `grit-refresh` mints new
  1-hour access tokens from it with **no gym API call at all** — it is independent of the gym token, scoped to
  the member's own `grit` rows exactly like the access token it refreshes. `member_sessions` itself is reachable
  by neither `grit_member` nor `anon`/`authenticated`: only the two Edge Functions (service role) touch it.
- Migrations are plain SQL files tracked in `grit.migrations`. **Do not use `supabase db push`** on the shared
  project: its global migration history is already shared between lulu and bomi (see the `*_lulu_stub.sql` files
  in `../bomi/supabase/migrations`).

## One-time setup (about 10 minutes)

1. **Audit before** (optional but recommended): open the Supabase SQL editor, run `supabase/sql/grit_003_audit.sql`,
   keep the result.
2. Run, in this order, in the SQL editor: `grit_001_schema.sql`, `grit_002_rls.sql`, `grit_005_activities.sql`
   (activity types for visits), then `grit_006_sessions.sql` (the grit-session/refresh-token table). All are
   additive and idempotent, safe to re-run.
3. Run `grit_003_audit.sql` again and compare with step 1. The only differences must be the new schema `grit`
   (7 tables, 13 indexes, 2 functions) and the role `grit_member`. Steps 4 and 5 of the audit must return **no rows**
   (step 4 compares with the anonymous role: Supabase extensions such as pg_cron/pg_net grant to every role by default).
4. Run `grit_004_selftest.sql`. It proves RLS isolation in one atomic block and always rolls back. **Success is an
   error message** `grit selftest OK (rolled back)`; a failure says `FAIL: ...`.
5. Dashboard, **API settings, Exposed schemas**: add `grit` to the existing list (do not replace it).
6. Dashboard, **Project settings, API, JWT**: copy the project's JWT secret (the legacy HS256 secret). The new
   asymmetric signing keys cannot be used to sign our tokens; if your project only has those, tell us (see
   "Fallback" below).
7. From this repository (the project ref is the subdomain of `VITE_SUPABASE_URL` in your `.env`):

   ```bash
   supabase login                      # once
   supabase secrets set GRIT_JWT_SECRET='<paste the JWT secret>' --project-ref <ref>
   supabase functions deploy grit-auth --project-ref <ref> --no-verify-jwt
   ```

   Secrets are project-wide: the name is `GRIT_`-prefixed so it cannot clash with lulu/bomi. Deploying a function
   touches only that function.
8. Smoke test (from any shell; `<gym token>` comes from logging in to the app or `POST /api/verify-otp`):

   ```bash
   curl -s -X POST "$VITE_SUPABASE_URL/functions/v1/grit-auth" \
     -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer <gym token>"
   # -> {"token":"...","expires_at":...,"member_id":...}
   ```

## Fallback if JWT minting is not possible

If the project has disabled the legacy JWT secret, the app can instead call `grit-*` Edge Functions that use the
service role and check the gym token on every request. Only `src/lib/supabase.ts` changes. Ask for it.

## Removing grit completely

`supabase/sql/grit_999_rollback.sql` drops the schema and the role. It deletes all grit data.

## Local development

Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (the publishable/anon key is
public by design; **never** put a service-role key or database password in this repository).

## Using the CLI instead of the dashboard (what was done for this project)

With `supabase login` done once on the machine and `supabase link --project-ref <ref>` from this repo:

```bash
supabase db query --linked -f supabase/sql/grit_003_audit.sql     # baseline
supabase db query --linked -f supabase/sql/grit_001_schema.sql
supabase db query --linked -f supabase/sql/grit_002_rls.sql
supabase db query --linked -f supabase/sql/grit_005_activities.sql  # activity types / back-dated entries
supabase db query --linked -f supabase/sql/grit_006_sessions.sql    # grit session (refresh token) table
supabase db query --linked -f supabase/sql/grit_007_visit_cost.sql  # optional cost on non-Grit activities
supabase db query --linked -f supabase/sql/grit_008_push_subscriptions.sql  # push subscriptions + de-dupe log
supabase db query --linked -f supabase/sql/grit_004_selftest.sql   # expect: grit selftest OK (rolled back)
supabase secrets set --env-file <file with GRIT_JWT_SECRET=...>    # delete the file afterwards
supabase functions deploy grit-auth --no-verify-jwt --use-api
supabase functions deploy grit-refresh --no-verify-jwt --use-api
```

Add `grit` to Exposed schemas in the dashboard (the only step the CLI cannot do).

### Push notifications (grit-push-check)

Favourite-class and no-tracking nudges, delivered as real OS push even when the app is closed. Setup:

```bash
npx web-push generate-vapid-keys --json                            # once; public key is not secret
cat > /tmp/vapid.env <<EOF
GRIT_VAPID_PRIVATE_KEY=<private key>
GRIT_VAPID_PUBLIC_KEY=<public key>
GRIT_VAPID_SUBJECT=mailto:<contact address>
GRIT_CRON_SECRET=<a random 32-byte value, e.g. from \`openssl rand -base64 32\`>
EOF
supabase secrets set --env-file /tmp/vapid.env --project-ref <ref>  # delete the file afterwards
supabase functions deploy grit-push-check --no-verify-jwt --use-api --project-ref <ref>

gh variable set VITE_VAPID_PUBLIC_KEY --body "<the same public key>"  # public, goes in the client bundle
```

Then schedule the cron job: copy `supabase/sql/grit_009_push_cron.sql`, replace `<<CRON_SECRET>>` with the
real `GRIT_CRON_SECRET` value in a throwaway local copy (never commit the real value), and run it with
`supabase db query --linked -f <that copy>`, then delete the copy. It's idempotent — re-running with a new
secret rotates both the Vault entry and the scheduled job. `grit-push-check` fetches the deployed
`timetable.json` at call time rather than bundling its own copy, so there's nothing to keep in sync.

Smoke test: `curl -s -X POST "$VITE_SUPABASE_URL/functions/v1/grit-push-check" -H "x-cron-secret: <secret>"`
→ `{"checked":N,"sent":N,"pruned":N}`. A call with no/wrong header → 401.

## Setup log (2026-10-01)

- Baseline audit: schemas `lulu`, `bomi`, `codemonkey` (+ platform schemas) present; no `grit`, no `grit_member`.
- Applied `grit_001`, `grit_002`; audit diff: only schema `grit` (6 tables, 9 indexes, 2 functions), role `grit_member`
  and its membership in `authenticator` were added. (The platform's own `storage` schema also changed object counts
  during the session; nothing in the grit SQL touches it.)
- Self-test passed; all grit tables empty afterwards.
- `grit-auth` deployed (other functions untouched). The project uses the new JWT signing keys, and tokens signed with
  the legacy JWT secret are accepted by PostgREST (smoke test below).
- Smoke test with the test member: bad gym token -> 401; valid -> 1 h JWT (`role: grit_member`); insert, idempotent
  upsert, read, delete all work; inserting a row for another member id -> 403 (RLS); invalid values -> 400;
  anon key on schema grit -> 401 `permission denied for schema grit`; grit token on `lulu` and `bomi` -> 403
  `permission denied for schema ...`. Test rows were deleted.

If the legacy JWT secret is ever rotated, run `supabase secrets set GRIT_JWT_SECRET=...` again with the new value.

### 2026-10-01 (later): migration 005, activity types

- `grit_005_activities.sql` applied to the real project: `grit.visits` gained `activity`, `activity_name`,
  `counts_toward_goal`, `duration_min`, `class_id` (+ 3 check constraints). Audit before/after: no change outside grit;
  self-test still passes. REST smoke test with the test member: past-dated custom (Hyrox) and class rows accepted, unknown
  activity and `other` without a name rejected (400), test rows deleted.

### 2026-10-01 (later still): migration 006, grit sessions + `grit-refresh`

- `grit_006_sessions.sql` applied: `grit.member_sessions` added (7 tables, 13 indexes, 2 functions total). Audit
  diff showed only `grit:r` (6→7) and `grit:i` (9→13); nothing else changed. Self-test still passes, and
  `grit_member` has zero privileges on `member_sessions` (confirmed directly against `information_schema`).
- `grit-auth` redeployed (now also issues a session) and `grit-refresh` deployed; both bundle `_shared/grit.ts`.
  `fetch-prayer-times`/`send-reminders` (lulu/bomi) untouched.
- Live smoke test with the test member: `grit-auth` returns a `refresh_token`; `grit-refresh` rotates it (new
  access token + new refresh token); the just-rotated-away token is then rejected (401); explicit
  `{revoke:true}` works and a revoked token cannot be refreshed again; a garbage token is rejected (401), no
  crash. Test rows (including the session) deleted afterward.

### 2026-10-01 (later still): migration 007, visit cost

- `grit_007_visit_cost.sql` applied: `grit.visits` gained a nullable `cost` column (+ check constraint).
  Audit before/after: no change outside grit; self-test still passes.

### 2026-10-01 (later still): migration 008 + grit-push-check (push notifications)

- `grit_008_push_subscriptions.sql` applied: `grit.push_subscriptions` (self-service, same RLS pattern as
  `visits`) and `grit.push_log` (service-role only, like `member_sessions`) added (7→9 tables, 13→18 indexes).
  Audit diff: only those two tables and their indexes; `grit_member` confirmed to have zero privileges on
  `push_log` directly against `information_schema`. Self-test still passes.
- VAPID keys generated; `GRIT_VAPID_PUBLIC_KEY`/`GRIT_VAPID_PRIVATE_KEY`/`GRIT_VAPID_SUBJECT`/`GRIT_CRON_SECRET`
  set as secrets. `npm:web-push` spiked under a plain Deno container first (VAPID JWT signing + a send
  attempt) to confirm Node-crypto compat before relying on it in the function — worked cleanly.
- `grit-push-check` deployed (service role; imports `src/lib/insight.ts`/`tracker.ts`/`timetable.ts` directly
  via relative paths — the CLI's `--use-api` bundler walks the import graph wherever it leads, confirmed by
  the upload log listing those files as bundled assets). Smoke test: missing/wrong `x-cron-secret` → 401;
  correct secret with no subscriptions → `{"checked":0,"sent":0,"pruned":0}`.
- `grit_009_push_cron.sql` run with the real secret substituted (never committed): scheduled `grit-push-check`
  as a `pg_cron` job (`grit-push-check`, every 30 min, named to avoid colliding with lulu's `lulu-reminder-*`
  jobs), secret referenced via Supabase Vault rather than embedded in `cron.job`'s SQL text.
- End-to-end delivery test: subscribed a real headless-Chromium instance (push subscription only works in a
  non-incognito browser profile) to get a genuine FCM endpoint, registered it for the test member alongside
  one deliberately old test visit (to trigger the no-tracking condition — the account otherwise had zero
  `grit.visits` rows), invoked `grit-push-check` live → `sent:1` (FCM accepted the push). A second call within
  the 3-day cooldown correctly sent nothing (de-dupe via `grit.push_log` confirmed working). Test visit,
  subscription and log row all deleted afterward; zero grit rows left for the test member.
