import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()
  const { assignacio_id, vacuna_id, dosi } = body
  if (!assignacio_id || !vacuna_id || !dosi) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('assignacio_vacunes')
    .insert({ assignacio_id, vacuna_id, dosi })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const { assignacio_vacuna_id } = await request.json()
  if (!assignacio_vacuna_id) {
    return NextResponse.json({ error: 'Falta assignacio_vacuna_id' }, { status: 400 })
  }
  const { error } = await supabase
    .from('assignacio_vacunes')
    .delete()
    .eq('id', assignacio_vacuna_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
