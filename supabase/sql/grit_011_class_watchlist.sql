-- ============================================================================
-- grit_011_class_watchlist.sql
--
-- A member picks a recurring class slot (weekday + time + class identity, from the predicted
-- timetable) to auto-register for once the gym opens registration. Self-service, same RLS pattern as
-- visits/push_subscriptions (grit_002_rls.sql, grit_008_push_subscriptions.sql) — a member manages
-- their own watchlist rows directly, no extra Edge Function needed for that.
--
-- Also extends grit.push_log (grit_008) with a nullable watchlist_id, and its kind check constraint
-- with 'classopen', so the reminder push can be de-duped per watched class per day, not just per
-- member — a member may be watching more than one class.
--
-- ADDITIVE and idempotent; adds one new table, one column + index on an existing table.
-- ============================================================================
begin;

create table if not exists grit.class_watchlist (
  id                 uuid primary key default gen_random_uuid(),
  member_id          bigint not null default grit.current_member(),
  weekday            smallint not null check (weekday between 0 and 6), -- Mon = 0
  start_time         text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  class_name         text not null check (char_length(class_name) <= 120),
  package_id         integer,
  active             boolean not null default true,
  last_attempt_date  date,
  last_attempt_result text check (last_attempt_result is null or last_attempt_result in ('registered', 'waiting', 'failed', 'full', 'already')),
  created_at         timestamptz not null default now(),
  unique (member_id, weekday, start_time, class_name)
);
create index if not exists class_watchlist_member_idx on grit.class_watchlist (member_id);

alter table grit.class_watchlist enable row level security;
drop policy if exists own_rows on grit.class_watchlist;
create policy own_rows on grit.class_watchlist for all to grit_member
  using (member_id = grit.current_member())
  with check (member_id = grit.current_member());

alter table grit.push_log add column if not exists watchlist_id uuid;
create index if not exists push_log_watchlist_idx on grit.push_log (watchlist_id, sent_at desc) where watchlist_id is not null;

do $$
begin
  alter table grit.push_log drop constraint if exists push_log_kind_check;
  alter table grit.push_log add constraint push_log_kind_check check (kind in ('favclass', 'notracking', 'classopen'));
end
$$;

insert into grit.migrations (name) values ('grit_011_class_watchlist') on conflict do nothing;

commit;

notify pgrst, 'reload schema';
