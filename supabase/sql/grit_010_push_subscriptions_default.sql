-- ============================================================================
-- grit_010_push_subscriptions_default.sql
--
-- Fixes a bug in grit_008: grit.push_subscriptions.member_id was created as `not null` with NO default,
-- unlike every other member-owned table (members/visits/class_signups/body_metrics/badges all default
-- it to grit.current_member()). The client never sends member_id in an insert (same convention as those
-- other tables), so it arrived as NULL, and the RLS `with check (member_id = grit.current_member())`
-- rejected it with 403 before the not-null constraint was even reached.
-- ADDITIVE and idempotent; touches only this one column's default.
-- ============================================================================
begin;

alter table grit.push_subscriptions alter column member_id set default grit.current_member();

insert into grit.migrations (name) values ('grit_010_push_subscriptions_default') on conflict do nothing;

commit;

notify pgrst, 'reload schema';
