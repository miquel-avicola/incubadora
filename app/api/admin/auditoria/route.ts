import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'
import { verifySession } from '@/lib/auth'

// GET /api/admin/auditoria
// Paràmetres opcionals: user_id, path_like, from (ISO date), to (ISO date), limit (default 50), offset (default 0)
// Només accessible per rol admin (middleware + withAudit verifiquen sessió; canAccess filtra per admin)
export const GET = withAudit(async (request: Request) => {
  // Defensa en profunditat: doble check de rol dins la ruta
  const token = (request as NextRequest).cookies.get('session')?.value ?? null
  const session = token ? await verifySession(token) : null
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 403 })
  }

  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id') || null
  const pathLike = url.searchParams.get('path_like') || null
  const from = url.searchParams.get('from') || null
  const to = url.searchParams.get('to') || null
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

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
