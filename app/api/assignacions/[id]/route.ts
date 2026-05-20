import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ZonaMS = 'central' | 'paret' | 'pulsator'

interface BodyPatch {
  incubadora_id?: number
  posicio?: number
  zona?: ZonaMS | null
  previsio_naixement?: number | null
  es_maquila?: boolean
}

/**
 * Mateix "subtipus" físic d'incubadora: SS, MSG (Multistage cap 24) o MSP (cap 12).
 * El mode edició només permet moure carros entre incubadores del mateix subtipus.
 */
function subtipus(tipus: string, cap: number): 'SS' | 'MSG' | 'MSP' | 'UNKNOWN' {
  if (tipus === 'Singlestage') return 'SS'
  if (tipus === 'Multistage' && cap === 24) return 'MSG'
  if (tipus === 'Multistage' && cap === 12) return 'MSP'
  return 'UNKNOWN'
}

/**
 * PATCH /api/assignacions/[id]
 *
 * Dos modes:
 *
 * 1. MODE MOVIMENT (incubadora_id, posicio, zona) — per al drag-and-drop de
 *    /instal·lacions. NO recalcula num_carro_full (és "etiqueta física estampada"
 *    del dia de la càrrega). Només es pot moure entre incubadores del mateix
 *    subtipus (SS↔SS, MSG↔MSG, MSP↔MSP). Detecta col·lisió a la cel·la destí.
 *
 * 2. MODE PREVISIO MANUAL (previsio_naixement) — per a l'edició al detall del
 *    full. Si el valor és un nombre entre 0 i 1, marca previsio_manual=true
 *    perquè el PUT /planificacio no la sobreescrigui en futures replanificacions.
 *    Si és null, torna l'assignació al càlcul automàtic (previsio_manual=false).
 *
 * Els dos modes es poden combinar a la mateixa crida si cal.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const assignacioId = parseInt(params.id, 10)
  if (!Number.isFinite(assignacioId)) {
    return NextResponse.json({ error: "ID d'assignacio no valid" }, { status: 400 })
  }

  let body: BodyPatch
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
  }

  const teMoviment =
    body.incubadora_id !== undefined ||
    body.posicio !== undefined ||
    body.zona !== undefined
  const tePrevisio = body.previsio_naixement !== undefined
  const teMaquila = body.es_maquila !== undefined

  if (!teMoviment && !tePrevisio && !teMaquila) {
    return NextResponse.json({ error: 'Body buit (cal moviment, previsio o es_maquila)' }, { status: 400 })
  }

  // -- Mode es_maquila sol --
  if (teMaquila && !teMoviment && !tePrevisio) {
    const { error: errUpd } = await supabase
      .from('assignacions')
      .update({ es_maquila: body.es_maquila })
      .eq('id', assignacioId)
    if (errUpd) return NextResponse.json({ error: errUpd.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // -- Mode previsio manual sol (sense moviment) --
  if (tePrevisio && !teMoviment) {
    const prev = body.previsio_naixement
    if (prev !== null) {
      if (typeof prev !== 'number' || !Number.isFinite(prev) || prev < 0 || prev > 1) {
        return NextResponse.json(
          { error: 'previsio_naixement ha de ser un nombre entre 0 i 1, o null per tornar a auto' },
          { status: 400 }
        )
      }
    }
    const { error: errUpd } = await supabase
      .from('assignacions')
      .update({
        previsio_naixement: prev,
        previsio_manual: prev !== null,
      })
      .eq('id', assignacioId)

    if (errUpd) {
      return NextResponse.json({ error: errUpd.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // -- Mode moviment (potser combinat amb previsio) --

  // 1. Carregar assignacio actual + incubadora origen
  const { data: actual, error: errActual } = await supabase
    .from('assignacions')
    .select('id, full_carrega_id, incubadora_id, posicio, zona, incubadores(tipus, capacitat_carros)')
    .eq('id', assignacioId)
    .single()

  if (errActual || !actual) {
    return NextResponse.json({ error: 'Assignacio no trobada' }, { status: 404 })
  }

  const incOrigenRaw = (actual as unknown as { incubadores: { tipus: string; capacitat_carros: number } | { tipus: string; capacitat_carros: number }[] }).incubadores
  const incOrigen = Array.isArray(incOrigenRaw) ? incOrigenRaw[0] : incOrigenRaw
  const subOrigen = subtipus(incOrigen.tipus, incOrigen.capacitat_carros)

  const novaIncId = body.incubadora_id ?? actual.incubadora_id
  const novaPosicio = body.posicio ?? actual.posicio
  const novaZona: ZonaMS | null = body.zona === undefined ? (actual.zona as ZonaMS | null) : body.zona

  if (novaPosicio === null || novaPosicio === undefined) {
    return NextResponse.json({ error: 'Falta posicio' }, { status: 400 })
  }

  // 2. Validar incubadora desti + mateix subtipus
  const { data: incDesti } = await supabase
    .from('incubadores')
    .select('id, tipus, capacitat_carros')
    .eq('id', novaIncId)
    .single()

  if (!incDesti) {
    return NextResponse.json({ error: 'Incubadora desti no trobada' }, { status: 404 })
  }

  const subDesti = subtipus(incDesti.tipus, incDesti.capacitat_carros)
  if (subDesti !== subOrigen || subDesti === 'UNKNOWN') {
    return NextResponse.json(
      { error: `Nomes es pot moure entre incubadores del mateix tipus (origen: ${subOrigen}, desti: ${subDesti})` },
      { status: 400 }
    )
  }

  // 3. Validar coherencia posicio/zona amb tipus desti
  if (subDesti === 'SS') {
    if (novaPosicio < 1 || novaPosicio > 24) {
      return NextResponse.json({ error: 'Posicio fora de rang per SS (1-24)' }, { status: 400 })
    }
    if (novaZona !== null) {
      return NextResponse.json({ error: 'SS no admet zona' }, { status: 400 })
    }
  } else {
    if (!novaZona || !['central', 'paret', 'pulsator'].includes(novaZona)) {
      return NextResponse.json({ error: 'Zona obligatoria per MS (central/paret/pulsator)' }, { status: 400 })
    }
    if (subDesti === 'MSG' && (novaPosicio < 1 || novaPosicio > 8)) {
      return NextResponse.json({ error: 'Posicio fora de rang per MSG (1-8)' }, { status: 400 })
    }
    if (subDesti === 'MSP' && (novaPosicio < 1 || novaPosicio > 4)) {
      return NextResponse.json({ error: 'Posicio fora de rang per MSP (1-4)' }, { status: 400 })
    }
  }

  // 4. Validar que no hi ha col.lisio a la cel.la desti (mateix full)
  if (subDesti !== 'SS' && novaZona) {
    const { data: xocsZona } = await supabase
      .from('assignacions')
      .select('id, num_carro_full')
      .eq('full_carrega_id', actual.full_carrega_id)
      .eq('incubadora_id', novaIncId)
      .eq('posicio', novaPosicio)
      .eq('zona', novaZona)
      .neq('id', assignacioId)
    if (xocsZona && xocsZona.length > 0) {
      return NextResponse.json(
        { error: `La cel.la desti ja esta ocupada pel carro ${xocsZona[0].num_carro_full}` },
        { status: 409 }
      )
    }
  } else if (subDesti === 'SS') {
    const { data: xocs } = await supabase
      .from('assignacions')
      .select('id, num_carro_full')
      .eq('full_carrega_id', actual.full_carrega_id)
      .eq('incubadora_id', novaIncId)
      .eq('posicio', novaPosicio)
      .neq('id', assignacioId)
    if (xocs && xocs.length > 0) {
      return NextResponse.json(
        { error: `La cel.la desti ja esta ocupada pel carro ${xocs[0].num_carro_full}` },
        { status: 409 }
      )
    }
  }

  // 5. Actualitzar (sense tocar num_carro_full)
  const update: {
    incubadora_id: number
    posicio: number
    zona: ZonaMS | null
    zona_actualitzada_at?: string
    previsio_naixement?: number | null
    previsio_manual?: boolean
  } = {
    incubadora_id: novaIncId,
    posicio: novaPosicio,
    zona: novaZona,
  }
  if (novaZona !== null) {
    update.zona_actualitzada_at = new Date().toISOString()
  }
  if (tePrevisio) {
    const prev = body.previsio_naixement
    if (prev !== null && (typeof prev !== 'number' || !Number.isFinite(prev) || prev < 0 || prev > 1)) {
      return NextResponse.json(
        { error: 'previsio_naixement ha de ser un nombre entre 0 i 1, o null' },
        { status: 400 }
      )
    }
    update.previsio_naixement = prev
    update.previsio_manual = prev !== null
  }

  const { error: errUpdate } = await supabase
    .from('assignacions')
    .update(update)
    .eq('id', assignacioId)

  if (errUpdate) {
    return NextResponse.json({ error: errUpdate.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
