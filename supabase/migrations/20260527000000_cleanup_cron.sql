-- Migració: cleanup-login-attempts via pg_cron + pg_net
-- Aplicada el 2026-05-27 via Supabase MCP (ja activa al projecte).
--
-- Prerequisits (ja activats):
--   CREATE EXTENSION IF NOT EXISTS pg_net  SCHEMA extensions;
--   CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;
--
-- El cron crida l'Edge Function 'cleanup-login-attempts' cada dia a les 03:00 UTC.
-- L'Edge Function elimina les entrades de login_attempts amb més de 24h d'antiguitat.

-- Idempotent: esborra el job si existia amb un nom diferent
-- SELECT cron.unschedule('cleanup-login-attempts');

SELECT cron.schedule(
  'cleanup-login-attempts',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://uhslwgcjdiwycknvaplr.supabase.co/functions/v1/cleanup-login-attempts',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    )
  $$
);

-- Per verificar:
-- SELECT jobid, jobname, schedule, active FROM cron.job;
