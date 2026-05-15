import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calcularPrevisioFinal } from '@/lib/previsio'

// GET /api/previsio?lot_id=...&posta=YYYY-MM-DD&tipus=Singlestage|Multistage
//
// Retorna la previsió de naixement (pollets_nascuts / quantitat_ous) per a un
// carro nou que s'està assignant. Substitueix la consulta original a la taula
// `previsio_referencia` (que tenia un offset fix +4% Singlestage incorrecte)
// per una cascada de fonts estratificada per tipus d'incubadora:
//   1. Supabase post-tall, setmana exacta
//   2. Excel històric, setmana exacta
//   3. Supabase post-tall, finestra ±2 setmanes
//   4. Excel històric, finestra ±2 setmanes
//   5. Mitjana global Excel per (estirp, tipus)
//   6. Cas especial Cobb Singlestage (sense dades): derivat de Ross
//   7. Fallback constant
//
// Si el paràmetre `delta_lot_actiu` és true a Supabase, també aplica el delta
// del lot per sobre de la referència. Per defecte està desactivat (la validació
// del 15/05/2026 amb 85 punts va mostrar que empitjorava marginalment).
//
// Format de resposta preservat (camp `previsio`) per no trencar el frontend.
// Camps addicionals informatius: font, referencia_pura, delta_aplicat,
// n_registres_referencia, n_registres_lot, etc.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lot_id = searchParams.get('lot_id')
  const posta = searchParams.get('posta')
  const tipus_incubadora = searchParams.get('tipus')

  if (!lot_id || !posta) {
    return NextResponse.json({ error: 'Falten paràmetres' }, { status: 400 })
  }
  if (tipus_incubadora !== 'Singlestage' && tipus_incubadora !== 'Multistage') {
    return NextResponse.json(
      { error: "Tipus invàlid (cal 'Singlestage' o 'Multistage')" },
      { status: 400 }
    )
  }

  // Obtenir data de naixement del lot i estirp
  const { data: lot, error: errLot } = await supabase
    .from('lots_reproductores')
    .select('data_naixement, estirp')
    .eq('id', lot_id)
    .single()

  if (errLot || !lot || !lot.data_naixement || !lot.estirp) {
    return NextResponse.json({
      previsio: null,
      motiu: 'Lot sense data de naixement o estirp',
    })
  }

  // Calcular setmanes de vida en el moment de la posta
  const dataNaix = new Date(lot.data_naixement)
  const dataPosta = new Date(posta)
  const setmanes = Math.floor(
    (dataPosta.getTime() - dataNaix.getTime()) / (7 * 24 * 60 * 60 * 1000)
  )

  if (setmanes < 0 || setmanes > 100) {
    return NextResponse.json({
      previsio: null,
      motiu: `Setmanes calculades fora de rang: ${setmanes}`,
    })
  }

  // Cridar a la nova cascada (+ delta del lot si està actiu)
  try {
    const result = await calcularPrevisioFinal(
      Number(lot_id),
      lot.estirp,
      setmanes,
      tipus_incubadora,
      posta
    )

    return NextResponse.json({
      // Camps preservats per retrocompatibilitat amb el frontend existent
      previsio: result.previsio,
      setmanes,
      estirp: lot.estirp,
      n_registres: result.n_registres_referencia,
      interpolat: result.font !== 'supabase_setmana_exacta' && result.font !== 'excel_setmana_exacta',
      singlestage: tipus_incubadora === 'Singlestage',
      // Camps nous informatius
      font: result.font,
      referencia_pura: result.referencia_pura,
      delta_aplicat: result.delta_aplicat,
      n_registres_lot: result.n_registres_lot,
      n_registres_descartats: result.n_registres_descartats,
      motiu_delta_no_aplicat: result.motiu_delta_no_aplicat,
      tipus_incubadora,
      detalls: result.detalls,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: `Error calculant la previsió: ${e?.message ?? e}` },
      { status: 500 }
    )
  }
}
