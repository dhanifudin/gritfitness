-- ============================================================================
-- grit_007_visit_cost.sql
--
-- Optional spend for a logged visit, so non-GritFitness activities ("Lainnya", e.g. Hyrox, a run) can
-- carry a price and show up in budget totals. ADDITIVE and idempotent; touches only grit.visits.
--
--   * existing rows keep working: cost defaults to null (unknown/not entered)
--   * RLS and grants are unchanged (table-level grants cover the new column)
-- ============================================================================
begin;

alter table grit.visits
  add column if not exists cost numeric(10, 2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'visits_cost_chk' and conrelid = 'grit.visits'::regclass) then
    alter table grit.visits add constraint visits_cost_chk
      check (cost is null or cost >= 0);
  end if;
end
$$;

insert into grit.migrations (name) values ('grit_007_visit_cost') on conflict do nothing;

commit;

notify pgrst, 'reload schema';
