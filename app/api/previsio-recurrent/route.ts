import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'

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
  const body = await request.json()
  const { client_id, dia_setmana, tipus, quantitat, observacions } = body || {}
  if (!client_id || dia_setmana == null || !tipus || !quantitat) {
    return NextResponse.json({ error: 'Falten paràmetres' }, { status: 400 })
  }
  if (tipus !== 'Pollets' && tipus !== 'Maquila') {
    return NextResponse.json({ error: 'Tipus invàlid' }, { status: 400 })
  }
  if (dia_setmana < 0 || dia_setmana > 6) {
    return NextResponse.json({ error: 'Dia setmana invàlid' }, { status: 400 })
  }
  const q = parseInt(quantitat)
  if (!q || q <= 0) {
    return NextResponse.json({ error: 'Quantitat invàlida' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('previsio_recurrent')
    .insert({ client_id, dia_setmana, tipus, quantitat: q, observacions: observacions || null })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
})
