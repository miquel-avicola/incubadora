import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const client_id = searchParams.get('client_id')

  let query = supabase
    .from('destinacions')
    .select('id, nom_granja, nau, poblacio, codi_rega, client_id')
    .order('nom_granja')

  if (client_id) {
    query = query.or(`client_id.eq.${client_id},client_id.is.null`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { nom_granja, nau, poblacio, codi_rega, client_id } = body

  if (!nom_granja) {
    return NextResponse.json({ error: 'nom_granja és obligatori' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('destinacions')
    .insert({
      nom_granja,
      nau: nau || null,
      poblacio: poblacio || null,
      codi_rega: codi_rega || null,
      client_id: client_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
