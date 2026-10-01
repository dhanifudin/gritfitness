-- ============================================================================
-- grit_005_activities.sql
--
-- Activity types for visits (gym, class, personal trainer, recovery, custom such as Hyrox) so members can record more
-- than "a gym visit" and back-fill past days. ADDITIVE and idempotent; touches only grit.visits.
--
--   * existing rows keep working: activity defaults to 'gym', counts_toward_goal to true
--   * rows that came from a class check-in (source = 'class') become activity = 'class'
--   * RLS and grants are unchanged (table-level grants cover the new columns)
-- ============================================================================
begin;

alter table grit.visits
  add column if not exists activity           text     not null default 'gym',
  add column if not exists activity_name      text,                       -- custom name for activity 'other' (e.g. Hyrox)
  add column if not exists counts_toward_goal boolean  not null default true,
  add column if not exists duration_min       smallint,
  add column if not exists class_id           integer;                    -- the gym's class package id (matches classInfo)

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visits_activity_chk' and conrelid = 'grit.visits'::regclass) then
    alter table grit.visits add constraint visits_activity_chk
      check (activity in ('gym', 'class', 'pt', 'recovery', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visits_activity_name_chk' and conrelid = 'grit.visits'::regclass) then
    alter table grit.visits add constraint visits_activity_name_chk
      check ((activity_name is null or char_length(activity_name) between 1 and 60)
             and (activity <> 'other' or activity_name is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'visits_duration_chk' and conrelid = 'grit.visits'::regclass) then
    alter table grit.visits add constraint visits_duration_chk
      check (duration_min is null or duration_min between 1 and 600);
  end if;
end
$$;

update grit.visits set activity = 'class' where source = 'class' and activity = 'gym';

insert into grit.migrations (name) values ('grit_005_activities') on conflict do nothing;

commit;

notify pgrst, 'reload schema';
