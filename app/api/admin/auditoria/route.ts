import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAudit } from '@/lib/audit'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// GET /api/admin/auditoria
// Paràmetres opcionals: user_id, path_like, from (ISO date), to (ISO date), limit (default 50), offset (default 0)
// Només accessible per rol admin (middleware + withAudit verifiquen sessió; canAccess filtra per admin)
export const GET = withAudit(async (request: Request) => {
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id') || null
  const pathLike = url.searchParams.get('path_like') || null
  const from = url.searchParams.get('from') || null
  const to = url.searchParams.get('to') || null
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  const supabase = getServiceClient()
  let query = supabase
    .from('audit_log')
    .select('id, ts, user_id, username, role, ip, method, path, payload, status_code', { count: 'exact' })
    .order('ts', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId) query = query.eq('user_id', userId)
  if (pathLike) query = query.ilike('path', `%${pathLike}%`)
  if (from) query = query.gte('ts', from)
  if (to) query = query.lte('ts', to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, total: count ?? 0, limit, offset })
})
