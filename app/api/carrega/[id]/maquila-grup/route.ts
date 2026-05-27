import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'
import { parseBody, MaquilaGrupPatchBody } from '@/lib/schemas'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * PATCH /api/carrega/[id]/maquila-grup
 *
 * Marca totes les assignacions d'un (lot_id, incubadora_id) com a maquila o no.
 * Body: { lot_id: number, incubadora_id: number, es_maquila: boolean }
 */
export const PATCH = withAudit(async (request: Request, { params }: { params: { id: string } }) => {
  const fullId = parseInt(params.id, 10)
  if (!Number.isFinite(fullId)) {
    return NextResponse.json({ error: 'ID de full no vàlid' }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(MaquilaGrupPatchBody, raw)
  if (!parsed.ok) return parsed.response
  const { lot_id, incubadora_id, es_maquila } = parsed.data

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
})
