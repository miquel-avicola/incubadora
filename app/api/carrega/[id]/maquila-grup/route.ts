import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * PATCH /api/carrega/[id]/maquila-grup
 *
 * Marca totes les assignacions d'un (lot_id, incubadora_id) com a maquila o no.
 * Body: { lot_id: number, incubadora_id: number, es_maquila: boolean }
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const fullId = parseInt(params.id, 10)
  if (!Number.isFinite(fullId)) {
    return NextResponse.json({ error: 'ID de full no vàlid' }, { status: 400 })
  }

  let body: { lot_id?: number; incubadora_id?: number; es_maquila?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  }

  const { lot_id, incubadora_id, es_maquila } = body
  if (lot_id === undefined || incubadora_id === undefined || es_maquila === undefined) {
    return NextResponse.json(
      { error: 'Cal lot_id, incubadora_id i es_maquila' },
      { status: 400 }
    )
  }
  if (typeof es_maquila !== 'boolean') {
    return NextResponse.json({ error: 'es_maquila ha de ser true o false' }, { status: 400 })
  }

  // Pas 1: trobar els carros_estoc del lot
  const { data: carros, error: errCarros } = await supabase
    .from('carros_estoc')
    .select('id')
    .eq('lot_id', lot_id)

  if (errCarros) {
    return NextResponse.json({ error: errCarros.message }, { status: 500 })
  }

  const carroIds = (carros || []).map((c: { id: number }) => c.id)
  if (carroIds.length === 0) {
    return NextResponse.json({ ok: true, actualitzats: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Pas 2: actualitzar les assignacions del full + incubadora que pertanyen a aquests carros
  const { error: errUpd, count } = await supabase
    .from('assignacions')
    .update({ es_maquila })
    .eq('full_carrega_id', fullId)
    .eq('incubadora_id', incubadora_id)
    .in('carro_id', carroIds)

  if (errUpd) {
    return NextResponse.json({ error: errUpd.message }, { status: 500 })
  }

  return NextResponse.json(
    { ok: true, actualitzats: count ?? 0 },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
