-- ============================================================================
-- grit_006_sessions.sql
--
-- "grit sessions" (long-lived refresh tokens, 60 days) so the Supabase-backed tracker can keep syncing
-- after the gym's own 5-hour bearer token expires, without the gym having a refresh mechanism of its own.
-- Minted and rotated only by the grit-auth / grit-refresh Edge Functions (service_role); see
-- supabase/functions/_shared/grit.ts. ADDITIVE and idempotent; touches only schema grit.
--
--   * only the SHA-256 HASH of each token is stored — never the plaintext
--   * this table is NOT reachable through PostgREST by any role but service_role: no RLS policy, and
--     the schema's default-privilege grant to grit_member (grit_001) is explicitly revoked below, the
--     same way grit.migrations already is. anon/authenticated never had grants on grit at all.
-- ============================================================================
begin;

create table if not exists grit.member_sessions (
  id           uuid primary key default gen_random_uuid(),
  member_id    bigint not null,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);
create index if not exists member_sessions_member_idx on grit.member_sessions (member_id);
create index if not exists member_sessions_active_idx on grit.member_sessions (token_hash) where revoked_at is null;

alter table grit.member_sessions enable row level security;
-- no policies: PostgREST-facing roles (grit_member, anon, authenticated) get nothing; only
-- service_role (NOLOGIN BYPASSRLS, used solely inside the Edge Functions) can ever read or write it.
revoke all on grit.member_sessions from grit_member;
grant all on grit.member_sessions to service_role; -- already covered by grit_001's default privileges; explicit for clarity

insert into grit.migrations (name) values ('grit_006_sessions') on conflict do nothing;

commit;

notify pgrst, 'reload schema';
