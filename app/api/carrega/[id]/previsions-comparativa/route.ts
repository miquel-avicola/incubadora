import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { obtenirEclosio, llegirParametresEclosio } from '@/lib/eclosio'

export const dynamic = 'force-dynamic'

function pct(num: number, den: number): number | null {
  if (!den) return null
  return Math.round((num / den) * 1000) / 10
}

function delta(real: number, previst: number): number | null {
  if (!previst) return null
  return Math.round(((real - previst) / previst) * 1000) / 10
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // 1. Fetch totes les assignacions de la càrrega amb dades necessàries
  const { data: assignacions, error } = await supabase
    .from('assignacions')
    .select(`
      id,
      incubadores ( numero, model, tipus ),
      carros_estoc (
        quantitat_ous, posta,
        lots_reproductores (
          id, estirp, data_naixement,
          granges_reproductores ( granja, nom_informal )
        )
      ),
      transferencies (
        ous_fertils_vacunats, ous_explosius,
        resultats_naix ( pollets_nascuts, pollets_descartats )
      )
    `)
    .eq('full_carrega_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. Agrupar per lot
  type CarroRow = {
    incubadora_tipus: string
    ous: number
    posta: string
    fertils: number
    explosius: number
    pollets_nascuts: number
    pollets_descartats: number
    te_transferencia: boolean
    te_resultat: boolean
  }

  type LotAccum = {
    nom: string
    estirp: string
    data_naixement: string
    carros: CarroRow[]
  }

  const lotsMap = new Map<number, LotAccum>()

  for (const a of assignacions as any[]) {
    const carro = a.carros_estoc
    const lot = carro?.lots_reproductores
    if (!carro || !lot) continue

    const lotId: number = lot.id
    if (!lotsMap.has(lotId)) {
      const granja = lot.granges_reproductores?.nom_informal || lot.granges_reproductores?.granja || '?'
      lotsMap.set(lotId, {
        nom: `${granja}${lot.estirp ? ' ' + lot.estirp : ''}`,
        estirp: lot.estirp || '',
        data_naixement: lot.data_naixement || '',
        carros: [],
      })
    }

    const t = a.transferencies?.[0]
    const rn = t?.resultats_naix?.[0]

    lotsMap.get(lotId)!.carros.push({
      incubadora_tipus: a.incubadores?.tipus || 'Singlestage',
      ous: Number(carro.quantitat_ous) || 0,
      posta: carro.posta || '',
      fertils: t ? Number(t.ous_fertils_vacunats) || 0 : 0,
      explosius: t ? Number(t.ous_explosius) || 0 : 0,
      pollets_nascuts: rn ? Number(rn.pollets_nascuts) || 0 : 0,
      pollets_descartats: rn ? Number(rn.pollets_descartats) || 0 : 0,
      te_transferencia: !!t,
      te_resultat: !!rn,
    })
  }

  // 3. Llegir paràmetres d'eclosió (una sola query)
  const eclosioParams = await llegirParametresEclosio()

  // 4. Per cada lot: calcular les 3 etapes
  const per_lot = []
  let gOus = 0, gPrevInicial = 0
  let gFertils = 0, gExplosius = 0, gPrevTransf = 0
  let gNascuts = 0

  for (const [lotId, lotData] of Array.from(lotsMap.entries())) {
    const carros = lotData.carros

    // Setmanes de vida: usem la posta del primer carro (tots de la mateixa setmana)
    const primeraCarro = carros.find(c => c.posta)
    let setmanes = 40  // fallback
    if (primeraCarro && lotData.data_naixement) {
      setmanes = Math.floor(
        (new Date(primeraCarro.posta).getTime() - new Date(lotData.data_naixement).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
      )
    }

    // Tipus d'incubadora predominant (si hi ha barreja, agafem el del primer carro transferit)
    const tipusMap = new Map<string, number>()
    for (const c of carros) {
      tipusMap.set(c.incubadora_tipus, (tipusMap.get(c.incubadora_tipus) || 0) + 1)
    }
    const tipusPrincipal = Array.from(tipusMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Singlestage'

    // Eclosió esperada per aquest lot en aquesta càrrega
    const eclosioRes = await obtenirEclosio(lotData.estirp, setmanes, tipusPrincipal, eclosioParams)
    const ecl = eclosioRes.eclosio

    // Etapa 1: Assignació
    const ous = carros.reduce((s, c) => s + c.ous, 0)
    const pollets_prev_inicial = Math.round(ous * ecl)

    // Etapa 2: Transferència
    const carros_transf = carros.filter(c => c.te_transferencia)
    const fertils = carros_transf.reduce((s, c) => s + c.fertils, 0)
    const explosius = carros_transf.reduce((s, c) => s + c.explosius, 0)
    const pollets_prev_transf = Math.round(fertils * ecl)

    // Etapa 3: Naixement
    const carros_naix = carros.filter(c => c.te_resultat)
    const pollets_nascuts = carros_naix.reduce((s, c) => s + c.pollets_nascuts, 0)
    const pollets_descartats = carros_naix.reduce((s, c) => s + c.pollets_descartats, 0)

    // Acumular globals
    gOus += ous
    gPrevInicial += pollets_prev_inicial
    gFertils += fertils
    gExplosius += explosius
    gPrevTransf += pollets_prev_transf
    gNascuts += pollets_nascuts

    per_lot.push({
      lot_id: lotId,
      nom: lotData.nom,
      setmanes_vida: setmanes,
      tipus_incubadora: tipusPrincipal,
      eclosio_esperada: Math.round(ecl * 1000) / 10,  // en %
      eclosio_font: eclosioRes.font,

      etapa1: {
        carros: carros.length,
        ous,
        pollets_previstos: pollets_prev_inicial,
        pct_eclosio: Math.round(ecl * 1000) / 10,
      },
      etapa2: {
        carros_transferits: carros_transf.length,
        ous_fertils: fertils,
        ous_explosius: explosius,
        pollets_previstos: pollets_prev_transf,
        pct_fertilitat: pct(fertils, ous),
        pct_eclosio: Math.round(ecl * 1000) / 10,
      },
      etapa3: {
        carros_completats: carros_naix.length,
        pollets_nascuts,
        pollets_descartats,
        pct_eclosio_real: pct(pollets_nascuts, fertils),
        pct_taxa_naix: pct(pollets_nascuts, ous),
        delta_vs_inicial: delta(pollets_nascuts, pollets_prev_inicial),
        delta_vs_transf: delta(pollets_nascuts, pollets_prev_transf),
      },
    })
  }

  per_lot.sort((a, b) => a.nom.localeCompare(b.nom))

  return NextResponse.json({
    resum: {
      ous: gOus,
      pollets_previstos_inicial: gPrevInicial,
      ous_fertils: gFertils,
      ous_explosius: gExplosius,
      pollets_previstos_transf: gPrevTransf,
      pollets_nascuts: gNascuts,
      pct_fertilitat: pct(gFertils, gOus),
      pct_eclosio_prevista: pct(gPrevTransf, gFertils),
      pct_eclosio_real: pct(gNascuts, gFertils),
      delta_final: delta(gNascuts, gPrevInicial),
    },
    per_lot,
  })
}
