import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { obtenirEclosio } from '@/lib/eclosio'

export const dynamic = 'force-dynamic'

// ============================================================
// GET /api/previsio-post-transferencia?transferencia_id=X
// Donada una transferència ja registrada, calcula:
//   pollets_previstos = ous_fertils_vacunats × eclosio_esperada
//   pct_naixement_previst = pollets_previstos / quantitat_ous
// ============================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const transferencia_id_str = searchParams.get('transferencia_id')

  if (!transferencia_id_str) {
    return NextResponse.json(
      { error: 'Falta el paràmetre obligatori: transferencia_id' },
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
    // 1) Llegir transferència (camps escalars)
    const { data: t, error: errT } = await supabase
      .from('transferencies')
      .select('id, ous_fertils_vacunats, ous_explosius, carro_id, assignacio_id')
      .eq('id', transferencia_id)
      .single()

    if (errT || !t) {
      return NextResponse.json(
        { error: `Transferència no trobada (id ${transferencia_id}): ${errT?.message ?? ''}` },
        { status: 404 }
      )
    }

    // 2) Llegir carro (per ous totals, posta, lot_id)
    const { data: carro, error: errCarro } = await supabase
      .from('carros_estoc')
      .select('quantitat_ous, posta, lot_id')
      .eq('id', t.carro_id)
      .single()
    if (errCarro || !carro) {
      return NextResponse.json(
        { error: `Carro ${t.carro_id} no trobat: ${errCarro?.message ?? ''}` },
        { status: 404 }
      )
    }

    // 3) Llegir assignació (per saber a quina incubadora ha anat)
    const { data: assignacio, error: errA } = await supabase
      .from('assignacions')
      .select('incubadora_id')
      .eq('id', t.assignacio_id)
      .single()
    if (errA || !assignacio) {
      return NextResponse.json(
        { error: `Assignació ${t.assignacio_id} no trobada: ${errA?.message ?? ''}` },
        { status: 404 }
      )
    }

    // 4) Llegir incubadora (per saber el tipus)
    const { data: incubadora, error: errI } = await supabase
      .from('incubadores')
      .select('tipus')
      .eq('id', assignacio.incubadora_id)
      .single()
    if (errI || !incubadora) {
      return NextResponse.json(
        { error: `Incubadora ${assignacio.incubadora_id} no trobada: ${errI?.message ?? ''}` },
        { status: 404 }
      )
    }

    // 5) Llegir lot (estirp + data naixement del lot)
    const { data: lot, error: errLot } = await supabase
      .from('lots_reproductores')
      .select('estirp, data_naixement')
      .eq('id', carro.lot_id)
      .single()
    if (errLot || !lot || !lot.estirp || !lot.data_naixement) {
      return NextResponse.json(
        { error: `Lot ${carro.lot_id} sense estirp o data de naixement` },
        { status: 422 }
      )
    }

    // 6) Calcular setmanes de vida (FLOOR, coherent amb /api/previsio)
    const dataNaix = new Date(lot.data_naixement)
    const dataPosta = new Date(carro.posta)
    const setmanes = Math.floor(
      (dataPosta.getTime() - dataNaix.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )

    // 7) Obtenir eclosió esperada (cridada directament, sense fetch HTTP)
    const eclosioData = await obtenirEclosio(lot.estirp, setmanes, incubadora.tipus)

    // 8) Calcular previsió final
    const ous_fertils = Number(t.ous_fertils_vacunats)
    const quantitat_ous = Number(carro.quantitat_ous)
    const pollets_previstos = Math.round(ous_fertils * eclosioData.eclosio)
    const pct_naixement_previst = pollets_previstos / quantitat_ous

    return NextResponse.json({
      transferencia_id,
      ous_fertils_vacunats: ous_fertils,
      ous_explosius: Number(t.ous_explosius),
      quantitat_ous,
      estirp: lot.estirp,
      posta: carro.posta,
      setmanes_vida: setmanes,
      tipus_incubadora: incubadora.tipus,
      eclosio_esperada: eclosioData.eclosio,
      pollets_previstos,
      pct_naixement_previst: Math.round(pct_naixement_previst * 10000) / 10000,
      font: eclosioData.font,
      n_registres: eclosioData.n_registres,
      detalls: eclosioData.detalls,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error intern' }, { status: 500 })
  }
}
