import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function pct(num: number, den: number): number | null {
  if (!den) return null
  return Math.round((num / den) * 1000) / 10
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
  const perIncubadora: Record<number, { numero: number; model: string; carros: number; ous: number; fertils: number; pollets: number }> = {}
  const perNaixedora: Record<number, { numero: number; fertils: number; pollets: number }> = {}
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
    if (!perLot[lotId]) {
      const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
      perLot[lotId] = { nom: `${granja}${lot.estirp ? ' ' + lot.estirp : ''}`, carros: 0, ous: 0, fertils: 0, explosius: 0, pollets: 0 }
    }
    perLot[lotId].carros++; perLot[lotId].ous += ous; perLot[lotId].fertils += fertils
    perLot[lotId].explosius += explosius; perLot[lotId].pollets += pollets

    if (!perIncubadora[inc.numero])
      perIncubadora[inc.numero] = { numero: inc.numero, model: inc.model, carros: 0, ous: 0, fertils: 0, pollets: 0 }
    perIncubadora[inc.numero].carros++; perIncubadora[inc.numero].ous += ous
    perIncubadora[inc.numero].fertils += fertils; perIncubadora[inc.numero].pollets += pollets

    if (nNum != null) {
      if (!perNaixedora[nNum]) perNaixedora[nNum] = { numero: nNum, fertils: 0, pollets: 0 }
      perNaixedora[nNum].fertils += fertils; perNaixedora[nNum].pollets += pollets
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
      ...i, fertilitat: pct(i.fertils, i.ous), taxa_eclosio: pct(i.pollets, i.fertils),
    })),
    per_naixedora: Object.values(perNaixedora).sort((a, b) => a.numero - b.numero).map(n => ({
      ...n, taxa_eclosio: pct(n.pollets, n.fertils), perdua: pct(n.fertils - n.pollets, n.fertils),
    })),
  })
}