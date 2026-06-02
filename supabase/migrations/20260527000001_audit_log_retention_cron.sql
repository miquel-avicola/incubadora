-- Migració: retenció de 12 mesos per audit_log via pg_cron
-- Aplicada el 2026-05-27 via Supabase MCP (ja activa al projecte).
--
-- Prerequisit: pg_cron (ja activat per 20260527000000_cleanup_cron.sql)
--
-- El cron s'executa cada dia a les 03:15 UTC (15 min després de cleanup-login-attempts).
-- Elimina les entrades d'audit_log amb més de 12 mesos d'antiguitat.

SELECT cron.schedule(
  'cleanup-audit-log',
  '15 3 * * *',
  $$DELETE FROM audit_log WHERE ts < NOW() - INTERVAL '12 months'$$
);

-- Per verificar:
-- SELECT jobid, jobname, schedule, active FROM cron.job;
