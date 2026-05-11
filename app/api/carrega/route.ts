import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
  const body = await request.json()
  const { carrega, transferencia } = body

  if (!carrega) {
    return NextResponse.json({ error: 'La data de càrrega és obligatòria' }, { status: 400 })
  }

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
