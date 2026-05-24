import { NextResponse } from 'next/server'
import { validateUser, signSession } from '@/lib/auth'
import { parseBody, AuthLoginBody } from '@/lib/schemas'

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(AuthLoginBody, raw)
  if (!parsed.ok) return parsed.response
  const { username, password } = parsed.data
  const role = await validateUser(username, password)
  if (!role) {
    return NextResponse.json({ error: 'Usuari o contrasenya incorrectes' }, { status: 401 })
  }
  const token = await signSession(role)
  const res = NextResponse.json({ ok: true, role })
  res.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 dies
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}
