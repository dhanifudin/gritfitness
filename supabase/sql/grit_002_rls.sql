-- ============================================================================
-- grit_002_rls.sql: Row Level Security for schema "grit". Idempotent.
--
-- Each member (JWT claim grit_member_id, minted by the grit-auth Edge Function after the gym's own
-- token was verified) can read and write only rows with their own member_id. There is no policy for any
-- other role, so anon, authenticated (lulu/bomi logins) and unauthenticated requests get nothing.
-- service_role bypasses RLS by design (server-side jobs only; never ship that key in the app).
-- ============================================================================
begin;

do $$
declare t text;
begin
  foreach t in array array['members', 'visits', 'class_signups', 'body_metrics', 'badges'] loop
    execute format('alter table grit.%I enable row level security', t);
    execute format('drop policy if exists own_rows on grit.%I', t);
    execute format(
      'create policy own_rows on grit.%I for all to grit_member
         using (member_id = grit.current_member())
         with check (member_id = grit.current_member())',
      t
    );
  end loop;
end
$$;

-- bookkeeping table: nobody but the owner/service_role touches it
alter table grit.migrations enable row level security;

insert into grit.migrations (name) values ('grit_002_rls') on conflict do nothing;

commit;
