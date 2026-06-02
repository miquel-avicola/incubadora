import { supabase } from '@/lib/supabase'
import { EstadistiquesSetmanalClient } from './EstadistiquesSetmanalClient'

export const dynamic = 'force-dynamic'

export default async function EstadistiquesSetmanalPage() {
  const [resum, lots, clients] = await Promise.all([
    supabase.rpc('estadistiques_setmanal_jordi'),
    supabase.rpc('estadistiques_setmanal_jordi_lots'),
    supabase.rpc('estadistiques_setmanal_jordi_clients'),
  ])

  return (
    <EstadistiquesSetmanalClient
      initialData={(resum.data as any) ?? []}
      lotsData={(lots.data as any) ?? []}
      clientsData={(clients.data as any) ?? []}
    />
  )
}
