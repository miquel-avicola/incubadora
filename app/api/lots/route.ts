import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, LotPostBody } from '@/lib/schemas'
import { withAudit } from '@/lib/audit'

export async function GET() {
  const { data, error } = await supabase
    .from('lots_reproductores')
    .select(`
      id,
      data_naixement,
      estirp,
      granges_reproductores (
        id,
        granja,
        nom_informal
      )
    `)
    .order('data_naixement', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const POST = withAudit(async (request: Request) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(LotPostBody, raw)
  if (!parsed.ok) return parsed.response
  const { granja_reproductora_id, data_naixement, estirp } = parsed.data

  const { data, error } = await supabase
    .from('lots_reproductores')
    .insert({ granja_reproductora_id, data_naixement, estirp: estirp || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
})
