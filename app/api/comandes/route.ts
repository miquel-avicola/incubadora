// app/api/comandes/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pendents = searchParams.get('pendents') === 'true'
  const data = searchParams.get('data') // data de naixement de referència

  let query = supabase
    .from('comandes')
    .select('id, tipus, quantitat_pollets, quantitat_ous_maquila, sexat, data_prevista_naixement, clients(id, nom)')
    .order('data_prevista_naixement', { ascending: true })

  if (pendents) {
    query = query.is('full_carrega_id', null)
  }

  if (data) {
    // Filtra comandes dins de ±14 dies de la data de referència
    const ref = new Date(data)
    const from = new Date(ref); from.setDate(ref.getDate() - 14)
    const to = new Date(ref); to.setDate(ref.getDate() + 14)
    query = query
      .gte('data_prevista_naixement', from.toISOString().split('T')[0])
      .lte('data_prevista_naixement', to.toISOString().split('T')[0])
  }

  const { data: comandes, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(comandes)
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    full_carrega_id,
    client_id,
    tipus,
    quantitat_pollets,
    quantitat_ous_maquila,
    sexat,
    data_prevista_naixement,
  } = body

  if (!client_id || !tipus) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('comandes')
    .insert({
      full_carrega_id: full_carrega_id ?? null,
      client_id,
      tipus,
      quantitat_pollets: quantitat_pollets ?? null,
      quantitat_ous_maquila: quantitat_ous_maquila ?? null,
      sexat: sexat ?? false,
      data_prevista_naixement: data_prevista_naixement ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}