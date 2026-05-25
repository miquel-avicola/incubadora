import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/auth'

const REDACT_KEYS = new Set(['password', 'password_hash', 'token', 'secret', 'authorization'])
const MAX_PAYLOAD_BYTES = 5 * 1024 // 5 KB

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function redact(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(redact)
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v)
  }
  return result
}

function truncatePayload(obj: unknown): unknown {
  const json = JSON.stringify(obj)
  if (json.length <= MAX_PAYLOAD_BYTES) return obj
  return { _truncated: true, _bytes: json.length, preview: json.slice(0, MAX_PAYLOAD_BYTES) }
}

async function insertAuditRow(row: {
  user_id: string
  username: string
  role: string
  ip: string | null
  method: string
  path: string
  payload: unknown
  status_code: number
}) {
  const supabase = getServiceClient()
  await supabase.from('audit_log').insert(row)
}

/**
 * Wrapper per a rutes API mutatives (POST, PATCH, DELETE, PUT).
 * Verifica la sessió, executa el handler i registra l'acció a audit_log.
 *
 * Excepcions:
 * - /api/auth POST (login): NO porta withAudit — no hi ha sessió encara.
 *   Els intents de login es registren via login_attempts.
 * - /api/auth DELETE (logout): SÍ porta withAudit.
 *
 * El wrapper és transparent: passa req i ctx al handler sense canviar la seva
 * signatura, per tant els params de rutes dinàmiques ([id], [inc_id], etc.)
 * continuen funcionant amb la desestructuració normal.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAudit(handler: (req: Request, ctx?: any) => Promise<Response>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: Request, ctx?: any): Promise<Response> => {
    // Obtenir la cookie de sessió via NextRequest per tenir decode automàtic
    const token = (req as NextRequest).cookies.get('session')?.value ?? null

    if (!token) {
      return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
    }

    const session = await verifySession(token)
    if (!session) {
      return NextResponse.json({ error: 'Sessió invàlida o expirada' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    const method = req.method
    const path = new URL(req.url).pathname

    let bodyClone: unknown = null
    try {
      bodyClone = await req.clone().json()
    } catch {
      // body buit o no JSON
    }

    const response = await handler(req, ctx)

    // Insertem en segon pla per no bloquejar la resposta
    insertAuditRow({
      user_id: session.userId,
      username: session.username,
      role: session.role,
      ip,
      method,
      path,
      payload: bodyClone ? truncatePayload(redact(bodyClone)) : null,
      status_code: response.status,
    }).catch(err => console.error('[audit] insert failed', err))

    return response
  }
}
