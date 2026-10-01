-- ============================================================================
-- grit_004_selftest.sql: proves Row Level Security isolation, atomically and without leaving anything behind.
--
-- A single DO block seeds two fake members, acts as one of them (role grit_member + a simulated token claim)
-- and checks isolation. It ALWAYS ends by raising an exception, which rolls everything back:
--   * success -> ERROR "grit selftest OK (rolled back)"   (an error by design: that is the pass signal)
--   * failure -> ERROR "FAIL: ..." describing what was visible/writable that should not be
-- Works the same in the SQL editor and through `supabase db query --linked`.
-- ============================================================================
do $$
declare n int;
begin
  -- seed as the owner (bypasses RLS): two members, one visit each
  insert into grit.visits (member_id, client_id, visited_on) values
    (900001, gen_random_uuid(), current_date),
    (900002, gen_random_uuid(), current_date);

  -- act as member 900001
  perform set_config('request.jwt.claims', '{"role":"grit_member","grit_member_id":"900001"}', true);
  set local role grit_member;

  select count(*) into n from grit.visits;
  if n <> 1 then raise exception 'FAIL: member sees % visits (expected only their own 1)', n; end if;

  select count(*) into n from grit.visits where member_id = 900002;
  if n <> 0 then raise exception 'FAIL: member can read another member''s visit'; end if;

  begin
    insert into grit.visits (member_id, client_id, visited_on) values (900002, gen_random_uuid(), current_date);
    raise exception 'FAIL: member inserted a row for another member';
  exception when insufficient_privilege or check_violation then null; -- expected (RLS WITH CHECK)
  end;

  update grit.visits set note = 'x' where member_id = 900002;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member updated another member''s row'; end if;

  delete from grit.visits where member_id = 900002;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: member deleted another member''s row'; end if;

  -- default member_id comes from the token
  insert into grit.visits (client_id, visited_on) values (gen_random_uuid(), current_date);
  select count(*) into n from grit.visits where member_id = 900001;
  if n <> 2 then raise exception 'FAIL: default member_id not applied (have % rows)', n; end if;

  -- no member claim in the token => nothing at all
  perform set_config('request.jwt.claims', '{"role":"grit_member"}', true);
  select count(*) into n from grit.visits;
  if n <> 0 then raise exception 'FAIL: request without member claim sees % rows', n; end if;

  -- the bookkeeping table is not reachable for the app role
  begin
    perform 1 from grit.migrations;
    raise exception 'FAIL: grit_member can read grit.migrations';
  exception when insufficient_privilege then null; -- expected
  end;

  reset role;
  raise exception 'grit selftest OK (rolled back)';
end
$$;
