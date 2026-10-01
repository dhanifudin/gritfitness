-- ============================================================================
-- grit_001_schema.sql
--
-- Creates the "grit" schema (self-tracker data for GritFitness members) on the shared Supabase project.
--
-- Safe to re-run (idempotent) and isolated from other apps:
--   * every table, function and sequence lives in schema "grit"
--   * the only object outside it is the NOLOGIN role "grit_member" (plus its membership in "authenticator")
--   * nothing in public, auth, storage, lulu or bomi is read or changed
--   * anon and authenticated get NO access to grit (unlike the lulu/bomi convention): the app's tokens carry
--     role "grit_member", so they cannot touch other schemas and other apps' users cannot touch grit
--   * tracked in grit.migrations (not in the shared supabase_migrations history)
-- ============================================================================
begin;

create schema if not exists grit;

create table if not exists grit.migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);

-- Dedicated role used by the JWTs minted by the grit-auth Edge Function (claim: role = grit_member).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'grit_member') then
    create role grit_member nologin;
  end if;
end
$$;
grant grit_member to authenticator; -- lets PostgREST switch to the role for requests carrying such a JWT

grant usage on schema grit to grit_member, service_role; -- service_role: server jobs (lesson from lulu migration 007)

-- Who is calling? Set by PostgREST from the JWT claim minted by grit-auth (the gym's member id).
create or replace function grit.current_member() returns bigint
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'grit_member_id', '')::bigint
$$;

create or replace function grit.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- ----------------------------------------------------------------------------
-- members: per-member settings (no name or phone: those stay in the gym system)
-- ----------------------------------------------------------------------------
create table if not exists grit.members (
  member_id       bigint primary key default grit.current_member(),
  goal_per_week   smallint not null default 3 check (goal_per_week between 1 and 7),
  goal_weight_kg  numeric(5,2) check (goal_weight_kg is null or goal_weight_kg between 20 and 400),
  reminder_hour   smallint check (reminder_hour is null or reminder_hour between 0 and 23),
  consented_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- visits: one row per logged workout (several per day are allowed; stats count distinct days)
-- ----------------------------------------------------------------------------
create table if not exists grit.visits (
  id          uuid primary key default gen_random_uuid(),
  member_id   bigint not null default grit.current_member(),
  client_id   uuid not null,                       -- generated on the device: makes syncing idempotent
  visited_on  date not null,
  visited_at  timestamptz,
  source      text not null default 'checkin' check (source in ('checkin', 'class', 'manual')),
  class_name  text check (class_name is null or char_length(class_name) <= 120),
  note        text check (note is null or char_length(note) <= 500),
  energy      smallint check (energy is null or energy between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (member_id, client_id)
);
create index if not exists visits_member_day_idx on grit.visits (member_id, visited_on desc);

-- ----------------------------------------------------------------------------
-- class_signups: classes the member registered for through the app
-- ----------------------------------------------------------------------------
create table if not exists grit.class_signups (
  member_id    bigint not null default grit.current_member(),
  schedule_id  bigint not null,                    -- the gym's jadwal-kelas id
  class_name   text not null check (char_length(class_name) <= 120),
  scheduled_on date not null,
  start_time   time,
  status       text not null default 'planned' check (status in ('planned', 'attended', 'cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (member_id, schedule_id)
);

-- ----------------------------------------------------------------------------
-- body_metrics: weight / waist / body fat over time (one row per member per day)
-- ----------------------------------------------------------------------------
create table if not exists grit.body_metrics (
  id           uuid primary key default gen_random_uuid(),
  member_id    bigint not null default grit.current_member(),
  measured_on  date not null,
  weight_kg    numeric(5,2) check (weight_kg is null or weight_kg between 20 and 400),
  waist_cm     numeric(5,1) check (waist_cm is null or waist_cm between 30 and 300),
  body_fat_pct numeric(4,1) check (body_fat_pct is null or body_fat_pct between 2 and 70),
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (member_id, measured_on),
  check (weight_kg is not null or waist_cm is not null or body_fat_pct is not null)
);

-- ----------------------------------------------------------------------------
-- badges: unlocked milestones (so a celebration is shown once across devices)
-- ----------------------------------------------------------------------------
create table if not exists grit.badges (
  member_id   bigint not null default grit.current_member(),
  badge_key   text not null check (char_length(badge_key) <= 60),
  unlocked_at timestamptz not null default now(),
  primary key (member_id, badge_key)
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['members', 'visits', 'class_signups', 'body_metrics'] loop
    execute format('drop trigger if exists touch_updated_at on grit.%I', t);
    execute format('create trigger touch_updated_at before update on grit.%I for each row execute function grit.touch_updated_at()', t);
  end loop;
end
$$;

-- Privileges: grit_member may use its own tables (RLS in grit_002 restricts it to its own rows).
grant select, insert, update, delete on all tables in schema grit to grit_member;
grant usage, select on all sequences in schema grit to grit_member;
grant execute on function grit.current_member() to grit_member;
revoke all on grit.migrations from grit_member;               -- bookkeeping table: not for the app
grant all on all tables in schema grit to service_role;
grant all on all sequences in schema grit to service_role;
grant all on all functions in schema grit to service_role;

-- Tables created later in grit get the same grants (scoped to this schema only).
alter default privileges in schema grit grant select, insert, update, delete on tables to grit_member;
alter default privileges in schema grit grant usage, select on sequences to grit_member;
alter default privileges in schema grit grant all on tables to service_role;
alter default privileges in schema grit grant all on sequences to service_role;
alter default privileges in schema grit grant all on functions to service_role;

insert into grit.migrations (name) values ('grit_001_schema') on conflict do nothing;

commit;

-- Make PostgREST notice the new schema/role (harmless; also add "grit" to Exposed schemas in the dashboard).
notify pgrst, 'reload schema';
