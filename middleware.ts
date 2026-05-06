import { NextRequest, NextResponse } from 'next/server'
import { verifySession, canAccess, roleHome } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const session = await verifySession(token)
  if (!session) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    res.cookies.delete('session')
    return res
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL(roleHome(session.role), request.url))
  }

  if (!canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(roleHome(session.role), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
