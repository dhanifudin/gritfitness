-- ============================================================================
-- grit_013_rekey_members.sql
--
-- The gym replaced its API (api/* -> api/member/*) AND its member database: the same person now has
-- a new numeric member id (verified live: the owner's account moved from 7994 to 2870, same phone
-- number, kode 25CS0512). Every grit table is keyed on that id via grit.current_member(), so rows
-- written under an old id would become invisible to the re-keyed member. This migration re-keys the
-- known old->new pairs in every member-keyed table. Repeatable: re-running with the same pairs is a
-- no-op (update ... where member_id = old finds nothing the second time).
--
-- Add pairs to grit.member_rekey as other members are identified (phone is the stable key).
-- ============================================================================
begin;

create table if not exists grit.member_rekey (
  old_id bigint primary key,
  new_id bigint not null,
  note   text
);

insert into grit.member_rekey (old_id, new_id, note) values
  (7994, 2870, 'owner, phone 6282230743546, kode 25CS0512')
on conflict (old_id) do nothing;

do $$
declare
  t text;
  pair record;
begin
  for pair in select old_id, new_id from grit.member_rekey loop
    foreach t in array array['members', 'visits', 'class_signups', 'body_metrics', 'badges', 'member_sessions', 'push_subscriptions', 'push_log', 'class_watchlist'] loop
      execute format('update grit.%I set member_id = $1 where member_id = $2', t) using pair.new_id, pair.old_id;
    end loop;
  end loop;
end $$;

insert into grit.migrations (name) values ('grit_013_rekey_members') on conflict do nothing;

commit;

notify pgrst, 'reload schema';
