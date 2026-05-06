import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { carro_ids, incubadora_id, hora_entrada, previsio_naixement, num_carro_inicial } = body

  if (!carro_ids?.length || !incubadora_id) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  // Comprovar capacitat de la incubadora
  const { data: incubadora } = await supabase
    .from('incubadores')
    .select('capacitat_carros, tipus')
    .eq('id', incubadora_id)
    .single()

  const { count: assignatsActuals } = await supabase
    .from('assignacions')
    .select('id', { count: 'exact' })
    .eq('full_carrega_id', params.id)
    .eq('incubadora_id', incubadora_id)

  const ocupats = assignatsActuals || 0
  const capacitat = incubadora?.capacitat_carros || 999

  if (ocupats + carro_ids.length > capacitat) {
    return NextResponse.json({
      error: `La incubadora només té ${capacitat - ocupats} lloc${capacitat - ocupats !== 1 ? 's' : ''} disponible${capacitat - ocupats !== 1 ? 's' : ''} (capacitat: ${capacitat}, ja assignats: ${ocupats})`
    }, { status: 400 })
  }

  // Obtenir el següent número seqüencial dins el full
  const { data: last } = await supabase
    .from('assignacions')
    .select('num_carro_full')
    .eq('full_carrega_id', params.id)
    .order('num_carro_full', { ascending: false })
    .limit(1)
    .single()

  const nextNum = last ? last.num_carro_full + 1 : 1
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const inserts = carro_ids.map((carro_id: number, idx: number) => ({
    full_carrega_id: parseInt(params.id),
    carro_id,
    incubadora_id,
    num_carro_full: num_carro_inicial ? num_carro_inicial + idx : nextNum + idx,
    hora_entrada: hora_entrada || null,
    previsio_naixement: previsio_naixement || null,
  }))

  const { data, error } = await supabase
    .from('assignacions')
    .insert(inserts)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Actualitzar estat dels carros a Assignat
  await supabase
    .from('carros_estoc')
    .update({ estat: 'Assignat', entrada_incubadora: dateStr })
    .in('id', carro_ids)

  return NextResponse.json({ created: data?.length }, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { assignacio_id, carro_id } = await request.json()

  const { error } = await supabase
    .from('assignacions')
    .delete()
    .eq('id', assignacio_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('carros_estoc')
    .update({ estat: 'Disponible', entrada_incubadora: null })
    .eq('id', carro_id)

  return NextResponse.json({ ok: true })
}
