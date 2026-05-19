import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ZonaMS = 'central' | 'paret' | 'pulsator'

interface BodyPatch {
  incubadora_id?: number
  posicio?: number
  zona?: ZonaMS | null
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
 * Actualitza posicio, zona i/o incubadora_id d'una assignació existent. Pensat
 * per al mode edició de /instal·lacions: NO recalcula num_carro_full (és
 * "etiqueta física estampada" del dia de la càrrega).
 *
 * Regles:
 *  - Només es pot moure entre incubadores del mateix subtipus (SS↔SS, MSG↔MSG, MSP↔MSP).
 *  - posicio i zona han de ser coherents amb la incubadora destí.
 *  - No es permet col·lisió amb cap altra assignació activa al mateix full a la
 *    mateixa cel·la (inc, posicio, zona).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const assignacioId = parseInt(params.id, 10)
  if (!Number.isFinite(assignacioId)) {
    return NextResponse.json({ error: 'ID d\'assignació no vàlid' }, { status: 400 })
  }

  let body: BodyPatch
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  }

  // 1. Carregar assignació actual + incubadora origen
  const { data: actual, error: errActual } = await supabase
    .from('assignacions')
    .select('id, full_carrega_id, incubadora_id, posicio, zona, incubadores(tipus, capacitat_carros)')
    .eq('id', assignacioId)
    .single()

  if (errActual || !actual) {
    return NextResponse.json({ error: 'Assignació no trobada' }, { status: 404 })
  }

  // Compatibilitat amb el shape que Supabase retorna per a la relació (objecte o array)
  const incOrigenRaw = (actual as unknown as { incubadores: { tipus: string; capacitat_carros: number } | { tipus: string; capacitat_carros: number }[] }).incubadores
  const incOrigen = Array.isArray(incOrigenRaw) ? incOrigenRaw[0] : incOrigenRaw
  const subOrigen = subtipus(incOrigen.tipus, incOrigen.capacitat_carros)

  // Camps nous (si no es passen, mantenim els actuals)
  const novaIncId = body.incubadora_id ?? actual.incubadora_id
  const novaPosicio = body.posicio ?? actual.posicio
  const novaZona: ZonaMS | null = body.zona === undefined ? (actual.zona as ZonaMS | null) : body.zona

  if (novaPosicio === null || novaPosicio === undefined) {
    return NextResponse.json({ error: 'Falta posicio' }, { status: 400 })
  }

  // 2. Validar que la nova incubadora existeix i és del mateix subtipus
  const { data: incDesti } = await supabase
    .from('incubadores')
    .select('id, tipus, capacitat_carros')
    .eq('id', novaIncId)
    .single()

  if (!incDesti) {
    return NextResponse.json({ error: 'Incubadora destí no trobada' }, { status: 404 })
  }

  const subDesti = subtipus(incDesti.tipus, incDesti.capacitat_carros)
  if (subDesti !== subOrigen || subDesti === 'UNKNOWN') {
    return NextResponse.json(
      { error: `Només es pot moure entre incubadores del mateix tipus (origen: ${subOrigen}, destí: ${subDesti})` },
      { status: 400 }
    )
  }

  // 3. Validar coherència posicio/zona amb tipus destí
  if (subDesti === 'SS') {
    if (novaPosicio < 1 || novaPosicio > 24) {
      return NextResponse.json({ error: 'Posicio fora de rang per SS (1-24)' }, { status: 400 })
    }
    if (novaZona !== null) {
      return NextResponse.json({ error: 'SS no admet zona' }, { status: 400 })
    }
  } else {
    if (!novaZona || !['central', 'paret', 'pulsator'].includes(novaZona)) {
      return NextResponse.json({ error: "Zona obligatòria per MS (central/paret/pulsator)" }, { status: 400 })
    }
    if (subDesti === 'MSG' && (novaPosicio < 1 || novaPosicio > 8)) {
      return NextResponse.json({ error: 'Posicio fora de rang per MSG (1-8)' }, { status: 400 })
    }
    if (subDesti === 'MSP' && (novaPosicio < 1 || novaPosicio > 4)) {
      return NextResponse.json({ error: 'Posicio fora de rang per MSP (1-4)' }, { status: 400 })
    }
  }

  // 4. Validar que no hi ha col·lisió a la cel·la destí (al MATEIX full).
  //    Recordar: la unicitat de posicio dins el full és la regla acordada.
  const { data: xocs } = await supabase
    .from('assignacions')
    .select('id, num_carro_full')
    .eq('full_carrega_id', actual.full_carrega_id)
    .eq('incubadora_id', novaIncId)
    .eq('posicio', novaPosicio)
    .neq('id', assignacioId)
  const xocsFiltrats = (xocs || []).filter(x => {
    // Per a MS també cal mateixa zona; a SS la zona és NULL
    return subDesti === 'SS' ? true : true // mateixa zona la afegim a sota
  })
  // Per simplicitat fem el filtre de zona en una segona query si MS
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
        { error: `La cel·la destí ja està ocupada pel carro ${xocsZona[0].num_carro_full}` },
        { status: 409 }
      )
    }
  } else if (subDesti === 'SS' && xocsFiltrats.length > 0) {
    return NextResponse.json(
      { error: `La cel·la destí ja està ocupada pel carro ${xocsFiltrats[0].num_carro_full}` },
      { status: 409 }
    )
  }

  // 5. Actualitzar — sense tocar num_carro_full
  const update: { incubadora_id: number; posicio: number; zona: ZonaMS | null; zona_actualitzada_at?: string } = {
    incubadora_id: novaIncId,
    posicio: novaPosicio,
    zona: novaZona,
  }
  if (novaZona !== null) {
    update.zona_actualitzada_at = new Date().toISOString()
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
