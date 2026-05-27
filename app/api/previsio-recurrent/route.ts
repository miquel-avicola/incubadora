import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'
import { parseBody, PrevisioRecurrentPostBody } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

// GET /api/previsio-recurrent → llista totes les regles
export async function GET() {
  const { data, error } = await supabase
    .from('previsio_recurrent')
    .select('id, client_id, dia_setmana, tipus, quantitat, actiu, observacions, clients ( nom )')
    .order('dia_setmana')
    .order('tipus')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/previsio-recurrent → crear nova regla
// Body: { client_id, dia_setmana, tipus, quantitat, observacions? }
export const POST = withAudit(async (request: Request) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(PrevisioRecurrentPostBody, raw)
  if (!parsed.ok) return parsed.response
  const { client_id, dia_setmana, tipus, quantitat, observacions } = parsed.data

  const { data, error } = await supabase
    .from('previsio_recurrent')
    .insert({ client_id, dia_setmana, tipus, quantitat, observacions: observacions ?? null })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
})
