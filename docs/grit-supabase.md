# GritFitness tracker: Supabase setup (schema `grit`)

The tracker stores member data on the **shared Supabase project** that `lulu` and `bomi` also use. Grit is
built so it cannot interfere with them, and so they cannot read grit's data.

## What grit adds to the shared project (and nothing else)

| Where | What |
|---|---|
| schema `grit` | 6 tables: `members`, `visits`, `class_signups`, `body_metrics`, `badges`, `migrations`, plus 2 helper functions |
| role | `grit_member` (NOLOGIN) and its membership in `authenticator`, so PostgREST can switch to it |
| API settings | `grit` appended to **Exposed schemas** (Dashboard, API settings; keep `public`, `lulu`, `bomi`) |
| Edge Function | `grit-auth` |
| Secret | `GRIT_JWT_SECRET` (and optionally `GRIT_ALLOWED_ORIGINS`) |

How isolation works:

- The app's tokens carry `role: grit_member`, not `authenticated`. That role can use schema `grit` only: it has no
  rights on `public`, `lulu`, `bomi`, and `anon`/`authenticated` have no rights on `grit` (the lulu/bomi convention
  of granting those two is deliberately not followed).
- Row Level Security: every table allows a member only rows whose `member_id` equals the `grit_member_id` claim
  of their token. The claim is minted by `grit-auth` only after it has asked the gym's own API
  (`/validate-token`) whether the member's gym token is valid.
- Migrations are plain SQL files tracked in `grit.migrations`. **Do not use `supabase db push`** on the shared
  project: its global migration history is already shared between lulu and bomi (see the `*_lulu_stub.sql` files
  in `../bomi/supabase/migrations`).

## One-time setup (about 10 minutes)

1. **Audit before** (optional but recommended): open the Supabase SQL editor, run `supabase/sql/grit_003_audit.sql`,
   keep the result.
2. Run, in this order, in the SQL editor: `grit_001_schema.sql`, then `grit_002_rls.sql`. Both are idempotent and
   safe to re-run.
3. Run `grit_003_audit.sql` again and compare with step 1. The only differences must be the new schema `grit`
   (6 tables, 9 indexes, 2 functions) and the role `grit_member`. Steps 4 and 5 of the audit must return **no rows**
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
supabase db query --linked -f supabase/sql/grit_004_selftest.sql   # expect: grit selftest OK (rolled back)
supabase secrets set --env-file <file with GRIT_JWT_SECRET=...>    # delete the file afterwards
supabase functions deploy grit-auth --no-verify-jwt --use-api
```

Add `grit` to Exposed schemas in the dashboard (the only step the CLI cannot do).

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
