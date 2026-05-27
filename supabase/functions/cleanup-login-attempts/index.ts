/**
 * Edge Function: cleanup-login-attempts
 *
 * Elimina entrades de login_attempts amb més de 24 hores d'antiguitat.
 * Invocada per pg_cron cada matí a les 03:00 UTC.
 *
 * Per activar el cron, executa la migració:
 *   supabase/migrations/20260527000000_cleanup_cron.sql
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (_req: Request) => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await supabase
    .from('login_attempts')
    .delete({ count: 'exact' })
    .lt('attempted_at', cutoff)

  if (error) {
    console.error('cleanup-login-attempts error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log(`cleanup-login-attempts: eliminats ${count ?? 0} registres anteriors a ${cutoff}`)
  return new Response(JSON.stringify({ ok: true, eliminats: count ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
