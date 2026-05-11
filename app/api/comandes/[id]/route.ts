// app/api/comandes/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { full_carrega_id, data_prevista_naixement, quantitat_pollets, quantitat_ous_maquila, sexat } = body

  const updates: Record<string, unknown> = {}
  if (full_carrega_id !== undefined) updates.full_carrega_id = full_carrega_id
  if (data_prevista_naixement !== undefined) updates.data_prevista_naixement = data_prevista_naixement
  if (quantitat_pollets !== undefined) updates.quantitat_pollets = quantitat_pollets
  if (quantitat_ous_maquila !== undefined) updates.quantitat_ous_maquila = quantitat_ous_maquila
  if (sexat !== undefined) updates.sexat = sexat

  const { data, error } = await supabase
    .from('comandes')
    .update(updates)
    .eq('id', parseInt(params.id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('comandes')
    .delete()
    .eq('id', parseInt(params.id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}