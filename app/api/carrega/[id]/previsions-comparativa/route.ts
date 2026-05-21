import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { obtenirEclosio, llegirParametresEclosio } from '@/lib/eclosio'

export const dynamic = 'force-dynamic'

const FERTILITAT_FALLBACK = 0.85  // si no hi ha historial del lot

function pct(num: number, den: number): number | null {
  if (!den) return null
  return Math.round((num / den) * 1000) / 10
}

function delta(real: number, previst: number): number | null {
  if (!previst) return null
  return Math.round(((real - previst) / previst) * 1000) / 10
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {

  // ── 1. Assignacions de la càrrega amb dades nested ──────────────────────────
  const { data: assignacions, error } = await supabase
    .from('assignacions')
    .select(`
      id,
      incubadores ( numero, model, tipus ),
      carros_estoc (
        id, quantitat_ous, posta,
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

  // ── 2. Agrupar per lot i recollir IDs dels carros d'aquesta càrrega ─────────
  type CarroRow = {
    carroId: number
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
    nom: string; estirp: string; data_naixement: string
    carros: CarroRow[]
  }

  const lotsMap = new Map<number, LotAccum>()
  const currentCarroIds: number[] = []

  for (const a of assignacions as any[]) {
    const carro = a.carros_estoc
    const lot = carro?.lots_reproductores
    if (!carro || !lot) continue

    const lotId: number = lot.id
    currentCarroIds.push(Number(carro.id))

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
      carroId: Number(carro.id),
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

  const lotIds = Array.from(lotsMap.keys())

  // ── 3. Fertilitat històrica per lot (2 queries per a tots els lots alhora) ──
  //    Busquem carros d'aquests lots de batches ANTERIORS (no de la càrrega actual)
  //    Fertilitat = sum(ous_fertils) / sum(ous_totals) → taxa sobre ous totals

  const fertilitatPerLot = new Map<number, number>()  // lot_id → fertilitat (0..1)

  const { data: carrosAntics } = await supabase
    .from('carros_estoc')
    .select('id, quantitat_ous, lot_id')
    .in('lot_id', lotIds)
    .not('id', 'in', `(${currentCarroIds.join(',')})`)

  if (carrosAntics && carrosAntics.length > 0) {
    const carrosAnticIds = carrosAntics.map((c: any) => c.id)

    const { data: transfAntiques } = await supabase
      .from('transferencies')
      .select('carro_id, ous_fertils_vacunats')
      .in('carro_id', carrosAnticIds)

    const transfMap = new Map<number, number>()
    for (const t of (transfAntiques as any[]) || []) {
      transfMap.set(Number(t.carro_id), Number(t.ous_fertils_vacunats) || 0)
    }

    // Agregar per lot
    const ousTotalsPerLot = new Map<number, number>()
    const ousFertilsPerLot = new Map<number, number>()

    for (const c of carrosAntics as any[]) {
      const lid: number = c.lot_id
      const ous = Number(c.quantitat_ous) || 0
      const fert = transfMap.get(Number(c.id)) ?? null

      // Només comptem carros que han estat transferits:
      // numerador i denominador sobre la mateixa base, evita inflar el denominador
      // amb carros en estoc o en incubadora sense resultat de fertilitat
      if (fert !== null) {
        ousTotalsPerLot.set(lid, (ousTotalsPerLot.get(lid) || 0) + ous)
        ousFertilsPerLot.set(lid, (ousFertilsPerLot.get(lid) || 0) + fert)
      }
    }

    for (const lotId of lotIds) {
      const totals = ousTotalsPerLot.get(lotId) || 0
      const fertils = ousFertilsPerLot.get(lotId) || 0
      if (totals > 0 && fertils > 0) {
        fertilitatPerLot.set(lotId, fertils / totals)
      }
      // si totals=0 o no hi ha transferències: deixem sense valor → usarà FALLBACK
    }
  }

  // ── 4. Paràmetres d'eclosió ──────────────────────────────────────────────────
  const eclosioParams = await llegirParametresEclosio()

  // ── 5. Càlcul de les 3 etapes per lot ───────────────────────────────────────
  const per_lot: any[] = []
  let gOus = 0, gPrevInicial = 0
  let gFertils = 0, gExplosius = 0, gPrevTransf = 0
  let gNascuts = 0

  for (const [lotId, lotData] of Array.from(lotsMap.entries())) {
    const carros = lotData.carros

    // Setmanes de vida (posta del primer carro)
    const primerCarro = carros.find(c => c.posta)
    let setmanes = 40
    if (primerCarro && lotData.data_naixement) {
      setmanes = Math.floor(
        (new Date(primerCarro.posta).getTime() - new Date(lotData.data_naixement).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
      )
    }

    // Tipus incubadora predominant
    const tipusCount = new Map<string, number>()
    for (const c of carros) {
      tipusCount.set(c.incubadora_tipus, (tipusCount.get(c.incubadora_tipus) || 0) + 1)
    }
    const tipusPrincipal = Array.from(tipusCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Singlestage'

    // Eclosió esperada (pollets / ous fèrtils)
    const eclosioRes = await obtenirEclosio(lotData.estirp, setmanes, tipusPrincipal, eclosioParams)
    const ecl = eclosioRes.eclosio

    // Fertilitat esperada (ous fèrtils / ous totals) → historial o fallback
    const fertHist = fertilitatPerLot.get(lotId) ?? null
    const fertEsperada = fertHist ?? FERTILITAT_FALLBACK
    const fertFont: 'historic' | 'fallback' = fertHist !== null ? 'historic' : 'fallback'

    // ── Etapa 1: Assignació ──────────────────────────────────────────────────
    // taxa_naix_esperada = fertilitat_esperada × eclosio_esperada = pollets/ous_totals ✓
    const ous = carros.reduce((s, c) => s + c.ous, 0)
    const taxa_naix_esperada = fertEsperada * ecl
    const pollets_prev_inicial = Math.round(ous * taxa_naix_esperada)

    // ── Etapa 2: Transferència ───────────────────────────────────────────────
    const carros_transf = carros.filter(c => c.te_transferencia)
    const fertils = carros_transf.reduce((s, c) => s + c.fertils, 0)
    const explosius = carros_transf.reduce((s, c) => s + c.explosius, 0)
    // Ara que sabem els ous fèrtils reals, usem ecl directament (pollets/fèrtils) ✓
    const pollets_prev_transf = Math.round(fertils * ecl)

    // ── Etapa 3: Naixement ───────────────────────────────────────────────────
    const carros_naix = carros.filter(c => c.te_resultat)
    const pollets_nascuts = carros_naix.reduce((s, c) => s + c.pollets_nascuts, 0)
    const pollets_descartats = carros_naix.reduce((s, c) => s + c.pollets_descartats, 0)

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
      eclosio_esperada: Math.round(ecl * 1000) / 10,
      eclosio_font: eclosioRes.font,
      fertilitat_esperada: Math.round(fertEsperada * 1000) / 10,
      fertilitat_font: fertFont,
      taxa_naix_esperada: Math.round(taxa_naix_esperada * 1000) / 10,

      etapa1: {
        carros: carros.length,
        ous,
        pollets_previstos: pollets_prev_inicial,
        pct_taxa_naix: Math.round(taxa_naix_esperada * 1000) / 10,
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
        pct_taxa_naix_real: pct(pollets_nascuts, ous),
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
      pct_taxa_naix_real: pct(gNascuts, gOus),
      delta_final: delta(gNascuts, gPrevInicial),
    },
    per_lot,
  })
}
