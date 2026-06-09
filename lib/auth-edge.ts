// Funcions compatibles amb Edge Runtime (sense dependències Node.js com bcryptjs)

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET no definit.')
  return secret
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signSession(params: { userId: string; username: string; role: string }): Promise<string> {
  const payload = btoa(JSON.stringify({ userId: params.userId, username: params.username, role: params.role, iat: Date.now() }))
  const key = await getKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigB64 = btoa(Array.from(new Uint8Array(sig), c => String.fromCharCode(c)).join(''))
  return `${payload}.${sigB64}`
}

export async function verifySession(token: string): Promise<{ userId: string; username: string; role: string } | null> {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const key = await getKey()
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
    if (!valid) return null
    const parsed = JSON.parse(atob(payload))
    if (Date.now() - parsed.iat > 7 * 24 * 60 * 60 * 1000) return null
    if (!parsed.userId || !parsed.username) return null
    return { userId: parsed.userId, username: parsed.username, role: parsed.role }
  } catch {
    return null
  }
}

export function canAccess(role: string, path: string): boolean {
  if (role === 'admin') return true

  const requiresAdmin = [
    /^\/lots($|\/)/,
    /^\/carrega\/nova($|\/)/,
    /^\/carrega\/[^/]+\/assignacions($|\/)/,
    /^\/carrega\/[^/]+\/vacunes($|\/)/,
    /^\/api\/carrega\/[^/]+\/assignacions($|\/)/,
    /^\/admin($|\/)/,
    /^\/api\/admin($|\/)/,
    /^\/api\/lots\/[^/]+$/,
  ]
  if (requiresAdmin.some(r => r.test(path))) return false

  if (role === 'carregues') return true

  if (role === 'recepcio') {
    if (path === '/') return true
    if (/^\/recepcio($|\/)/.test(path)) return true
    if (/^\/estoc($|\/)/.test(path)) return true
    if (/^\/api\/carros($|\/)/.test(path)) return true
    if (path === '/api/lots') return true
    if (/^\/api\/previsio-comercial$/.test(path)) return true
    return false
  }

  if (role === 'responsable') {
    if (path === '/') return true
    if (/^\/carrega($|\/)/.test(path)) return true
    if (/^\/api\/carrega($|\/)/.test(path)) return true
    if (/^\/api\/transferencia($|\/)/.test(path)) return true
    if (/^\/api\/naixement($|\/)/.test(path)) return true
    if (/^\/api\/expedicions($|\/)/.test(path)) return true
    return false
  }

  return false
}

export function roleHome(_role: string): string {
  return '/'
}
