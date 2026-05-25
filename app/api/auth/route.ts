import { NextRequest, NextResponse } from 'next/server'
import { validateUser, signSession, verifySession } from '@/lib/auth'
import { parseBody, AuthLoginBody } from '@/lib/schemas'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const RATE_LIMIT_MAX_FAILURES = 20
const RATE_LIMIT_WINDOW_MINUTES = 5
const RATE_LIMIT_BLOCK_SECONDS = 15 * 60

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(AuthLoginBody, raw)
  if (!parsed.ok) return parsed.response

  const supabase = getServiceClient()

  // Obtenir la data de l'últim login exitós per a aquesta IP
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()

  const { data: lastSuccess } = await supabase
    .from('login_attempts')
    .select('attempted_at')
    .eq('ip', ip)
    .eq('success', true)
    .order('attempted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sinceRef = lastSuccess?.attempted_at ?? new Date(0).toISOString()
  const effectiveFrom = sinceRef > windowStart ? sinceRef : windowStart

  // Comptar fallits recents des del darrer login exitós (o finestra de 5 min)
  const { count: recentFailures } = await supabase
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('success', false)
    .gt('attempted_at', effectiveFrom)

  if ((recentFailures ?? 0) >= RATE_LIMIT_MAX_FAILURES) {
    // Registrar l'intent bloquejat igualment (perquè l'atac quedi registrat)
    await supabase.from('login_attempts').insert({ ip, success: false })
    const res = NextResponse.json(
      { error: "Massa intents. Torna a provar d'aquí a uns 15 minuts" },
      { status: 429 }
    )
    res.headers.set('Retry-After', String(RATE_LIMIT_BLOCK_SECONDS))
    return res
  }

  // Validar credencials (bcrypt) — només s'executa si no estem bloquejats
  const { username, password } = parsed.data
  const userInfo = await validateUser(username, password)

  // Registrar l'intent (èxit o fallada)
  await supabase.from('login_attempts').insert({ ip, success: userInfo !== null })

  // Neteja amortitzada: ~2% de peticions esborren entrades de més de 24h
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('login_attempts')
      .delete()
      .lt('attempted_at', cutoff)
      .then(() => {})
  }

  if (!userInfo) {
    return NextResponse.json({ error: 'Usuari o contrasenya incorrectes' }, { status: 401 })
  }

  const token = await signSession(userInfo)
  const res = NextResponse.json({ ok: true, role: userInfo.role })
  res.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dies
  })
  return res
}

// logout: no requereix sessió vàlida — l'objectiu és esborrar la cookie
// El registre a audit_log és best-effort: si la sessió ja és invàlida, simplement no es registra
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get('session')?.value ?? null
  if (token) {
    verifySession(token).then(session => {
      if (!session) return
      const supabase = getServiceClient()
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
      supabase.from('audit_log').insert({
        user_id: session.userId,
        username: session.username,
        role: session.role,
        ip,
        method: 'DELETE',
        path: '/api/auth',
        payload: null,
        status_code: 200,
      }).then(() => {})
    }).catch(() => {})
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}
