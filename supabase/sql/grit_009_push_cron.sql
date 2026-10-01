-- ============================================================================
-- grit_009_push_cron.sql
--
-- Schedules grit-push-check (the favourite-class / no-tracking push sweep) via pg_cron, every 30
-- minutes. This is the one piece of this project that touches SHARED, project-wide catalogs (vault,
-- cron) rather than schema grit alone, since pg_cron and Vault are not schema-scoped — lulu already has
-- three jobs here (lulu-reminder-*), so the job name below is prefixed the same way to avoid collision.
--
-- The secret is stored in Supabase Vault and referenced indirectly in the cron job body rather than
-- embedded in it, since cron.job is a project-wide catalog other collaborators can read. This is
-- defense in depth, not the real safety boundary: it only protects against the secret leaking via
-- cron.job/logs/query history, not against someone who already has full SQL-editor access to the
-- project (who could read vault.decrypted_secrets just as easily). What actually protects members is
-- that grit-push-check only ever reads already-stored data to decide whether to notify.
--
-- Run with the real secret substituted for <<CRON_SECRET>> below (never commit the real value — see
-- docs/grit-supabase.md). Idempotent: safe to re-run with a new secret to rotate it.
-- ============================================================================
begin;

do $$
begin
  if exists (select 1 from vault.decrypted_secrets where name = 'grit_cron_secret') then
    perform vault.update_secret(
      (select id from vault.decrypted_secrets where name = 'grit_cron_secret'),
      '<<CRON_SECRET>>'
    );
  else
    perform vault.create_secret('<<CRON_SECRET>>', 'grit_cron_secret', 'Bearer value grit-push-check checks on cron-triggered calls');
  end if;
end
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'grit-push-check') then
    perform cron.unschedule('grit-push-check');
  end if;
end
$$;

select cron.schedule(
  'grit-push-check',
  '*/30 * * * *',
  $cron$
  select net.http_post(
    url := 'https://foecqcuylmlaocxpbrcd.supabase.co/functions/v1/grit-push-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'grit_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

commit;
