import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ============================================================
// /api/previsio-post-transferencia
// ------------------------------------------------------------
// Donada una transferència ja registrada (amb ous_fertils_vacunats coneguts),
// calcula la previsió actualitzada de pollets a néixer:
//
//   pollets_previstos = ous_fertils_vacunats × eclosio_esperada
//   pct_naixement_previst = pollets_previstos / quantitat_ous
//
// L'eclosio_esperada es deriva de la cascada definida a /api/eclosio-referencia,
// que combina dades de Supabase post-tall i Excel històric, amb fallbacks.
//
// Paràmetres rebuts via query string:
//   - transferencia_id (obligatori): ID de la transferència ja creada
// ============================================================

interface PrevisioResult {
  transferencia_id: number
  ous_fertils_vacunats: number
  ous_explosius: number
  quantitat_ous: number
  estirp: string
  posta: string
  setmanes_vida: number
  tipus_incubadora: string
  eclosio_esperada: number
  pollets_previstos: number
  pct_naixement_previst: number
  font: string
  n_registres: number
  detalls?: Record<string, unknown>
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const transferencia_id_str = searchParams.get('transferencia_id')

  if (!transferencia_id_str) {
    return NextResponse.json(
      { error: "Falta el paràmetre obligatori: transferencia_id" },
      { status: 400 }
    )
  }
  const transferencia_id = parseInt(transferencia_id_str, 10)
  if (isNaN(transferencia_id)) {
    return NextResponse.json(
      { error: `transferencia_id no és un enter: ${transferencia_id_str}` },
      { status: 400 }
    )
  }

  try {
    // 1. Carregar la transferència i totes les dades dependents en una sola lectura
    const { data: t, error: errT } = await supabase
      .from('transferencies')
      .select(`
        id,
        ous_fertils_vacunats,
        ous_explosius,
        carro_id,
        assignacio_id,
        carros_estoc:carro_id ( quantitat_ous, posta, lot_id ),
        assignacions:assignacio_id ( incubadora_id, incubadores:incubadora_id ( tipus ) )
      `)
      .eq('id', transferencia_id)
      .single()

    if (errT || !t) {
      return NextResponse.json(
        { error: `Transferència no trobada (id ${transferencia_id}): ${errT?.message ?? ''}` },
        { status: 404 }
      )
    }

    const carro = (t.carros_estoc as any)
    const assignacio = (t.assignacions as any)
    const incubadora = assignacio?.incubadores

    if (!carro || !assignacio || !incubadora) {
      return NextResponse.json(
        { error: 'Transferència sense carro/assignació/incubadora associats' },
        { status: 500 }
      )
    }

    const tipus_incubadora = incubadora.tipus as string
    const posta = carro.posta as string
    const quantitat_ous = Number(carro.quantitat_ous)
    const lot_id = carro.lot_id

    // 2. Obtenir l'estirp i data de naixement del lot
    const { data: lot, error: errLot } = await supabase
      .from('lots_reproductores')
      .select('estirp, data_naixement')
      .eq('id', lot_id)
      .single()

    if (errLot || !lot || !lot.estirp || !lot.data_naixement) {
      return NextResponse.json(
        { error: `Lot ${lot_id} sense estirp o data de naixement` },
        { status: 422 }
      )
    }

    // 3. Calcular setmanes de vida (FLOOR, coherent amb /api/previsio i /api/eclosio-referencia)
    const dataNaix = new Date(lot.data_naixement)
    const dataPosta = new Date(posta)
    const setmanes = Math.floor(
      (dataPosta.getTime() - dataNaix.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )

    // 4. Cridar internament /api/eclosio-referencia (mateix host)
    //    Reutilitza tota la lògica de cascada sense duplicar codi.
    const url = new URL(request.url)
    const eclosioUrl = `${url.origin}/api/eclosio-referencia?estirp=${encodeURIComponent(lot.estirp)}&setmanes=${setmanes}&tipus=${encodeURIComponent(tipus_incubadora)}`
    const eclosioResp = await fetch(eclosioUrl, { cache: 'no-store' })
    if (!eclosioResp.ok) {
      const err = await eclosioResp.json().catch(() => ({}))
      return NextResponse.json(
        { error: `Error consultant eclosió de referència: ${err?.error ?? eclosioResp.statusText}` },
        { status: 500 }
      )
    }
    const eclosioData = await eclosioResp.json()

    // 5. Calcular previsió final
    const ous_fertils = Number(t.ous_fertils_vacunats)
    const eclosio = Number(eclosioData.eclosio)
    const pollets_previstos = Math.round(ous_fertils * eclosio)
    const pct_naixement_previst = pollets_previstos / quantitat_ous

    const result: PrevisioResult = {
      transferencia_id,
      ous_fertils_vacunats: ous_fertils,
      ous_explosius: Number(t.ous_explosius),
      quantitat_ous,
      estirp: lot.estirp,
      posta,
      setmanes_vida: setmanes,
      tipus_incubadora,
      eclosio_esperada: eclosio,
      pollets_previstos,
      pct_naixement_previst: Math.round(pct_naixement_previst * 10000) / 10000,
      font: eclosioData.font,
      n_registres: eclosioData.n_registres,
      detalls: eclosioData.detalls,
    }

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error intern' }, { status: 500 })
  }
}
