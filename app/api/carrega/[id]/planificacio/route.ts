import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { obtenirNaixementPct, llegirParametresPrevisio } from '@/lib/previsio'

// La planificació canvia l'estat dels carros i de les assignacions. Cal que les
// rutes que llegeixen aquesta info després d'una crida no rebin cache de Next.js.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type ZonaMS = 'central' | 'paret' | 'pulsator'

interface ItemPlanificacio {
  carro_id: number
  incubadora_id: number
  posicio: number
  zona: ZonaMS | null
}

interface BodyPlanificacio {
  dia: 'dijous' | 'dilluns'
  msp_ordre?: number[] | null
  items: ItemPlanificacio[]
}

/**
 * PUT /api/carrega/[id]/planificacio
 *
 * Substitueix de manera declarativa la planificacio sencera del full. Rep totes
 * les assignacions com a lot i crida la funcio PL/pgSQL `guarda_planificacio_full`,
 * que ho fa tot en una sola transaccio (validacio, calcul de num_carro_full per
 * offset+posicio, esborrat d'orfes verges, INSERT/UPDATE, marcatge d'estat).
 *
 * Despres de la RPC, recalcula `previsio_naixement` per a totes les assignacions
 * del full que no estiguin marcades com a `previsio_manual=true`. La previsio es
 * calcula amb `obtenirNaixementPct(estirp, setmanes_vida, tipus_incubadora)` de
 * `lib/previsio.ts` (no `obtenirEclosio`, que retorna taxa sobre fertils i no
 * sobre ous totals!). Les previsions calculades es cachegen per
 * (estirp, setmanes, tipus) per evitar crides duplicades.
 *
 * Casos d'error rellevants:
 *  - ORFES_BLOQUEJADES: alguna assignacio orfe te transferencia o vacuna -> 409
 *    amb llista detallada per pintar a l'UI.
 *  - Altres validacions internes (duplicats al lot, posicions fora de rang...) -> 400.
 *  - Errors al recalcul de previsio: NO bloquegen la resposta (la planificacio
 *    ja s'ha guardat). S'inclouen els comptadors `previsio_recalculats` i
 *    `previsio_errors` per al diagnostic.
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let body: BodyPlanificacio
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
  }

  const { dia, msp_ordre, items } = body

  if (dia !== 'dijous' && dia !== 'dilluns') {
    return NextResponse.json(
      { error: "Camp 'dia' ha de ser 'dijous' o 'dilluns'" },
      { status: 400 }
    )
  }
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Camp 'items' es obligatori i ha de ser un array" }, { status: 400 })
  }

  const fullId = parseInt(params.id, 10)
  if (!Number.isFinite(fullId)) {
    return NextResponse.json({ error: 'Full no valid' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('guarda_planificacio_full', {
    p_full_id: fullId,
    p_dia: dia,
    p_msp_ordre: msp_ordre && msp_ordre.length ? msp_ordre : null,
    p_items: items,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.startsWith('ORFES_BLOQUEJADES:')) {
      try {
        const jsonStr = msg.substring('ORFES_BLOQUEJADES:'.length).trim()
        const orfes = JSON.parse(jsonStr)
        return NextResponse.json(
          {
            error: "Hi ha carros del full que no apareixen al lot nou pero ja tenen transferencia o vacunes vinculades. No es poden esborrar.",
            orfes_bloquejades: orfes,
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        )
      } catch {
        return NextResponse.json({ error: msg }, { status: 409 })
      }
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // -- Recalcul de previsio_naixement --
  // No bloqueja la resposta: si alguna part falla, la planificacio ja esta
  // guardada i nomes cal repassar manualment. Comptadors a la resposta.
  const recalculInfo = await recalcularPrevisions(fullId)

  return NextResponse.json(
    { ...data, ...recalculInfo },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// ---------------------------------------------------------------------------
// Recalcul de previsio_naixement per a les assignacions d'un full
// ---------------------------------------------------------------------------

interface AssignacioPerRecalcul {
  id: number
  previsio_manual: boolean
  carros_estoc: {
    quantitat_ous: number
    posta: string
    lots_reproductores: {
      estirp: string | null
      data_naixement: string | null
    } | null
  } | null
  incubadores: {
    tipus: string
  } | null
}

async function recalcularPrevisions(fullId: number): Promise<{
  previsio_recalculats: number
  previsio_errors: number
  previsio_skipped_manual: number
}> {
  const { data: assignacionsActuals, error: errSel } = await supabase
    .from('assignacions')
    .select(`
      id,
      previsio_manual,
      carros_estoc (
        quantitat_ous,
        posta,
        lots_reproductores ( estirp, data_naixement )
      ),
      incubadores ( tipus )
    `)
    .eq('full_carrega_id', fullId)

  if (errSel || !assignacionsActuals) {
    return { previsio_recalculats: 0, previsio_errors: 0, previsio_skipped_manual: 0 }
  }

  const paramsPrevisio = await llegirParametresPrevisio()
  const naixementCache = new Map<string, number>()

  let recalculats = 0
  let errors = 0
  let skippedManual = 0

  // Sense paral.lelitzar, per aprofitar la cache de naixement per (estirp, setmanes, tipus).
  // Volum esperat: <= 80 assignacions per full -> temps total < 2s al pitjor cas.
  const llista = assignacionsActuals as unknown as AssignacioPerRecalcul[]
  for (let i = 0; i < llista.length; i++) {
    const a = llista[i]
    if (a.previsio_manual) {
      skippedManual++
      continue
    }

    const carro = a.carros_estoc
    const inc = a.incubadores
    const lot = carro ? carro.lots_reproductores : null

    if (!carro || !inc || !lot || !lot.estirp || !lot.data_naixement || !carro.posta) {
      errors++
      continue
    }

    const dataNaix = new Date(lot.data_naixement)
    const dataPosta = new Date(carro.posta)
    const setmanes = Math.floor(
      (dataPosta.getTime() - dataNaix.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )

    if (!Number.isFinite(setmanes) || setmanes < 1 || setmanes > 100) {
      errors++
      continue
    }

    const cacheKey = lot.estirp + '|' + setmanes + '|' + inc.tipus
    let naixement = naixementCache.get(cacheKey)

    if (naixement === undefined) {
      try {
        const r = await obtenirNaixementPct(lot.estirp, setmanes, inc.tipus, paramsPrevisio)
        naixement = r.previsio
        naixementCache.set(cacheKey, naixement)
      } catch {
        errors++
        continue
      }
    }

    const { error: errUpd } = await supabase
      .from('assignacions')
      .update({ previsio_naixement: naixement })
      .eq('id', a.id)

    if (errUpd) errors++
    else recalculats++
  }

  return {
    previsio_recalculats: recalculats,
    previsio_errors: errors,
    previsio_skipped_manual: skippedManual,
  }
}
