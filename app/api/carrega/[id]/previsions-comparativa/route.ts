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

  // ── 1. Assignacions de la càrrega amb previsio_naixement ─────────────────────
  const { data: assignacions, error } = await supabase
    .from('assignacions')
    .select(`
      id,
      previsio_naixement,
      previsio_manual,
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

  // ── 2. Agrupar per (lot_id, incubadora_tipus) ────────────────────────────────
  type CarroRow = {
    ous: number
    posta: string
    previsio_naix: number | null   // de la taula assignacions
    fertils: number
    explosius: number
    pollets_nascuts: number
    pollets_descartats: number
    te_transferencia: boolean
    te_resultat: boolean
  }
  type GrupAccum = {
    lot_id: number
    nom: string
    estirp: string
    data_naixement: string
    tipus_incubadora: string
    carros: CarroRow[]
  }

  // Clau: `${lotId}_${tipusIncubadora}`
  const grupsMap = new Map<string, GrupAccum>()

  for (const a of assignacions as any[]) {
    const carro = a.carros_estoc
    const lot = carro?.lots_reproductores
    if (!carro || !lot) continue

    const lotId: number = lot.id
    const tipus: string = a.incubadores?.tipus || 'Singlestage'
    const key = `${lotId}_${tipus}`

    if (!grupsMap.has(key)) {
      const granja = lot.granges_reproductores?.nom_informal || lot.granges_reproductores?.granja || '?'
      grupsMap.set(key, {
        lot_id: lotId,
        nom: `${granja}${lot.estirp ? ' ' + lot.estirp : ''}`,
        estirp: lot.estirp || '',
        data_naixement: lot.data_naixement || '',
        tipus_incubadora: tipus,
        carros: [],
      })
    }

    const t = a.transferencies?.[0]
    const rn = t?.resultats_naix?.[0]

    grupsMap.get(key)!.carros.push({
      ous: Number(carro.quantitat_ous) || 0,
      posta: carro.posta || '',
      previsio_naix: a.previsio_naixement != null ? Number(a.previsio_naixement) : null,
      fertils: t ? Number(t.ous_fertils_vacunats) || 0 : 0,
      explosius: t ? Number(t.ous_explosius) || 0 : 0,
      pollets_nascuts: rn ? Number(rn.pollets_nascuts) || 0 : 0,
      pollets_descartats: rn ? Number(rn.pollets_descartats) || 0 : 0,
      te_transferencia: !!t,
      te_resultat: !!rn,
    })
  }

  // ── 3. Paràmetres d'eclosió (una sola query per a tota la ruta) ──────────────
  const eclosioParams = await llegirParametresEclosio()

  // ── 4. Càlcul de les 3 etapes per grup (lot + tipus incubadora) ──────────────
  const per_lot: any[] = []
  let gOus = 0, gPrevInicial = 0
  let gFertils = 0, gExplosius = 0, gPrevTransf = 0
  let gNascuts = 0

  for (const [, grup] of Array.from(grupsMap.entries())) {
    const carros = grup.carros

    // Setmanes de vida (posta del primer carro del grup amb data)
    const primerCarro = carros.find(c => c.posta)
    let setmanes = 40
    if (primerCarro && grup.data_naixement) {
      setmanes = Math.floor(
        (new Date(primerCarro.posta).getTime() - new Date(grup.data_naixement).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
      )
    }

    // Eclosió esperada (pollets / ous fèrtils) per a l'etapa 2
    const eclosioRes = await obtenirEclosio(grup.estirp, setmanes, grup.tipus_incubadora, eclosioParams)
    const ecl = eclosioRes.eclosio

    // ── Etapa 1: Assignació ──────────────────────────────────────────────────
    // Usem previsio_naixement guardat a la taula assignacions (el que vas entrar)
    // pollets_prev_inicial = sum(ous_i × previsio_i)
    const ous = carros.reduce((s, c) => s + c.ous, 0)
    const carros_amb_prev = carros.filter(c => c.previsio_naix !== null)
    const carros_sense_prev = carros.length - carros_amb_prev.length

    const pollets_prev_inicial = carros_amb_prev.reduce(
      (s, c) => s + Math.round(c.ous * c.previsio_naix!), 0
    )
    // Taxa ponderada = pollets_previstos / ous_dels_carros_amb_previsio
    const ous_amb_prev = carros_amb_prev.reduce((s, c) => s + c.ous, 0)
    const pct_taxa_naix_prev = pct(pollets_prev_inicial, ous_amb_prev)

    // ── Etapa 2: Transferència ───────────────────────────────────────────────
    const carros_transf = carros.filter(c => c.te_transferencia)
    const fertils = carros_transf.reduce((s, c) => s + c.fertils, 0)
    const explosius = carros_transf.reduce((s, c) => s + c.explosius, 0)
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
      lot_id: grup.lot_id,
      nom: grup.nom,
      tipus_incubadora: grup.tipus_incubadora,
      setmanes_vida: setmanes,
      eclosio_esperada: Math.round(ecl * 1000) / 10,
      eclosio_font: eclosioRes.font,

      etapa1: {
        carros: carros.length,
        carros_sense_previsio: carros_sense_prev,
        ous,
        pollets_previstos: pollets_prev_inicial,
        pct_taxa_naix: pct_taxa_naix_prev,
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

  per_lot.sort((a, b) => a.nom.localeCompare(b.nom) || a.tipus_incubadora.localeCompare(b.tipus_incubadora))

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
