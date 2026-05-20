import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * POST /api/instalacions/rotar-zones/[inc_id]
 *
 * Dispara manualment la rotacio de zones d'una MS gran (paret -> pulsator,
 * central -> paret, central queda buit). La RPC valida internament:
 *  - Incubadora ha de ser Multistage amb capacitat 24.
 *  - Pulsator d'aquesta Inc ha d'estar buit (cap carro Assignat).
 * Si alguna condicio falla, retorna 400 amb el motiu.
 */
export async function POST(_request: Request, { params }: { params: { inc_id: string } }) {
  const incId = parseInt(params.inc_id, 10)
  if (!Number.isFinite(incId)) {
    return NextResponse.json({ error: 'inc_id no valid' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('rotar_zones_ms_gran', { p_incubadora_id: incId })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const resultat = data as { ok: boolean; motiu?: string; [key: string]: unknown } | null

  if (!resultat || resultat.ok === false) {
    return NextResponse.json(
      resultat ?? { ok: false, motiu: 'sense_resposta' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.json(resultat, { headers: { 'Cache-Control': 'no-store' } })
}
