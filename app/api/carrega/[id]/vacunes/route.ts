import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, CarregaVacunesPostBody, CarregaVacunesDeleteBody } from '@/lib/schemas'
import { withAudit } from '@/lib/audit'

export const POST = withAudit(async (request: Request) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(CarregaVacunesPostBody, raw)
  if (!parsed.ok) return parsed.response
  const { assignacio_id, vacuna_id, dosi } = parsed.data

  const { data, error } = await supabase
    .from('assignacio_vacunes')
    .insert({ assignacio_id, vacuna_id, dosi })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
})

export const DELETE = withAudit(async (request: Request) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(CarregaVacunesDeleteBody, raw)
  if (!parsed.ok) return parsed.response
  const { assignacio_ids, assignacio_vacuna_id } = parsed.data

  // Mode bulk: esborrar totes les vacunes assignades a un conjunt de carros
  if (Array.isArray(assignacio_ids)) {
    const { error, count } = await supabase
      .from('assignacio_vacunes')
      .delete({ count: 'exact' })
      .in('assignacio_id', assignacio_ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, eliminades: count ?? 0 })
  }

  // Mode individual (retrocompatible): esborrar una assignacio_vacuna concreta
  const { error } = await supabase
    .from('assignacio_vacunes')
    .delete()
    .eq('id', assignacio_vacuna_id!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
