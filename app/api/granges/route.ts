import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('granges_reproductores')
    .select('id, granja, nom_informal, marca_oficial')
    .order('granja')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { granja, nom_informal, marca_oficial, codi_rega, poblacio, titular } = body

  if (!granja) {
    return NextResponse.json({ error: 'El nom de la granja és obligatori' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('granges_reproductores')
    .insert({ granja, nom_informal, marca_oficial, codi_rega, poblacio, titular })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
