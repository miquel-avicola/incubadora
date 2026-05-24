import { NextResponse } from 'next/server'
import { validateUser, signSession } from '@/lib/auth'

export async function POST(request: Request) {
  const { username, password } = await request.json()
  const role = await validateUser(username, password)
  if (!role) {
    return NextResponse.json({ error: 'Usuari o contrasenya incorrectes' }, { status: 401 })
  }
  const token = await signSession(role)
  const res = NextResponse.json({ ok: true, role })
  res.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
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
