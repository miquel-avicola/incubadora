import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const client_id = searchParams.get('client_id')

  let query = supabase
    .from('destinacions')
    .select('id, nom_granja, nau, poblacio, client_id')
    .order('nom_granja')

  if (client_id) {
    query = query.or(`client_id.eq.${client_id},client_id.is.null`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
