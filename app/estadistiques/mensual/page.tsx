import { supabase } from '@/lib/supabase'
import { EstadistiquesClient } from './EstadistiquesClient'

export const dynamic = 'force-dynamic'

export default async function EstadistiquesMensualPage() {
  const { data: files } = await supabase.rpc('estadistiques_mensuals')

  return <EstadistiquesClient initialData={(files as any) ?? []} />
}
