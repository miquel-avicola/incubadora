import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'
import { parseBody, PrevisioGrupPatchBody } from '@/lib/schemas'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * PATCH /api/carrega/[id]/previsio-grup
 *
 * Actualitza previsio_naixement de TOTES les assignacions del full amb el
 * mateix (lot_id, incubadora_id), en una sola crida. Si el valor es un nombre,
 * marca previsio_manual=true a tots. Si es null, les torna a auto
 * (previsio_manual=false).
 *
 * Body: { lot_id, incubadora_id, previsio_naixement: 0..1 | null }
 * Resposta: { actualitzats: N }
 */
export const PATCH = withAudit(async (request: Request, { params }: { params: { id: string } }) => {
  const fullId = parseInt(params.id, 10)
  if (!Number.isFinite(fullId)) {
    return NextResponse.json({ error: 'Full no vàlid' }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(PrevisioGrupPatchBody, raw)
  if (!parsed.ok) return parsed.response
  const { lot_id, incubadora_id, previsio_naixement } = parsed.data

  // Trobar les assignacions del full + incubadora amb carros del lot indicat.
  // Cal el filtre carros_estoc.lot_id (join inner perque s'apliqui).
  const { data: candidates, error: errSel } = await supabase
    .from('assignacions')
    .select('id, carros_estoc!inner(lot_id)')
    .eq('full_carrega_id', fullId)
    .eq('incubadora_id', incubadora_id)
    .eq('carros_estoc.lot_id', lot_id)

  if (errSel) {
    return NextResponse.json({ error: errSel.message }, { status: 500 })
  }

  const ids = ((candidates as unknown) as { id: number }[] | null || []).map(c => c.id)
  if (ids.length === 0) {
    return NextResponse.json(
      { actualitzats: 0, motiu: 'Cap assignacio coincideix amb (full, lot, incubadora)' },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { error: errUpd } = await supabase
    .from('assignacions')
    .update({
      previsio_naixement,
      previsio_manual: previsio_naixement !== null,
    })
    .in('id', ids)

  if (errUpd) {
    return NextResponse.json({ error: errUpd.message }, { status: 500 })
  }

  return NextResponse.json(
    { actualitzats: ids.length },
    { headers: { 'Cache-Control': 'no-store' } }
  )
})
