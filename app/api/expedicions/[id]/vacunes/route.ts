import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, ExpedicioVacunaBody } from '@/lib/schemas'
import { withAudit } from '@/lib/audit'

export const POST = withAudit(async (request: Request, { params }: { params: { id: string } }) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(ExpedicioVacunaBody, raw)
  if (!parsed.ok) return parsed.response
  const { vacuna_id } = parsed.data

  const { data, error } = await supabase
    .from('expedicio_vacunes')
    .insert({ expedicio_id: parseInt(params.id), vacuna_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
})

export const DELETE = withAudit(async (request: Request, { params }: { params: { id: string } }) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(ExpedicioVacunaBody, raw)
  if (!parsed.ok) return parsed.response
  const { vacuna_id } = parsed.data

  const { error } = await supabase
    .from('expedicio_vacunes')
    .delete()
    .eq('expedicio_id', parseInt(params.id))
    .eq('vacuna_id', vacuna_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
