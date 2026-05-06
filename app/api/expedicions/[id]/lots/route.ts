import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { lot_id, pollets } = body

  if (!lot_id || pollets === undefined) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expedicio_lots')
    .insert({
      expedicio_id: parseInt(params.id),
      lot_id,
      pollets,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const { expedicio_lot_id } = await request.json()

  const { error } = await supabase
    .from('expedicio_lots')
    .delete()
    .eq('id', expedicio_lot_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
