import { supabase } from '@/lib/supabase'
import { EstadistiquesClient } from './EstadistiquesClient'

export const dynamic = 'force-dynamic'

export default async function EstadistiquesPage() {
  const { data: fulls } = await supabase
    .from('fulls_carrega')
    .select(`
      id,
      carrega,
      assignacions (
        id,
        carros_estoc (quantitat_ous),
        transferencies (
          ous_fertils_vacunats,
          resultats_naix (pollets_nascuts, pollets_descartats)
        )
      ),
      comandes (
        id,
        tipus,
        expedicions (
          pollets_servits,
          pollets_comanda,
          destinacions (codi_rega)
        )
      )
    `)
    .not('carrega', 'is', null)

  return <EstadistiquesClient initialData={fulls as any} />
}
