import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DetallCarregaClient from './DetallCarregaClient'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function DetallCarregaPage({ params }: { params: { id: string } }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySession(token) : null
  const role = session?.role ?? 'recepcio'

  const [fullResult, clientsResult] = await Promise.all([
    supabase
      .from('fulls_carrega')
      .select(`
        id,
        num_carrega,
        carrega,
        transferencia,
        estat,
        comandes (
          id,
          tipus,
          quantitat_pollets,
          quantitat_ous_maquila,
          previsio_naixement,
          sexat,
          clients (id, nom)
        ),
        assignacions (
          id,
          num_carro_full,
          hora_entrada,
          previsio_naixement,
          previsio_manual,
          es_maquila,
          carros_estoc (
            id,
            posta,
            quantitat_ous,
            lots_reproductores (
              id,
              data_naixement,
              estirp,
              granges_reproductores (granja, nom_informal)
            )
          ),
          incubadores (id, numero, model, tipus),
          transferencies (id, resultats_naix (id))
        )
      `)
      .eq('id', params.id)
      .single(),
    supabase
      .from('clients')
      .select('id, nom')
      .order('nom'),
  ])

  if (fullResult.error || !fullResult.data) notFound()

  return (
    <DetallCarregaClient
      initialFull={fullResult.data as any}
      clients={clientsResult.data ?? []}
      role={role}
    />
  )
}
