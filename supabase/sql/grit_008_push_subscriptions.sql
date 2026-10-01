-- ============================================================================
-- grit_008_push_subscriptions.sql
--
-- Web Push subscriptions, one row per device/browser the member enabled notifications on. Unlike
-- grit.member_sessions, this table IS reachable directly by grit_member through PostgREST — a member
-- manages their own subscription rows the same self-service way they already manage visits/signups, so
-- no extra Edge Function is needed just to add/remove a device. grit-push-check (service role) reads
-- across all members to decide who to notify, bypassing RLS as usual for a server-side job.
-- ADDITIVE and idempotent; adds one new table plus its log table, touches nothing else.
-- ============================================================================
begin;

create table if not exists grit.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  bigint not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_member_idx on grit.push_subscriptions (member_id);

alter table grit.push_subscriptions enable row level security;
drop policy if exists own_rows on grit.push_subscriptions;
create policy own_rows on grit.push_subscriptions for all to grit_member
  using (member_id = grit.current_member())
  with check (member_id = grit.current_member());

-- De-dupe log so the scheduled check doesn't re-notify every run. service_role (the Edge Function) only;
-- same reasoning as member_sessions: not something a member ever reads or writes themselves.
create table if not exists grit.push_log (
  id      uuid primary key default gen_random_uuid(),
  member_id bigint not null,
  kind    text not null check (kind in ('favclass', 'notracking')),
  sent_at timestamptz not null default now()
);
create index if not exists push_log_member_kind_idx on grit.push_log (member_id, kind, sent_at desc);

alter table grit.push_log enable row level security;
revoke all on grit.push_log from grit_member;
grant all on grit.push_log to service_role; -- already covered by grit_001's default privileges; explicit for clarity

insert into grit.migrations (name) values ('grit_008_push_subscriptions') on conflict do nothing;

commit;

notify pgrst, 'reload schema';
