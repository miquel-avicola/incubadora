import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'

// PATCH /api/previsio-recurrent/[id] → editar regla
export const PATCH = withAudit(async (request: Request, { params }: { params: { id: string } }) => {
  const body = await request.json()
  const updates: any = {}
  if (body.quantitat != null) {
    const q = parseInt(body.quantitat)
    if (!q || q <= 0) return NextResponse.json({ error: 'Quantitat invàlida' }, { status: 400 })
    updates.quantitat = q
  }
  if (body.dia_setmana != null) {
    if (body.dia_setmana < 0 || body.dia_setmana > 6) return NextResponse.json({ error: 'Dia invàlid' }, { status: 400 })
    updates.dia_setmana = body.dia_setmana
  }
  if (body.tipus != null) {
    if (body.tipus !== 'Pollets' && body.tipus !== 'Maquila') return NextResponse.json({ error: 'Tipus invàlid' }, { status: 400 })
    updates.tipus = body.tipus
  }
  if (body.actiu != null) updates.actiu = !!body.actiu
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
