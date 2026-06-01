import { supabase } from '@/lib/supabase'
import { AssignacionsClient } from './AssignacionsClient'
import { calcularPrevisioFinal } from '@/lib/previsio'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0
export default async function AssignacionsPage({ params }: { params: { id: string } }) {
  // Fetch totes les dades en paral·lel
  const [fullRes, carrosRes, incRes, instRes] = await Promise.all([
    // 1. Full de càrrega
    supabase
      .from('fulls_carrega')
      .select(`
        id,
        num_carrega,
        carrega,
        transferencia,
        estat,
        observacions,
        comandes (
          id,
          client_id,
          tipus,
          quantitat_pollets,
          quantitat_ous_maquila,
          previsio_naixement,
          sexat,
          override_ordre_carrega,
          observacions,
          clients (id, nom, categoria, ordre_carrega)
        ),
        assignacions (
          id,
          num_carro_full,
          hora_entrada,
          previsio_naixement,
          previsio_manual,
          es_maquila,
          observacions,
          posicio,
          zona,
          incubadora_id,
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
          assignacio_vacunes (
            id,
            dosi,
            vacunes (id, nom, via)
          ),
          transferencies (
            id,
            ous_explosius,
            ous_fertils_vacunats,
            naixedora_id,
            naixedores (numero),
            resultats_naix (id, pollets_nascuts, sexat)
          )
        )
      `)
      .eq('id', params.id)
      .single(),

    // 2. Carros
    supabase
      .from('carros_estoc')
      .select(`
        id,
        posta,
        quantitat_ous,
        estat,
        recepcio,
        client_maquila_id,
        lots_reproductores (
          id,
          data_naixement,
          estirp,
          granges_reproductores (
            granja,
            nom_informal,
            qualitat
          )
        )
      `)
      .eq('estat', 'Disponible')
      .order('recepcio', { ascending: false }),

    // 3. Incubadores
    supabase
      .from('incubadores')
      .select(`
        id,
        numero,
        model,
        tipus,
        capacitat_carros,
        activa
      `)
      .order('numero', { ascending: true }),

    // 4. Instalacions (RPC)
    supabase.rpc('estat_instalacions')
  ])

  // Propera càrrega (per a l'anticipació d'estoc §2.5 del motor d'assignació)
  let carregaSeguent: string | null = null
  if (fullRes.data?.carrega) {
    const propereRes = await supabase
      .from('fulls_carrega')
      .select('carrega')
      .gt('carrega', fullRes.data.carrega)
      .order('carrega', { ascending: true })
      .limit(1)
      .maybeSingle()
    carregaSeguent = propereRes.data?.carrega ?? null
  }

  const initialFull = fullRes.data ? { ...fullRes.data, carrega_seguent: carregaSeguent } : null
  const initialDisponibles = carrosRes.data ?? []
  const initialIncs = incRes.data ?? []
  const initialEstatInst = instRes.data ?? { incubadores: [], naixedores: [], generat_a: new Date().toISOString() }

  // Calcular la previsió de naixement per a cada carro amb la fórmula completa
  const dataRef = initialFull?.carrega || new Date().toISOString()
  const previsioCache = new Map<string, number>()

  async function getPrevisio(lotId: number, estirp: string | null, posta: string, dataNaix: string) {
    const setm = Math.floor((new Date(posta).getTime() - new Date(dataNaix).getTime()) / (7 * 24 * 60 * 60 * 1000))
    const key = `${lotId}-${setm}`
    if (previsioCache.has(key)) return previsioCache.get(key)!
    const res = await calcularPrevisioFinal(lotId, estirp || 'Ross', setm, 'Multistage', dataRef)
    previsioCache.set(key, res.previsio)
    return res.previsio
  }

  for (const c of initialDisponibles) {
    if (c.lots_reproductores) {
      const lot: any = Array.isArray(c.lots_reproductores) ? c.lots_reproductores[0] : c.lots_reproductores;
      ;(c as any).previsio_pct = await getPrevisio(lot.id, lot.estirp, c.posta, lot.data_naixement)
    }
  }

  if (initialFull && initialFull.assignacions) {
    for (const a of initialFull.assignacions) {
      const cEstoc = a.carros_estoc as any;
      if (cEstoc && cEstoc.lots_reproductores) {
        const lot: any = Array.isArray(cEstoc.lots_reproductores) ? cEstoc.lots_reproductores[0] : cEstoc.lots_reproductores;
        cEstoc.previsio_pct = await getPrevisio(lot.id, lot.estirp, cEstoc.posta, lot.data_naixement)
      }
    }
  }

  return (
    <AssignacionsClient
      initialFull={initialFull}
      initialDisponibles={initialDisponibles}
      initialIncs={initialIncs}
      initialEstatInst={initialEstatInst}
    />
  )
}
