import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { obtenirEclosio, llegirParametresEclosio } from '@/lib/eclosio'

export const dynamic = 'force-dynamic'

function pct(num: number, den: number): number | null {
  if (!den) return null
  return Math.round((num / den) * 1000) / 10
}

type Acum = {
  carros: number
  ous: number
  fertils: number
  explosius: number
  pollets_previstos: number
  pollets_nascuts: number
}

function novaAcum(): Acum {
  return { carros: 0, ous: 0, fertils: 0, explosius: 0, pollets_previstos: 0, pollets_nascuts: 0 }
}

function addAcum(a: Acum, ous: number, fertils: number, explosius: number, prev: number, reals: number) {
  a.carros++
  a.ous += ous
  a.fertils += fertils
  a.explosius += explosius
  a.pollets_previstos += prev
  a.pollets_nascuts += reals
}

function fmtAcum(a: Acum) {
  const pollets = a.pollets_previstos + a.pollets_nascuts
  return {
    carros: a.carros,
    ous: a.ous,
    fertils: a.fertils,
    explosius: a.explosius,
    pollets_previstos: a.pollets_previstos,
    pollets_nascuts: a.pollets_nascuts,
    fertilitat: pct(a.fertils, a.ous),
    taxa_eclosio: pct(pollets, a.fertils),
    taxa_naixement: pct(pollets, a.ous),
  }
}

type LotAcum = Acum & {
  lot_id: number
  nom: string
  propera_naix: string | null
  per_incubadora: Record<number, Acum & { numero: number; model: string }>
  per_naixedora: Record<number, Acum & { numero: number }>
}

type IncAcum = Acum & {
  numero: number
  model: string
  lots: Record<number, Acum & { lot_id: number; nom: string }>
}

