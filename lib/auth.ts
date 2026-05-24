import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const SECRET: string = process.env.AUTH_SECRET ?? (() => { throw new Error('AUTH_SECRET no definit. Afegeix-lo a les variables d\'entorn.') })()

// Client amb service_role: bypassa RLS, mai exposat al navegador
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
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
  const sigB64 = btoa(Array.from(new Uint8Array(sig), c => String.fromCharCode(c)).join(''))
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
    const parsed = JSON.parse(atob(payload))
    // Expiració: 7 dies des de la creació del token
    if (Date.now() - parsed.iat > 7 * 24 * 60 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}

export async function validateUser(username: string, password: string): Promise<string | null> {
  const supabase = getServiceClient()

  const { data: user, error } = await supabase
    .from('users')
    .select('id, password_hash, role, actiu')
    .eq('username', username.toLowerCase())
    .single()

  if (error || !user || !user.actiu) return null

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return null

  // Actualitzem last_login en segon pla (no bloqueja el login si falla)
  supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id)
    .then(() => {})

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

export function roleHome(_role: string): string {
  return '/'
}
