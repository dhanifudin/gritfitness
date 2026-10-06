-- ============================================================================
-- grit_012_signup_price.sql
--
-- Snapshot of the non-member class price on each class sign-up. Classes are free for members and paid
-- for non-members, so the price of a class a member registered for is what the membership saved them;
-- the app sums it against what the membership cost. Nullable: older sign-ups have no price and are
-- simply not counted.
--
-- ADDITIVE and idempotent: one new column, RLS untouched (the existing own_rows policy covers it).
-- ============================================================================
begin;

alter table grit.class_signups add column if not exists price numeric(12, 2);

insert into grit.migrations (name) values ('grit_012_signup_price') on conflict do nothing;

commit;

notify pgrst, 'reload schema';