type NaixAcum = Acum & {
  numero: number
  lots: Record<number, Acum & { lot_id: number; nom: string }>
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const diesStr = searchParams.get('dies')
  const lotIdStr = searchParams.get('lot_id')

  // 1. Fetch totes les assignacions amb dades nested
  const { data: raw, error } = await supabase
    .from('assignacions')
    .select(`
      id,
      previsio_naixement,
      full_carrega_id,
      fulls_carrega ( carrega ),
      incubadores ( id, numero, model, tipus ),
      carros_estoc (
        quantitat_ous, posta,
        lots_reproductores (
          id, estirp, data_naixement,
          granges_reproductores ( granja, nom_informal )
        )
      ),
      transferencies (
        id, ous_fertils_vacunats, ous_explosius,
        naixedores ( numero ),
        resultats_naix ( pollets_nascuts, pollets_descartats )
      )
    `)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. Filtrar per data (per data de càrrega del full) i per lot
  let assignacions = raw as any[]

  if (diesStr) {
    const dies = parseInt(diesStr, 10)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - dies)
    assignacions = assignacions.filter(a => {
      const dc = a.fulls_carrega?.carrega
      if (!dc) return false
      return new Date(dc) >= cutoff
    })
  }

  if (lotIdStr) {
    const lotId = parseInt(lotIdStr, 10)
    assignacions = assignacions.filter(a => a.carros_estoc?.lots_reproductores?.id === lotId)
  }

  // 3. Identificar els carros en estadi 2 (transferits però sense resultat)
  //    i calcular eclosió per cada combinació única (estirp, setmanes, tipus)
  const params = await llegirParametresEclosio()
  const combsToCalc = new Map<string, { estirp: string; setmanes: number; tipus: string }>()

  for (const a of assignacions) {
    const t = a.transferencies?.[0]
    if (!t || t.resultats_naix?.[0]) continue  // Estadi 1 o 3: no cal càlcul

    const carro = a.carros_estoc
    const lot = carro?.lots_reproductores
    const inc = a.incubadores
    if (!lot?.estirp || !lot?.data_naixement || !carro?.posta || !inc?.tipus) continue

    const setmanes = Math.floor(
      (new Date(carro.posta).getTime() - new Date(lot.data_naixement).getTime()) /
      (7 * 24 * 60 * 60 * 1000)
    )
    const key = `${lot.estirp}__${setmanes}__${inc.tipus}`
    if (!combsToCalc.has(key)) {
      combsToCalc.set(key, { estirp: lot.estirp, setmanes, tipus: inc.tipus })
    }
  }

  // Crida batch (una per combinació única, no per carro)
  const eclosioCache = new Map<string, number>()
  for (const [key, { estirp, setmanes, tipus }] of Array.from(combsToCalc.entries())) {
    const res = await obtenirEclosio(estirp, setmanes, tipus, params)
    eclosioCache.set(key, res.eclosio)
  }

  // 4. Acumular
  const perLot = new Map<number, LotAcum>()
  const perInc = new Map<number, IncAcum>()
  const perNaix = new Map<number, NaixAcum>()
  const global = novaAcum()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const a of assignacions) {
    const carro = a.carros_estoc
    const lot = carro?.lots_reproductores
    const inc = a.incubadores
    if (!carro || !lot || !inc) continue

    const ous = Number(carro.quantitat_ous) || 0
    const lotId: number = lot.id
    const granja: string = lot.granges_reproductores?.nom_informal || lot.granges_reproductores?.granja || '?'
    const lotNom = `${granja}${lot.estirp ? ' ' + lot.estirp : ''}`
    const incNum: number = inc.numero

    const t = a.transferencies?.[0]
    const fertils = t ? Number(t.ous_fertils_vacunats) || 0 : 0
    const explosius = t ? Number(t.ous_explosius) || 0 : 0
    const rn = t?.resultats_naix?.[0]

    let prev = 0
    let reals = 0

    if (rn) {
      // Estadi 3: resultat real
      reals = Number(rn.pollets_nascuts) || 0
    } else if (t && lot.estirp && lot.data_naixement && carro.posta && inc.tipus) {
      // Estadi 2: previsió calculada
      const setmanes = Math.floor(
        (new Date(carro.posta).getTime() - new Date(lot.data_naixement).getTime()) /
        (7 * 24 * 60 * 60 * 1000)
      )
      const key = `${lot.estirp}__${setmanes}__${inc.tipus}`
      const ecl = eclosioCache.get(key) ?? params.eclosio_fallback
      prev = Math.round(fertils * ecl)
    }
    // Estadi 1: sense transferència → tots els comptadors queden a 0 excepte ous

    const nNum: number | null = t?.naixedores?.numero ?? null

    // Global
    addAcum(global, ous, fertils, explosius, prev, reals)

    // Per lot
    if (!perLot.has(lotId)) {
      perLot.set(lotId, {
        ...novaAcum(), lot_id: lotId, nom: lotNom, propera_naix: null,
        per_incubadora: {}, per_naixedora: {}
      })
    }
    const lotAgg = perLot.get(lotId)!
    addAcum(lotAgg, ous, fertils, explosius, prev, reals)

    // Propera data de previsió de naixement (futura)
    const pn: string | null = a.previsio_naixement ?? null
    if (pn) {
      const pnDate = new Date(pn)
      if (pnDate >= today) {
        if (!lotAgg.propera_naix || pnDate < new Date(lotAgg.propera_naix)) {
          lotAgg.propera_naix = pn
        }
      }
    }

    // Per incubadora dins lot
    if (!lotAgg.per_incubadora[incNum]) {
      lotAgg.per_incubadora[incNum] = { ...novaAcum(), numero: incNum, model: inc.model }
    }
    addAcum(lotAgg.per_incubadora[incNum], ous, fertils, explosius, prev, reals)

    // Per naixedora dins lot
    if (nNum != null) {
      if (!lotAgg.per_naixedora[nNum]) {
        lotAgg.per_naixedora[nNum] = { ...novaAcum(), numero: nNum }
      }
      addAcum(lotAgg.per_naixedora[nNum], ous, fertils, explosius, prev, reals)
    }

    // Per incubadora (global)
    if (!perInc.has(incNum)) {
      perInc.set(incNum, { ...novaAcum(), numero: incNum, model: inc.model, lots: {} })
    }
    const incAgg = perInc.get(incNum)!
    addAcum(incAgg, ous, fertils, explosius, prev, reals)
    if (!incAgg.lots[lotId]) {
      incAgg.lots[lotId] = { ...novaAcum(), lot_id: lotId, nom: lotNom }
    }
    addAcum(incAgg.lots[lotId], ous, fertils, explosius, prev, reals)

    // Per naixedora (global)
    if (nNum != null) {
      if (!perNaix.has(nNum)) {
        perNaix.set(nNum, { ...novaAcum(), numero: nNum, lots: {} })
      }
      const naixAgg = perNaix.get(nNum)!
      addAcum(naixAgg, ous, fertils, explosius, prev, reals)
      if (!naixAgg.lots[lotId]) {
        naixAgg.lots[lotId] = { ...novaAcum(), lot_id: lotId, nom: lotNom }
      }
      addAcum(naixAgg.lots[lotId], ous, fertils, explosius, prev, reals)
    }
  }

  // 5. Formatear resposta
  return NextResponse.json({
    resum: {
      ...fmtAcum(global),
      pollets_total: global.pollets_previstos + global.pollets_nascuts,
    },
    per_lot: Array.from(perLot.values())
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map(l => ({
        lot_id: l.lot_id,
        nom: l.nom,
        propera_naix: l.propera_naix,
        ...fmtAcum(l),
        per_incubadora: Object.values(l.per_incubadora)
          .sort((a, b) => a.numero - b.numero)
          .map(i => ({ numero: i.numero, model: i.model, ...fmtAcum(i) })),
        per_naixedora: Object.values(l.per_naixedora)
          .sort((a, b) => a.numero - b.numero)
          .map(n => ({ numero: n.numero, ...fmtAcum(n) })),
      })),
    per_incubadora: Array.from(perInc.values())
      .sort((a, b) => a.numero - b.numero)
      .map(i => ({
        numero: i.numero,
        model: i.model,
        ...fmtAcum(i),
        lots: Object.values(i.lots)
          .sort((a, b) => a.nom.localeCompare(b.nom))
          .map(l => ({ lot_id: l.lot_id, nom: l.nom, ...fmtAcum(l) })),
      })),
    per_naixedora: Array.from(perNaix.values())
      .sort((a, b) => a.numero - b.numero)
      .map(n => ({
        numero: n.numero,
        ...fmtAcum(n),
        lots: Object.values(n.lots)
          .sort((a, b) => a.nom.localeCompare(b.nom))
          .map(l => ({ lot_id: l.lot_id, nom: l.nom, ...fmtAcum(l) })),
      })),
  })
}
