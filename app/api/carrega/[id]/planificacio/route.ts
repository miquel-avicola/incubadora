import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// La planificació canvia l'estat dels carros i de les assignacions. Cal que les
// rutes que llegeixen aquesta info després d'una crida no rebin cache de Next.js.
export const dynamic = 'force-dynamic'
export const revalidate = 0

type ZonaMS = 'central' | 'paret' | 'pulsator'

interface ItemPlanificacio {
  carro_id: number
  incubadora_id: number
  posicio: number
  zona: ZonaMS | null
}

interface BodyPlanificacio {
  dia: 'dijous' | 'dilluns'
  msp_ordre?: number[] | null
  items: ItemPlanificacio[]
}

/**
 * PUT /api/carrega/[id]/planificacio
 *
 * Substitueix de manera declarativa la planificació sencera del full. Rep totes
 * les assignacions com a lot i crida la funció PL/pgSQL `guarda_planificacio_full`,
 * que ho fa tot en una sola transacció (validació, càlcul de num_carro_full per
 * offset+posicio, esborrat d'orfes verges, INSERT/UPDATE, marcatge d'estat).
 *
 * Casos d'error rellevants:
 *  - ORFES_BLOQUEJADES: alguna assignació orfe té transferència o vacuna → 409
 *    amb llista detallada per pintar a l'UI.
 *  - Altres validacions internes (duplicats al lot, posicions fora de rang…) → 400.
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let body: BodyPlanificacio
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  }

  const { dia, msp_ordre, items } = body

  if (dia !== 'dijous' && dia !== 'dilluns') {
    return NextResponse.json(
      { error: "Camp 'dia' ha de ser 'dijous' o 'dilluns'" },
      { status: 400 }
    )
  }
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Camp 'items' és obligatori i ha de ser un array" }, { status: 400 })
  }

  const fullId = parseInt(params.id, 10)
  if (!Number.isFinite(fullId)) {
    return NextResponse.json({ error: 'Full no vàlid' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('guarda_planificacio_full', {
    p_full_id: fullId,
    p_dia: dia,
    p_msp_ordre: msp_ordre && msp_ordre.length ? msp_ordre : null,
    p_items: items,
  })

  if (error) {
    // Detectar el cas d'orfes amb vincles i tornar 409 amb la llista per a l'UI
    const msg = error.message || ''
    if (msg.startsWith('ORFES_BLOQUEJADES:')) {
      try {
        const jsonStr = msg.substring('ORFES_BLOQUEJADES:'.length).trim()
        const orfes = JSON.parse(jsonStr)
        return NextResponse.json(
          {
            error: 'Hi ha carros del full que no apareixen al lot nou però ja tenen transferència o vacunes vinculades. No es poden esborrar.',
            orfes_bloquejades: orfes,
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        )
      } catch {
        // Si el parse falla, retornem el missatge cru
        return NextResponse.json({ error: msg }, { status: 409 })
      }
    }
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
