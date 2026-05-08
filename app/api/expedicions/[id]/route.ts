import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const {
    pollets_comanda,
    pollets_servits,
    transportista_id,
    matricula,
    hora_prevista_naixement,
    hora_sortida_camio,
    hora_arribada_camio,
    ordre,
    observacions,
    num_viatge,
  } = body

  const updates: Record<string, unknown> = {}
  if (pollets_comanda !== undefined) updates.pollets_comanda = pollets_comanda
  if (pollets_servits !== undefined) updates.pollets_servits = pollets_servits
  if (transportista_id !== undefined) updates.transportista_id = transportista_id
  if (matricula !== undefined) updates.matricula = matricula
  if (hora_prevista_naixement !== undefined) updates.hora_prevista_naixement = hora_prevista_naixement
  if (hora_sortida_camio !== undefined) updates.hora_sortida_camio = hora_sortida_camio
  if (hora_arribada_camio !== undefined) updates.hora_arribada_camio = hora_arribada_camio
  if (ordre !== undefined) updates.ordre = ordre
  if (observacions !== undefined) updates.observacions = observacions
  if (num_viatge !== undefined) updates.num_viatge = num_viatge

  const { data, error } = await supabase
    .from('expedicions')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error } = await supabase
    .from('expedicions')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
