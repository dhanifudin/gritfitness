-- ============================================================================
-- grit_003_audit.sql: READ-ONLY pollution audit. Run it BEFORE grit_001 and AFTER grit_002 and compare.
-- (Steps 4 and 6 show nothing / null before grit_001 because the role does not exist yet.)
-- Expected difference: new schema "grit" (6 tables + sequences/functions) and the role "grit_member". Nothing else.
-- ============================================================================

-- 1. Relations per schema (tables, views, sequences, indexes ...)
select n.nspname as schema, c.relkind as kind, count(*) as objects
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast') and n.nspname not like 'pg_temp%'
group by 1, 2 order by 1, 2;

-- 2. Functions per schema
select n.nspname as schema, count(*) as functions
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog', 'information_schema') group by 1 order by 1;

-- 3. Roles (expect exactly one new role: grit_member, NOLOGIN, not superuser)
select rolname, rolcanlogin, rolsuper from pg_roles where rolname not like 'pg\_%' order by 1;

-- 4. ISOLATION: tables outside "grit" that grit_member can touch. EXPECT 0 ROWS.
select n.nspname as schema, c.relname as relation, p.privilege
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p(privilege)
where c.relkind in ('r', 'v', 'm', 'p')
  and n.nspname not in ('grit', 'pg_catalog', 'information_schema', 'pg_toast')
  and to_regrole('grit_member') is not null
  and case when to_regrole('grit_member') is null then false else has_table_privilege('grit_member', c.oid, p.privilege) end;

-- 5. ISOLATION: can the other API roles touch grit? EXPECT 0 ROWS.
select r.rolname as role, c.relname as relation, p.privilege
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'grit'
cross join (values ('anon'), ('authenticated')) as r(rolname)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p(privilege)
where c.relkind = 'r' and has_table_privilege(r.rolname, c.oid, p.privilege);

-- 6. Schema usage of grit_member (expect true only for grit; "public" may show true through the PUBLIC pseudo-role,
--    which is harmless because step 4 shows it has no table rights there).
select nspname, case when to_regrole('grit_member') is null then null else has_schema_privilege('grit_member', nspname, 'USAGE') end as usage
from pg_namespace where nspname in ('grit', 'public', 'lulu', 'bomi', 'auth', 'storage') order by 1;
