import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, ExpedicioLotsPostBody, ExpedicioLotsDeleteBody } from '@/lib/schemas'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(ExpedicioLotsPostBody, raw)
  if (!parsed.ok) return parsed.response
  const { lot_id, pollets } = parsed.data

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
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(ExpedicioLotsDeleteBody, raw)
  if (!parsed.ok) return parsed.response
  const { expedicio_lot_id } = parsed.data

  const { error } = await supabase
    .from('expedicio_lots')
    .delete()
    .eq('id', expedicio_lot_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
