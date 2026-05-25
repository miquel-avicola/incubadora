import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface BodyPatch {
  lot_id: number
  incubadora_id: number
  previsio_naixement: number | null
}

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
    return NextResponse.json({ error: 'Full no valid' }, { status: 400 })
  }

  let body: BodyPatch
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
  }

  const { lot_id, incubadora_id, previsio_naixement } = body
  if (!Number.isFinite(lot_id) || !Number.isFinite(incubadora_id)) {
    return NextResponse.json({ error: 'Falten lot_id o incubadora_id' }, { status: 400 })
  }
  if (previsio_naixement !== null) {
    if (
      typeof previsio_naixement !== 'number' ||
      !Number.isFinite(previsio_naixement) ||
      previsio_naixement < 0 ||
      previsio_naixement > 1
    ) {
      return NextResponse.json(
        { error: 'previsio_naixement ha de ser un nombre entre 0 i 1, o null' },
        { status: 400 }
      )
    }
  }

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
