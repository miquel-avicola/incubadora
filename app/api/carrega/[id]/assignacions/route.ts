import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
  const body = await request.json()
  const {
    carro_ids,
    incubadora_id,
    hora_entrada,
    previsio_naixement,
    posicions,
    zona,
  } = body as {
    carro_ids?: number[]
    incubadora_id?: number
    hora_entrada?: string | null
    previsio_naixement?: number | null
    posicions?: number[]
    zona?: ZonaMS
  }

  if (!carro_ids?.length || !incubadora_id) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

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

    const { data: actives } = await supabase
      .from('assignacions')
      .select('id, posicio')
      .eq('incubadora_id', incubadora_id)
      .not('posicio', 'is', null)

    if (actives && actives.length > 0) {
      const idsActives = actives.map(a => a.id)
      const { data: transferides } = await supabase
        .from('transferencies')
        .select('assignacio_id')
        .in('assignacio_id', idsActives)
      const idsTransf = new Set((transferides || []).map(t => t.assignacio_id))
      const posicionsOcupades = new Set(
        actives.filter(a => !idsTransf.has(a.id)).map(a => a.posicio)
      )
      const xocs = posicions.filter(p => posicionsOcupades.has(p))
      if (xocs.length > 0) {
        return NextResponse.json({
          error: `Les posicions ${xocs.join(', ')} ja estan ocupades per altres carros actius. Refresca la pàgina i torna a triar.`
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
  const { assignacio_id, carro_id } = await request.json()

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
