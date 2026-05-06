import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lot_id = searchParams.get('lot_id')
  const posta = searchParams.get('posta')
  const tipus_incubadora = searchParams.get('tipus') // 'Singlestage' o 'Multistage'

  if (!lot_id || !posta) {
    return NextResponse.json({ error: 'Falten paràmetres' }, { status: 400 })
  }

  // Obtenir data de naixement del lot i estirp
  const { data: lot } = await supabase
    .from('lots_reproductores')
    .select('data_naixement, estirp')
    .eq('id', lot_id)
    .single()

  if (!lot || !lot.data_naixement || !lot.estirp) {
    return NextResponse.json({ previsio: null, motiu: 'Lot sense data de naixement o estirp' })
  }

  // Calcular setmanes de vida en el moment de la posta
  const dataNaix = new Date(lot.data_naixement)
  const dataPosta = new Date(posta)
  const setmanes = Math.floor((dataPosta.getTime() - dataNaix.getTime()) / (7 * 24 * 60 * 60 * 1000))

  // Buscar la previsió a la taula de referència
  const { data: ref } = await supabase
    .from('previsio_referencia')
    .select('previsio, n_registres')
    .eq('estirp', lot.estirp)
    .lte('setmanes_min', setmanes)
    .gte('setmanes_max', setmanes)
    .single()

  if (!ref) {
    // Buscar el bucket més proper
    const { data: proper } = await supabase
      .from('previsio_referencia')
      .select('previsio, setmanes_min, setmanes_max, n_registres')
      .eq('estirp', lot.estirp)
      .order('setmanes_min', { ascending: false })
      .limit(1)
      .single()

    if (!proper) {
      return NextResponse.json({ previsio: null, motiu: 'Sense dades per aquesta estirp' })
    }

    let previsio = proper.previsio
    if (tipus_incubadora === 'Singlestage') previsio = Math.min(previsio + 0.04, 1)

    return NextResponse.json({
      previsio: Math.round(previsio * 1000) / 1000,
      setmanes,
      estirp: lot.estirp,
      n_registres: proper.n_registres,
      interpolat: true,
      singlestage: tipus_incubadora === 'Singlestage',
    })
  }

  let previsio = ref.previsio
  if (tipus_incubadora === 'Singlestage') previsio = Math.min(previsio + 0.04, 1)

  return NextResponse.json({
    previsio: Math.round(previsio * 1000) / 1000,
    setmanes,
    estirp: lot.estirp,
    n_registres: ref.n_registres,
    interpolat: false,
    singlestage: tipus_incubadora === 'Singlestage',
  })
}
