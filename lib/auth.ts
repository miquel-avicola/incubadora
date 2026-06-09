import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
export { signSession, verifySession, canAccess, roleHome } from '@/lib/auth-edge'

// Client amb service_role: bypassa RLS, mai exposat al navegador
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function validateUser(username: string, password: string): Promise<{ userId: string; username: string; role: string } | null> {
  const supabase = getServiceClient()

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, password_hash, role, actiu')
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

  return { userId: user.id, username: user.username, role: user.role }
}

