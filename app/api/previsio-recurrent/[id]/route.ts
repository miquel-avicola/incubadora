import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'
import { parseBody, PrevisioRecurrentPatchBody } from '@/lib/schemas'

// PATCH /api/previsio-recurrent/[id] → editar regla
export const PATCH = withAudit(async (request: Request, { params }: { params: { id: string } }) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(PrevisioRecurrentPatchBody, raw)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const updates: Record<string, unknown> = {}
  if (body.quantitat != null) updates.quantitat = body.quantitat
  if (body.dia_setmana != null) updates.dia_setmana = body.dia_setmana
  if (body.tipus != null) updates.tipus = body.tipus
  if (body.actiu != null) updates.actiu = body.actiu
  if (body.observacions !== undefined) updates.observacions = body.observacions
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Cap canvi' }, { status: 400 })

  const { error } = await supabase
    .from('previsio_recurrent')
    .update(updates)
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})

// DELETE /api/previsio-recurrent/[id]
export const DELETE = withAudit(async (_request: Request, { params }: { params: { id: string } }) => {
  const { error } = await supabase
    .from('previsio_recurrent')
    .delete()
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
