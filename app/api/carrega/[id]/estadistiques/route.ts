import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function pct(num: number, den: number): number | null {
  if (!den) return null
  return Math.round((num / den) * 1000) / 10
}

interface LotAcum {
  lot_id: number
  nom: string
  carros: number
  ous: number
  fertils: number
  pollets: number
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data: assignacions, error } = await supabase
    .from('assignacions')
    .select(`
      id,
      carros_estoc ( quantitat_ous,
        lots_reproductores ( id, estirp,
          granges_reproductores ( granja, nom_informal )
        )
      ),
      incubadores ( numero, model ),
      transferencies (
        ous_fertils_vacunats, ous_explosius,
        naixedores ( numero ),
        resultats_naix ( pollets_nascuts )
      )
    `)
    .eq('full_carrega_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const perLot: Record<number, { nom: string; carros: number; ous: number; fertils: number; explosius: number; pollets: number }> = {}
  const perIncubadora: Record<number, { numero: number; model: string; carros: number; ous: number; fertils: number; pollets: number; lots: Record<number, LotAcum> }> = {}
  const perNaixedora: Record<number, { numero: number; ous: number; fertils: number; pollets: number; lots: Record<number, LotAcum> }> = {}
  let gOus = 0, gFertils = 0, gExplosius = 0, gPollets = 0

  for (const a of assignacions as any[]) {
    const carro = a.carros_estoc
    const lot = carro.lots_reproductores
    const inc = a.incubadores
    const t = a.transferencies?.[0]

    const ous = carro.quantitat_ous || 0
    const fertils = t?.ous_fertils_vacunats || 0
    const explosius = t?.ous_explosius || 0
    const pollets = t?.resultats_naix?.[0]?.pollets_nascuts || 0
    const nNum = t?.naixedores?.numero

    gOus += ous; gFertils += fertils; gExplosius += explosius; gPollets += pollets

    const lotId = lot.id
    const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
    const lotNom = `${granja}${lot.estirp ? ' ' + lot.estirp : ''}`

    if (!perLot[lotId]) {
      perLot[lotId] = { nom: lotNom, carros: 0, ous: 0, fertils: 0, explosius: 0, pollets: 0 }
    }
    perLot[lotId].carros++; perLot[lotId].ous += ous; perLot[lotId].fertils += fertils
    perLot[lotId].explosius += explosius; perLot[lotId].pollets += pollets

    // Per incubadora (totals + desglossament per lot)
    if (!perIncubadora[inc.numero])
      perIncubadora[inc.numero] = { numero: inc.numero, model: inc.model, carros: 0, ous: 0, fertils: 0, pollets: 0, lots: {} }
    const inci = perIncubadora[inc.numero]
    inci.carros++; inci.ous += ous; inci.fertils += fertils; inci.pollets += pollets

    if (!inci.lots[lotId])
      inci.lots[lotId] = { lot_id: lotId, nom: lotNom, carros: 0, ous: 0, fertils: 0, pollets: 0 }
    const incLot = inci.lots[lotId]
    incLot.carros++; incLot.ous += ous; incLot.fertils += fertils; incLot.pollets += pollets

    // Per naixedora (totals + desglossament per lot)
    if (nNum != null) {
      if (!perNaixedora[nNum])
        perNaixedora[nNum] = { numero: nNum, ous: 0, fertils: 0, pollets: 0, lots: {} }
      const naxi = perNaixedora[nNum]
      naxi.ous += ous; naxi.fertils += fertils; naxi.pollets += pollets

      if (!naxi.lots[lotId])
        naxi.lots[lotId] = { lot_id: lotId, nom: lotNom, carros: 0, ous: 0, fertils: 0, pollets: 0 }
      const naxLot = naxi.lots[lotId]
      naxLot.carros++; naxLot.ous += ous; naxLot.fertils += fertils; naxLot.pollets += pollets
    }
  }

  return NextResponse.json({
    resum: {
      total_ous: gOus, ous_fertils: gFertils, ous_explosius: gExplosius, pollets: gPollets,
      fertilitat: pct(gFertils, gOus), taxa_eclosio: pct(gPollets, gFertils),
      naixement: pct(gPollets, gOus), perdua: pct(gFertils - gPollets, gFertils),
    },
    per_lot: Object.values(perLot).map(l => ({
      ...l, fertilitat: pct(l.fertils, l.ous), taxa_eclosio: pct(l.pollets, l.fertils),
      naixement: pct(l.pollets, l.ous), perdua: pct(l.fertils - l.pollets, l.fertils),
    })),
    per_incubadora: Object.values(perIncubadora).sort((a, b) => a.numero - b.numero).map(i => ({
      numero: i.numero,
      model: i.model,
      carros: i.carros,
      ous: i.ous,
      fertils: i.fertils,
      pollets: i.pollets,
      fertilitat: pct(i.fertils, i.ous),
      taxa_eclosio: pct(i.pollets, i.fertils),
      naixement: pct(i.pollets, i.ous),
      lots: Object.values(i.lots).sort((a, b) => a.nom.localeCompare(b.nom)).map(l => ({
        lot_id: l.lot_id,
        nom: l.nom,
        carros: l.carros,
        ous: l.ous,
        fertils: l.fertils,
        pollets: l.pollets,
        fertilitat: pct(l.fertils, l.ous),
        taxa_eclosio: pct(l.pollets, l.fertils),
        naixement: pct(l.pollets, l.ous),
      })),
    })),
    per_naixedora: Object.values(perNaixedora).sort((a, b) => a.numero - b.numero).map(n => ({
      numero: n.numero,
      ous: n.ous,
      fertils: n.fertils,
      pollets: n.pollets,
      taxa_eclosio: pct(n.pollets, n.fertils),
      naixement: pct(n.pollets, n.ous),
      perdua: pct(n.fertils - n.pollets, n.fertils),
      lots: Object.values(n.lots).sort((a, b) => a.nom.localeCompare(b.nom)).map(l => ({
        lot_id: l.lot_id,
        nom: l.nom,
        carros: l.carros,
        ous: l.ous,
        fertils: l.fertils,
        pollets: l.pollets,
        taxa_eclosio: pct(l.pollets, l.fertils),
        naixement: pct(l.pollets, l.ous),
        perdua: pct(l.fertils - l.pollets, l.fertils),
      })),
    })),
  })
}
