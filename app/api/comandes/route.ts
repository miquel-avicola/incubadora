// app/api/comandes/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, ComandaGetQuery, ComandaPostBody } from '@/lib/schemas'
import { withAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const qp = parseBody(
    ComandaGetQuery,
    Object.fromEntries(new URL(request.url).searchParams)
  )
  if (!qp.ok) return qp.response
  const { pendents: pendentsStr, data } = qp.data
  const pendents = pendentsStr === 'true'

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

export const POST = withAudit(async (request: Request) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(ComandaPostBody, raw)
  if (!parsed.ok) return parsed.response
  const {
    full_carrega_id,
    client_id,
    tipus,
    quantitat_pollets,
    quantitat_ous_maquila,
    sexat,
    data_prevista_naixement,
  } = parsed.data

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
})