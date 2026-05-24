// app/api/comandes/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, ComandaPatchBody } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID invàlid' }, { status: 400 })

  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(ComandaPatchBody, raw)
  if (!parsed.ok) return parsed.response
  const { full_carrega_id, data_prevista_naixement, quantitat_pollets, quantitat_ous_maquila, sexat } = parsed.data

  const updates: Record<string, unknown> = {}
  if (full_carrega_id !== undefined) updates.full_carrega_id = full_carrega_id
  if (data_prevista_naixement !== undefined) updates.data_prevista_naixement = data_prevista_naixement
  if (quantitat_pollets !== undefined) updates.quantitat_pollets = quantitat_pollets
  if (quantitat_ous_maquila !== undefined) updates.quantitat_ous_maquila = quantitat_ous_maquila
  if (sexat !== undefined) updates.sexat = sexat

  const { data, error } = await supabase
    .from('comandes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'ID invàlid' }, { status: 400 })
  const { error } = await supabase
    .from('comandes')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}