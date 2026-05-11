import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function pct(num: number, den: number): number | null {
  if (!den) return null
  return Math.round((num / den) * 1000) / 10
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Get the lot first
  const { data: lot, error: lotError } = await supabase
    .from('lots_reproductores')
    .select('id, data_naixement, estirp, granges_reproductores(granja, nom_informal)')
    .eq('id', params.id)
    .single()

  if (lotError || !lot) {
    return NextResponse.json({ error: 'Lot no trobat' }, { status: 404 })
  }

  // Get all carrings that contained this lot
  const { data: assignacions, error: assignError } = await supabase
    .from('assignacions')
    .select(`
      id,
      full_carrega_id,
      fulls_carrega (
        id,
        num_carrega,
        carrega,
        transferencia
      ),
      carros_estoc (
        quantitat_ous,
        lots_reproductores_id
      ),
      transferencies (
        ous_fertils_vacunats,
        ous_explosius,
        resultats_naix (pollets_nascuts)
      )
    `)
    .eq('carros_estoc.lots_reproductores_id', params.id)

  if (assignError) {
    return NextResponse.json({ error: assignError.message }, { status: 500 })
  }

  // Group by full_carrega and calculate stats
  const carreguesMap: Record<number, {
    full_carrega_id: number
    num_carrega: number
    carrega: string
    transferencia: string | null
    ous: number
    ous_fertils: number
    ous_explosius: number
    pollets: number
    setmana_vida: number | null
  }> = {}

  for (const a of assignacions as any[]) {
    const full = a.fulls_carrega
    const carro = a.carros_estoc
    const t = a.transferencies?.[0]

    if (!full || carro.lots_reproductores_id !== parseInt(params.id)) continue

    const key = full.id
    if (!carreguesMap[key]) {
      // Calculate week of life
      const dataCarrega = new Date(full.carrega)
      const dataTransferencia = full.transferencia ? new Date(full.transferencia) : null
      let setmana: number | null = null
      
      if (dataTransferencia) {
        const diffMs = dataTransferencia.getTime() - dataCarrega.getTime()
        const diffDies = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        setmana = Math.floor(diffDies / 7)
      }

      carreguesMap[key] = {
        full_carrega_id: full.id,
        num_carrega: full.num_carrega,
        carrega: full.carrega,
        transferencia: full.transferencia,
        ous: 0,
        ous_fertils: 0,
        ous_explosius: 0,
        pollets: 0,
        setmana_vida: setmana,
      }
    }

    const ous = carro.quantitat_ous || 0
    const fertils = t?.ous_fertils_vacunats || 0
    const explosius = t?.ous_explosius || 0
    const pollets = t?.resultats_naix?.[0]?.pollets_nascuts || 0

    carreguesMap[key].ous += ous
    carreguesMap[key].ous_fertils += fertils
    carreguesMap[key].ous_explosius += explosius
    carreguesMap[key].pollets += pollets
  }

  const carregues = Object.values(carreguesMap)
    .map(c => ({
      ...c,
      fertilitat: pct(c.ous_fertils, c.ous),
      taxa_eclosio: pct(c.pollets, c.ous_fertils),
      naixement: pct(c.pollets, c.ous),
    }))
    .sort((a, b) => new Date(b.carrega).getTime() - new Date(a.carrega).getTime())

  // Calculate overall stats
  let totalOus = 0, totalFertils = 0, totalPollets = 0
  let sumFertilitat = 0, sumEclosio = 0, sumNaixement = 0, countStats = 0

  for (const c of carregues) {
    totalOus += c.ous
    totalFertils += c.ous_fertils
    totalPollets += c.pollets

    if (c.fertilitat !== null) {
      sumFertilitat += c.fertilitat
      countStats++
    }
    if (c.taxa_eclosio !== null) sumEclosio += c.taxa_eclosio
    if (c.naixement !== null) sumNaixement += c.naixement
  }

  const grangeData = Array.isArray(lot.granges_reproductores) ? lot.granges_reproductores[0] : lot.granges_reproductores
  const granja = grangeData.nom_informal || grangeData.granja
  const nomLot = `${granja}${lot.estirp ? ' ' + lot.estirp : ''}`

  return NextResponse.json({
    lot: {
      id: lot.id,
      nom: nomLot,
      data_naixement: lot.data_naixement,
      estirp: lot.estirp,
      granja: lot.granges_reproductores,
    },
    resum: {
      total_ous: totalOus,
      total_pollets: totalPollets,
      fertilitat_mitjana: countStats > 0 ? Math.round((sumFertilitat / countStats) * 10) / 10 : null,
      eclosio_mitjana: carregues.length > 0 ? Math.round((sumEclosio / carregues.length) * 10) / 10 : null,
      naixement_mitjana: carregues.length > 0 ? Math.round((sumNaixement / carregues.length) * 10) / 10 : null,
      num_carregues: carregues.length,
    },
    carregues,
  })
}
