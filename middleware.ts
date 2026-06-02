import { NextRequest, NextResponse } from 'next/server'
import { verifySession, canAccess, roleHome } from '@/lib/auth'

/**
 * Construeix el header Content-Security-Policy amb el nonce generat per la petició.
 *
 * - 'nonce-{nonce}': permet scripts que tinguin aquest atribut exacte.
 * - 'strict-dynamic': confiar en scripts carregats per scripts ja confiats (nonce).
 *   Permet que Next.js carregui els seus chunks dinàmicament.
 * - 'unsafe-inline': ignorat per navegadors moderns quan hi ha nonce/strict-dynamic,
 *   però serveix de fallback per a navegadors molt antics.
 * - 'unsafe-eval': NOMÉS en desenvolupament (Next.js HMR ho necessita).
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://uhslwgcjdiwycknvaplr.supabase.co wss://uhslwgcjdiwycknvaplr.supabase.co",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Generar nonce per a aquesta petició
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)

  // Rutas públiques: login i auth → no cal verificar sessió, però sí aplicar CSP
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    const response = NextResponse.next({
      request: { headers: new Headers(request.headers) },
    })
    response.headers.set('Content-Security-Policy', csp)
    return response
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

  if (!canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(roleHome(session.role), request.url))
  }

  // Propagar el nonce via header de petició → Next.js l'aplica als seus scripts inline
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
