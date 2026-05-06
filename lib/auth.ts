const SECRET = process.env.AUTH_SECRET || 'miquel-avicola-secret-2024'

const USERS: Record<string, { password: string; role: string }> = {
  ous:        { password: 'ous',       role: 'recepcio'  },
  responsable:{ password: 'pollet',    role: 'carregues' },
  admin:      { password: 'pollet1234',role: 'admin'     },
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signSession(role: string): Promise<string> {
  const payload = btoa(JSON.stringify({ role, iat: Date.now() }))
  const key = await getKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return `${payload}.${sigB64}`
}

export async function verifySession(token: string): Promise<{ role: string } | null> {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  try {
    const key = await getKey()
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
    if (!valid) return null
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export function validateUser(username: string, password: string): string | null {
  const user = USERS[username.toLowerCase()]
  if (!user || user.password !== password) return null
  return user.role
}

export function canAccess(role: string, path: string): boolean {
  if (role === 'admin') return true

  // Pages that require admin
  const requiresAdmin = [
    /^\/lots($|\/)/,
    /^\/carrega\/nova($|\/)/,
    /^\/carrega\/[^/]+\/assignacions($|\/)/,
    /^\/carrega\/[^/]+\/vacunes($|\/)/,
    /^\/api\/carrega\/[^/]+\/assignacions($|\/)/,
  ]
  if (requiresAdmin.some(r => r.test(path))) return false

  if (role === 'carregues') return true

  if (role === 'recepcio') {
    return (
      path === '/' ||
      /^\/recepcio($|\/)/.test(path) ||
      /^\/estoc($|\/)/.test(path) ||
      /^\/api\//.test(path)
    )
  }

  return false
}

export function roleHome(role: string): string {
  if (role === 'recepcio') return '/recepcio'
  if (role === 'carregues') return '/carrega'
  return '/'
}
