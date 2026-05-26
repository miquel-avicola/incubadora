// app/api/lots/[id]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const lotId = parseInt(params.id)

  // 1. Info del lot
  const { data: lot, error: lotError } = await supabase
    .from('lots_reproductores')
    .select('id, data_naixement, estirp, granja_reproductora_id, actiu')
    .eq('id', lotId)
    .single()

  if (lotError || !lot) {
    return NextResponse.json({ error: 'Lot no trobat' }, { status: 404 })
  }

  // 2. Info de la granja
  const { data: granja } = await supabase
    .from('granges_reproductores')
    .select('granja, nom_informal')
    .eq('id', lot.granja_reproductora_id)
    .single()

  // 3. Carros d'aquest lot
  const { data: carros, error: carrosError } = await supabase
    .from('carros_estoc')
    .select('id, posta, quantitat_ous')
    .eq('lot_id', lotId)
    .order('posta', { ascending: true })

  if (carrosError || !carros || carros.length === 0) {
    return NextResponse.json({
      lot: { ...lot, granges_reproductores: granja },
      resultats: [],
    })
  }

  const carroIds = carros.map(c => c.id)

  // 4. Assignacions d'aquests carros (per tenir el num_carrega)
  const { data: assignacions } = await supabase
    .from('assignacions')
    .select('carro_id, full_carrega_id, incubadores(tipus)')
    .in('carro_id', carroIds)

 const fullIdsSet = new Set((assignacions || []).map(a => a.full_carrega_id).filter(Boolean))
const fullIds = Array.from(fullIdsSet)

  // 5. Fulls de càrrega
  const { data: fulls } = fullIds.length > 0
    ? await supabase.from('fulls_carrega').select('id, num_carrega, carrega').in('id', fullIds)
    : { data: [] }

  // 6. Transferències d'aquests carros
  const { data: transferencies } = await supabase
    .from('transferencies')
    .select('id, carro_id, ous_fertils_vacunats')
    .in('carro_id', carroIds)

  const transfIds = (transferencies || []).map(t => t.id)

  // 7. Resultats de naixement
  const { data: resultatsNaix } = transfIds.length > 0
    ? await supabase
        .from('resultats_naix')
        .select('id, transferencia_id, pollets_nascuts, pollets_descartats, naixement')
        .in('transferencia_id', transfIds)
    : { data: [] }

  // 8. Construir els resultats agrupant per carro
  const dataNaixementLot = new Date(lot.data_naixement)

  const resultats = []

  for (const carro of carros) {
    const posta = new Date(carro.posta)
    const diffMs = posta.getTime() - dataNaixementLot.getTime()
    const setmana_vida = Math.floor(diffMs / (7 * 24 * 3600 * 1000))

    // Assignació i full de càrrega
    const assignacio = (assignacions || []).find(a => a.carro_id === carro.id)
    const full = assignacio ? (fulls || []).find(f => f.id === assignacio.full_carrega_id) : null
    const tipusIncubadora = assignacio?.incubadores ? (assignacio.incubadores as any).tipus : null

    // Transferències i resultats
    const transfsDelCarro = (transferencies || []).filter(t => t.carro_id === carro.id)

    for (const transf of transfsDelCarro) {
      const resDelTransf = (resultatsNaix || []).filter(r => r.transferencia_id === transf.id)

      for (const res of resDelTransf) {
        const ous = carro.quantitat_ous
        const fertils = transf.ous_fertils_vacunats ?? null
        const nascuts = res.pollets_nascuts ?? null

        resultats.push({
          carro_id: carro.id,
          posta: carro.posta,
          setmana_vida,
          num_carrega: full?.num_carrega ?? null,
          data_carrega: full?.carrega ?? null,
          quantitat_ous: ous,
          ous_fertils: fertils,
          pollets_nascuts: nascuts,
          pollets_descartats: res.pollets_descartats ?? null,
          data_naixement_pollets: res.naixement ?? null,
          tipus_incubadora: tipusIncubadora,
          fertilitat: fertils !== null && ous > 0 ? Math.round((fertils / ous) * 1000) / 10 : null,
          eclosio: fertils !== null && fertils > 0 && nascuts !== null ? Math.round((nascuts / fertils) * 1000) / 10 : null,
          naixement: nascuts !== null && ous > 0 ? Math.round((nascuts / ous) * 1000) / 10 : null,
        })
      }
    }
  }

  resultats.sort((a, b) => new Date(a.posta).getTime() - new Date(b.posta).getTime())

  return NextResponse.json({
    lot: { ...lot, granges_reproductores: granja },
    resultats,
  })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const lotId = parseInt(params.id)
  const raw = await request.json().catch(() => null)
  if (raw === null || typeof raw.actiu !== 'boolean') {
    return NextResponse.json({ error: 'Payload invàlid' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lots_reproductores')
    .update({ actiu: raw.actiu })
    .eq('id', lotId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}