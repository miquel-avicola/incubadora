import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()
  const { full_carrega_id, client_id, tipus, quantitat_pollets, quantitat_ous_maquila, sexat, observacions } = body

  if (!full_carrega_id || !client_id || !tipus) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('comandes')
    .insert({
      full_carrega_id,
      client_id,
      tipus,
      quantitat_pollets: quantitat_pollets || null,
      quantitat_ous_maquila: quantitat_ous_maquila || null,
      sexat: sexat || false,
      observacions: observacions || null,
    })
    .select(`*, clients(nom)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const { comanda_id } = await request.json()

  const { error } = await supabase
    .from('comandes')
    .delete()
    .eq('id', comanda_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
