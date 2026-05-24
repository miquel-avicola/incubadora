import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, CarregaPostBody } from '@/lib/schemas'

export async function GET() {
  const { data, error } = await supabase
    .from('fulls_carrega')
    .select(`
      id,
      num_carrega,
      carrega,
      transferencia,
      estat,
      comandes (
        id,
        tipus,
        quantitat_pollets,
        quantitat_ous_maquila,
        clients (nom)
      )
    `)
    .order('carrega', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(CarregaPostBody, raw)
  if (!parsed.ok) return parsed.response
  const { carrega, transferencia } = parsed.data

  // Obtenir l'últim num_carrega
  const { data: last } = await supabase
    .from('fulls_carrega')
    .select('num_carrega')
    .order('num_carrega', { ascending: false })
    .limit(1)
    .single()

  const num_carrega = last ? last.num_carrega + 1 : 1

  const { data, error } = await supabase
    .from('fulls_carrega')
    .insert({ num_carrega, carrega, transferencia, estat: 'Planificat' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
