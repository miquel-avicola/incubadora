import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { vacuna_id } = await request.json()
  if (!vacuna_id) return NextResponse.json({ error: 'Falta vacuna_id' }, { status: 400 })

  const { data, error } = await supabase
    .from('expedicio_vacunes')
    .insert({ expedicio_id: parseInt(params.id), vacuna_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { vacuna_id } = await request.json()
  if (!vacuna_id) return NextResponse.json({ error: 'Falta vacuna_id' }, { status: 400 })

  const { error } = await supabase
    .from('expedicio_vacunes')
    .delete()
    .eq('expedicio_id', parseInt(params.id))
    .eq('vacuna_id', vacuna_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
