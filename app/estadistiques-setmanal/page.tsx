import { supabase } from '@/lib/supabase'
import { EstadistiquesSetmanalClient } from './EstadistiquesSetmanalClient'

export const dynamic = 'force-dynamic'

export default async function EstadistiquesSetmanalPage() {
  const { data } = await supabase.rpc('estadistiques_setmanal_jordi')

  return <EstadistiquesSetmanalClient initialData={(data as any) ?? []} />
}
