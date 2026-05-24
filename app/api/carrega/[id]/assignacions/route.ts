import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, CarregaAssignacionsPostBody, CarregaAssignacionsDeleteBody } from '@/lib/schemas'

type ZonaMS = 'central' | 'paret' | 'pulsator'
const ZONES_VALIDES: ZonaMS[] = ['central', 'paret', 'pulsator']

type AssignacioInsert = {
  full_carrega_id: number
  carro_id: number
  incubadora_id: number
  num_carro_full: number
  posicio: number | null
  zona: ZonaMS | null
  zona_actualitzada_at?: string
  hora_entrada: string | null
  previsio_naixement: number | null
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(CarregaAssignacionsPostBody, raw)
  if (!parsed.ok) return parsed.response
  const {
    carro_ids,
    incubadora_id,
    hora_entrada,
    previsio_naixement,
    posicions,
    zona,
  } = parsed.data

  const { data: incubadora } = await supabase
    .from('incubadores')
    .select('capacitat_carros, tipus')
    .eq('id', incubadora_id)
    .single()

  if (!incubadora) {
    return NextResponse.json({ error: 'Incubadora no trobada' }, { status: 404 })
  }

  const isSinglestage = incubadora.tipus === 'Singlestage'
  const capacitat = incubadora.capacitat_carros || 999

  const { count: assignatsActuals } = await supabase
    .from('assignacions')
    .select('id', { count: 'exact', head: true })
    .eq('full_carrega_id', params.id)
    .eq('incubadora_id', incubadora_id)

  const ocupats = assignatsActuals || 0
  if (ocupats + carro_ids.length > capacitat) {
    return NextResponse.json({
      error: `La incubadora només té ${capacitat - ocupats} lloc${capacitat - ocupats !== 1 ? 's' : ''} disponible${capacitat - ocupats !== 1 ? 's' : ''} (capacitat: ${capacitat}, ja assignats: ${ocupats})`
    }, { status: 400 })
  }

  if (isSinglestage) {
    if (!Array.isArray(posicions) || posicions.length !== carro_ids.length) {
      return NextResponse.json({
        error: 'Cal triar una posició per a cada carro a la graella de la Singlestage'
      }, { status: 400 })
    }
    for (const p of posicions) {
      if (!Number.isInteger(p) || p < 1 || p > capacitat) {
        return NextResponse.json({
          error: `Posició no vàlida: ${p}. Han d'estar entre 1 i ${capacitat}`
        }, { status: 400 })
      }
    }
    if (new Set(posicions).size !== posicions.length) {
      return NextResponse.json({
        error: 'No pots triar la mateixa posició dues vegades dins de la mateixa operació'
      }, { status: 400 })
    }

    // Unicitat NOMÉS dins del mateix full. Permetem planificar un full nou
    // sobre una incubadora que ara està plena amb un full anterior:
    // físicament les posicions estaran lliures el dia de la càrrega.
    const { data: dinsFull } = await supabase
      .from('assignacions')
      .select('posicio')
      .eq('full_carrega_id', params.id)
      .eq('incubadora_id', incubadora_id)
      .not('posicio', 'is', null)

    if (dinsFull && dinsFull.length > 0) {
      const posicionsOcupadesFull = new Set(dinsFull.map(a => a.posicio))
      const xocs = posicions.filter(p => posicionsOcupadesFull.has(p))
      if (xocs.length > 0) {
        return NextResponse.json({
          error: `Les posicions ${xocs.join(', ')} ja estan assignades en aquest mateix full. Refresca la pàgina i torna a triar.`
        }, { status: 409 })
      }
    }
  }

  let inserts: AssignacioInsert[]
  if (isSinglestage) {
    inserts = carro_ids.map((carro_id: number, idx: number) => ({
      full_carrega_id: parseInt(params.id),
      carro_id,
      incubadora_id,
      num_carro_full: posicions![idx],
      posicio: posicions![idx],
      zona: null,
      hora_entrada: hora_entrada || null,
      previsio_naixement: previsio_naixement || null,
    }))
  } else {
    const zonaSel: ZonaMS = (zona && ZONES_VALIDES.includes(zona)) ? zona : 'central'
    const { data: last } = await supabase
      .from('assignacions')
      .select('num_carro_full')
      .eq('full_carrega_id', params.id)
      .order('num_carro_full', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextNum = last ? last.num_carro_full + 1 : 1
    const nowIso = new Date().toISOString()

    inserts = carro_ids.map((carro_id: number, idx: number) => ({
      full_carrega_id: parseInt(params.id),
      carro_id,
      incubadora_id,
      num_carro_full: nextNum + idx,
      posicio: null,
      zona: zonaSel,
      zona_actualitzada_at: nowIso,
      hora_entrada: hora_entrada || null,
      previsio_naixement: previsio_naixement || null,
    }))
  }

  const { data, error } = await supabase
    .from('assignacions')
    .insert(inserts)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('carros_estoc')
    .update({ estat: 'Assignat' })
    .in('id', carro_ids)

  return NextResponse.json({ created: data?.length }, { status: 201 })
}

export async function DELETE(request: Request, { params: _params }: { params: { id: string } }) {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(CarregaAssignacionsDeleteBody, raw)
  if (!parsed.ok) return parsed.response
  const { assignacio_id, carro_id } = parsed.data

  const { error } = await supabase
    .from('assignacions')
    .delete()
    .eq('id', assignacio_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('carros_estoc')
    .update({ estat: 'Disponible' })
    .eq('id', carro_id)

  return NextResponse.json({ ok: true })
}
