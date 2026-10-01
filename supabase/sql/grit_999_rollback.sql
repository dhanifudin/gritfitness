-- ============================================================================
-- grit_999_rollback.sql: REMOVES everything grit created. DESTRUCTIVE: deletes all grit data.
-- Only for deliberately retiring the app. Touches nothing outside schema "grit" and role "grit_member".
-- ============================================================================
begin;
revoke grit_member from authenticator;
drop schema if exists grit cascade;
drop role if exists grit_member;
commit;
notify pgrst, 'reload schema';
