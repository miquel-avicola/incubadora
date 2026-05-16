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
  const body = await request.json()
  const { assignacio_vacuna_id, assignacio_ids } = body

  // Mode bulk: esborrar totes les vacunes assignades a un conjunt de carros
  if (Array.isArray(assignacio_ids)) {
    if (assignacio_ids.length === 0) {
      return NextResponse.json({ error: 'assignacio_ids buit' }, { status: 400 })
    }
    const { error, count } = await supabase
      .from('assignacio_vacunes')
      .delete({ count: 'exact' })
      .in('assignacio_id', assignacio_ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, eliminades: count ?? 0 })
  }

  // Mode individual (retrocompatible): esborrar una assignacio_vacuna concreta
  if (!assignacio_vacuna_id) {
    return NextResponse.json({ error: 'Falta assignacio_vacuna_id o assignacio_ids' }, { status: 400 })
  }
  const { error } = await supabase
    .from('assignacio_vacunes')
    .delete()
    .eq('id', assignacio_vacuna_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
