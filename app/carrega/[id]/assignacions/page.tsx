'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { suggerirZonaMS, indexCalorCarro, fertilitatEstimada, calorFuturaCarro, type CarroTermic } from '@/lib/termico'

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

type ZonaMS = 'central' | 'paret' | 'pulsator'
type SubTipus = 'SS' | 'MSG' | 'MSP' | 'NAIX'
type Dia = 'dijous' | 'dilluns'

interface CarroEstoc {
  id: number
  posta: string
  quantitat_ous: number
  estat: string
  lots_reproductores: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: { granja: string; nom_informal: string | null }
  }
}

interface Incubadora {
  id: number
  numero: number
  model: string
  tipus: string
  capacitat_carros: number
}

interface AssignacioActual {
  id: number
  num_carro_full: number
  posicio: number | null
  zona: ZonaMS | null
  incubadora_id: number
  carros_estoc: {
    id: number
    posta: string
    quantitat_ous: number
    lots_reproductores: {
      id: number
      data_naixement: string
      estirp: string | null
      granges_reproductores: { granja: string; nom_informal: string | null }
    }
  }
  incubadores: { numero: number; model: string; tipus: string }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  assignacions: AssignacioActual[]
  comandes: { quantitat_pollets: number | null; quantitat_ous_maquila: number | null; tipus: string }[]
}

interface CarroInst {
  assignacio_id: number
  num_carro_full: number
  full_id: number
  num_carrega: number
  posicio: number | null
  zona: ZonaMS | null
  estirp: string | null
  // Camps per a la capa tèrmica (venenen de estat_instalacions())
  quantitat_ous: number
  setmanes_lot: number | null
  dia_incubacio: number | null
  // Data de transferència planificada del full al qual pertany el carro
  data_transferencia_full: string | null
}

interface IncInst {
  id: number
  numero: number
  tipus: string
  capacitat: number
  carros: CarroInst[]
}

interface EstatInst {
  incubadores: IncInst[]
  naixedores: { id: number; numero: number; capacitat: number; carros: { num_carro_full: number; estirp: string | null }[] }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Mapatge SS posicio (1-24) a la cel·la visual (col 0-5, row 0-3, on row 0 = porta a baix).
// Numeració real: paret esq 1-4, paret dre 5-8, central esq 9-12, central dre 13-16,
// pulsator esq 17-20, pulsator dre 21-24.
// Columnes visuals: 0=paret esq, 1=central esq, 2=pulsator esq, 3=pulsator dre, 4=central dre, 5=paret dre
function ssPosToCell(pos: number): { col: number; row: number } {
  const grup = Math.floor((pos - 1) / 4)
  const row = (pos - 1) % 4
  const grupAColumna = [0, 5, 1, 4, 2, 3]
  return { col: grupAColumna[grup], row }
}

const MS_ZONES_ESQ: ZonaMS[] = ['paret', 'central', 'pulsator']
const MS_ZONES_DRE: ZonaMS[] = ['pulsator', 'central', 'paret']

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function subtipus(tipus: string, cap: number): SubTipus {
  if (tipus === 'Singlestage') return 'SS'
  if (tipus === 'Multistage' && cap === 24) return 'MSG'
  if (tipus === 'Multistage' && cap === 12) return 'MSP'
  return 'NAIX'
}

function diaDeFull(dataIso: string): Dia | null {
  const d = new Date(dataIso + 'T12:00:00').getDay()
  if (d === 1) return 'dilluns'
  if (d === 4) return 'dijous'
  return null
}

function nomCarroCurt(c: CarroEstoc | AssignacioActual['carros_estoc']): string {
  const lot = c.lots_reproductores
  return lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
}

function keyCell(incId: number, pos: number, zona: ZonaMS | null): string {
  return `${incId}|${pos}|${zona || '-'}`
}

function diesEstoc(posta: string, carrega: string): number {
  const p = new Date(posta + 'T00:00:00')
  const c = new Date(carrega + 'T00:00:00')
  return Math.floor((c.getTime() - p.getTime()) / 86400000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers tèrmics
// ─────────────────────────────────────────────────────────────────────────────

// Setmanes de vida del lot a partir de la data de naixement (ISO)
function setmanesLot(dataNaixement: string): number {
  const ms = Date.now() - new Date(dataNaixement + 'T00:00:00').getTime()
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000))
}

// Optimitza les zones (central/paret/pulsator) dels carros MS del full actual
// deixant les Singlestage i els carros d'altres fulls intactes.
// Algoritme greedy: per cada MS, tria la zona que minimitza el desequilibri
// projectat a 21 dies, processant els carros en ordre de calor potencial DESC.
function optimitzarZonesTermiques(
  colocatsActuals: Map<number, { incId: number; pos: number; zona: ZonaMS | null }>,
  carrosLotParam: CarroEstoc[],
  estatInstParam: EstatInst,
  incsById: Map<number, Incubadora>,
  assignacioIdsDelFull: Set<number>
): Map<number, { incId: number; pos: number; zona: ZonaMS | null }> {
  const resultat = new Map(colocatsActuals)

  // Incubadores MS que tenen carros del full actual
  const msIncIds = new Set<number>()
  colocatsActuals.forEach((p) => {
    const inc = incsById.get(p.incId)
    if (inc && inc.tipus === 'Multistage') msIncIds.add(p.incId)
  })

  msIncIds.forEach((incId) => {
    const inc = incsById.get(incId)
    if (!inc) return
    const maxPerZona = inc.capacitat_carros === 24 ? 8 : 4

    // Estat fixe: carros d'altres fulls ja a la MS (excloem els del full actual)
    const incInst = estatInstParam.incubadores.find((i) => i.id === incId)
    const carrosFixos: CarroTermic[] = []
    if (incInst) {
      for (const c of incInst.carros) {
        if (assignacioIdsDelFull.has(c.assignacio_id)) continue
        if (!c.zona || c.dia_incubacio === null || c.setmanes_lot === null) continue
        carrosFixos.push({
          zona: c.zona as CarroTermic['zona'],
          quantitat_ous: c.quantitat_ous,
          setmanes_lot: c.setmanes_lot,
          dia_incubacio: c.dia_incubacio,
        })
      }
    }

    // Carros del full actual en aquesta MS
    const carrosDeFull: { carroId: number; carro: CarroEstoc }[] = []
    colocatsActuals.forEach((p, carroId) => {
      if (p.incId !== incId) return
      const carro = carrosLotParam.find((c) => c.id === carroId)
      if (carro) carrosDeFull.push({ carroId, carro })
    })

    // Ordenar per calor potencial pic (dia 18) DESC → els carros "calents" primer
    carrosDeFull.sort((a, b) => {
      const sa = setmanesLot(a.carro.lots_reproductores.data_naixement)
      const sb = setmanesLot(b.carro.lots_reproductores.data_naixement)
      return indexCalorCarro(b.carro.quantitat_ous, sb, 18)
           - indexCalorCarro(a.carro.quantitat_ous, sa, 18)
    })

    // Assignació greedy
    const carrosVirtuals: CarroTermic[] = [...carrosFixos]
    for (const { carroId, carro } of carrosDeFull) {
      const setm = setmanesLot(carro.lots_reproductores.data_naixement)
      // Zones amb capacitat disponible
      const comptes: Record<ZonaMS, number> = { central: 0, paret: 0, pulsator: 0 }
      carrosVirtuals.forEach((cv) => { comptes[cv.zona]++ })
      const zonesDisp = (['central', 'paret', 'pulsator'] as ZonaMS[]).filter(
        (z) => comptes[z] < maxPerZona
      )
      if (zonesDisp.length === 0) continue
      const zona = suggerirZonaMS(carrosVirtuals, { quantitat_ous: carro.quantitat_ous, setmanes_lot: setm }, zonesDisp)
      const p = resultat.get(carroId)!
      resultat.set(carroId, { ...p, zona })
      carrosVirtuals.push({ zona, quantitat_ous: carro.quantitat_ous, setmanes_lot: setm, dia_incubacio: 0 })
    }
  })

  return resultat
}

// ─────────────────────────────────────────────────────────────────────────────
// Algoritme pre-suggerit (v1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Distribueix els carros encara no col·locats entre les cel·les marcades pel
// l'usuari (seleccionades en groc), aplicant aquestes regles:
//
//   1. Agrupar carros per (granja, estirp, posta). Els grups més grans van primer.
//   2. Dins d'una incubadora SS, prioritzar columnes pulsator/central abans que paret.
//   3. Carros del mateix grup tendeixen a anar a la mateixa columna (i incubadora).
//   4. Costat esquerra primer.
//
// Retorna un Map<carro_id, {incId, posicio, zona}>.

interface CellaSel {
  incId: number
  pos: number
  zona: ZonaMS | null
  // Per a SS, derivem (col, row) i una "prioritat de columna":
  // 0 = pulsator (esq), 1 = central (esq), 2 = paret (esq), 3 = paret (dre), 4 = central (dre), 5 = pulsator (dre)
  // Volem pulsator/central abans que paret → ordenar per prioritat ASC.
  prioritat: number
  costat: 'esq' | 'dre' | 'cap'
  columna: number // identificador de columna física (per agrupar lots iguals)
}

function calcularCella(c: CellaSel, sub: SubTipus): CellaSel {
  return c
}

function ordreCellesSS(c: CellaSel): number {
  // Pulsator(esq)=0, Central(esq)=1, Paret(esq)=2, Paret(dre)=3, Central(dre)=4, Pulsator(dre)=5
  // Per prioritzar pulsator+central abans que paret:
  // Pulsator esq, Central esq, Pulsator dre, Central dre, Paret esq, Paret dre
  // → ordre desitjat: 0, 1, 5, 4, 2, 3
  const mapa: Record<number, number> = { 0: 0, 1: 1, 5: 2, 4: 3, 2: 4, 3: 5 }
  return mapa[c.prioritat] ?? 99
}

function preSuggerit(
  carrosPendents: CarroEstoc[],
  cellesSel: CellaSel[],
  incsById: Map<number, Incubadora>
): Map<number, { incId: number; pos: number; zona: ZonaMS | null }> {
  const resultat = new Map<number, { incId: number; pos: number; zona: ZonaMS | null }>()
  if (carrosPendents.length === 0 || cellesSel.length === 0) return resultat

  // 1. Agrupar carros per (granja+estirp+posta)
  const grupsCarros = new Map<string, CarroEstoc[]>()
  for (const c of carrosPendents) {
    const key = `${c.lots_reproductores.granges_reproductores.granja}|${c.lots_reproductores.estirp || ''}|${c.posta}`
    if (!grupsCarros.has(key)) grupsCarros.set(key, [])
    grupsCarros.get(key)!.push(c)
  }
  // Ordenar grups: els més grans primer
  const grupsOrd = Array.from(grupsCarros.entries()).sort((a, b) => b[1].length - a[1].length)

  // 2. Agrupar cel·les per (incubadora, columna)
  // Per SS, "columna" = grupAColumna a ssPosToCell. Per MS, "columna" = (incId, zona, costat).
  const grupsCelles = new Map<string, CellaSel[]>()
  for (const cel of cellesSel) {
    const inc = incsById.get(cel.incId)
    if (!inc) continue
    const sub = subtipus(inc.tipus, inc.capacitat_carros)
    let groupKey: string
    if (sub === 'SS') {
      const { col } = ssPosToCell(cel.pos)
      groupKey = `${cel.incId}|SS|${col}`
    } else {
      // MS: zona + costat (esq=pos 1-4 a MSG / 1-2 MSP, dre=la resta)
      const costat = (sub === 'MSG' ? (cel.pos <= 4 ? 'esq' : 'dre') : (cel.pos <= 2 ? 'esq' : 'dre'))
      groupKey = `${cel.incId}|MS|${cel.zona}|${costat}`
    }
    if (!grupsCelles.has(groupKey)) grupsCelles.set(groupKey, [])
    grupsCelles.get(groupKey)!.push(cel)
  }

  // 3. Ordenar les columnes (grups de cel·les) per prioritat
  // SS: pulsator + central abans que paret, esquerra primer
  // MS: central > paret > pulsator (els nous sempre van a central per defecte;
  //     si l'usuari ha seleccionat paret/pulsator, conscient és)
  const grupsCellesOrd = Array.from(grupsCelles.entries()).sort((a, b) => {
    const [keyA, cellsA] = a
    const [keyB, cellsB] = b
    const tipusA = keyA.split('|')[1]
    const tipusB = keyB.split('|')[1]
    if (tipusA !== tipusB) return tipusA === 'SS' ? -1 : 1
    if (tipusA === 'SS') {
      const colA = parseInt(keyA.split('|')[2])
      const colB = parseInt(keyB.split('|')[2])
      // ordreCellesSS s'aplica al prioritat de la primera cel·la (que té la mateixa col)
      const ordA = ordreCellesSS(cellsA[0])
      const ordB = ordreCellesSS(cellsB[0])
      if (ordA !== ordB) return ordA - ordB
      return colA - colB
    } else {
      // MS: central abans, després paret, després pulsator. Esquerra abans que dreta.
      const partsA = keyA.split('|') // incId, MS, zona, costat
      const partsB = keyB.split('|')
      const ordZona: Record<string, number> = { central: 0, paret: 1, pulsator: 2 }
      const za = ordZona[partsA[2]] ?? 3
      const zb = ordZona[partsB[2]] ?? 3
      if (za !== zb) return za - zb
      if (partsA[3] !== partsB[3]) return partsA[3] === 'esq' ? -1 : 1
      return 0
    }
  })

  // 4. Ordenar cel·les dins cada columna: SS per fila ASC (porta primer);
  //    MS per posicio ASC.
  for (const [, cells] of grupsCellesOrd) {
    cells.sort((x, y) => x.pos - y.pos)
  }

  // 5. Aplanar cel·les en l'ordre final
  const ordreCelles: CellaSel[] = []
  for (const [, cells] of grupsCellesOrd) ordreCelles.push(...cells)

  // 6. Aplanar carros: grups grans primer, dins del grup en l'ordre de la llista
  const ordreCarros: CarroEstoc[] = []
  for (const [, carros] of grupsOrd) ordreCarros.push(...carros)

  // 7. Assignar 1-a-1
  const n = Math.min(ordreCarros.length, ordreCelles.length)
  for (let i = 0; i < n; i++) {
    const c = ordreCarros[i]
    const cel = ordreCelles[i]
    resultat.set(c.id, { incId: cel.incId, pos: cel.pos, zona: cel.zona })
  }
  return resultat
}

// ─────────────────────────────────────────────────────────────────────────────
// Algorisme de suggeriment complet (v2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Regles implementades:
//   MS  · Tots els nous carros van al passadís central (única zona buida).
//       · Ompliment lineal esq→dre. Lots consecutius (garantit per l'ordre del pool).
//       · Equilibri tèrmic ESQ/DRE: prova esq-first vs dre-first; tria la millor.
//       · Considera tots els carros de la màquina (paret+pulsator existents).
//   SS  · Del pool, els K carros amb més setmanes_lot van a SS.
//       · Menys calor futura → posicions centrals (9-16); més calor → paret/pulsator.
//   Pool· Ordenat per posta ASC (dies_estoc DESC), agrupat per lot (lot_id).
//       · Selecció fins [comanda_pollets−500, comanda_pollets+4000].
//       · Si la comanda és de maquila (tipus='maquila'), s'usen tots els carros.

const ECLOSIO_EST = 0.88

function suggerirAssignacioCompleta(
  carrosPendents: CarroEstoc[],
  full: Full,
  incs: Incubadora[],
  estatInstParam: EstatInst,
  diaCarrega: Dia,
  lliureAviatPerCellaParam: Map<string, { diesFins: number; num_carro_full: number; num_carrega: number; data_transferencia_full: string }>,
  carroPerCellaParam: Map<string, number>,
  incsFiltrades: Set<number> = new Set()
): Map<number, { incId: number; pos: number; zona: ZonaMS | null }> {
  const resultat = new Map<number, { incId: number; pos: number; zona: ZonaMS | null }>()
  if (carrosPendents.length === 0) return resultat

  const incsById = new Map(incs.map(i => [i.id, i]))
  const instById = new Map(estatInstParam.incubadores.map(ii => [ii.id, ii]))
  const incByNumero = new Map(incs.map(i => [i.numero, i]))

  // ── 1. Construir pool ───────────────────────────────────────────────────
  // Comanda pollets propis
  const comandaPollets = full.comandes
    .filter(c => c.tipus !== 'maquila' && c.quantitat_pollets !== null && c.quantitat_pollets > 0)
    .reduce((s, c) => s + (c.quantitat_pollets ?? 0), 0)

  // Ordenar: primer agrupar per lot (per garantir lots consecutius a les MS),
  // lots ordenats per la seva posta més antiga ASC (dies d'estoc DESC).
  // Dins de cada lot, carros ordenats per posta ASC.
  const carrosOrd = (() => {
    const byLot = new Map<number, CarroEstoc[]>()
    for (const c of carrosPendents) {
      const lid = c.lots_reproductores.id
      if (!byLot.has(lid)) byLot.set(lid, [])
      byLot.get(lid)!.push(c)
    }
    byLot.forEach(cs => cs.sort((a, b) =>
      new Date(a.posta + 'T00:00:00').getTime() - new Date(b.posta + 'T00:00:00').getTime()
    ))
    const lotsOrds = Array.from(byLot.values()).sort((a, b) =>
      new Date(a[0].posta + 'T00:00:00').getTime() - new Date(b[0].posta + 'T00:00:00').getTime()
    )
    return lotsOrds.flat()
  })()

  let pool: CarroEstoc[]
  if (comandaPollets > 0) {
    let polletsPrev = 0
    pool = []
    for (const c of carrosOrd) {
      const setm = setmanesLot(c.lots_reproductores.data_naixement)
      const pred = c.quantitat_ous * fertilitatEstimada(setm) * ECLOSIO_EST
      // Si ja tenim prou pollets i afegir aquest carro passaria del màxim, parem
      if (polletsPrev >= comandaPollets - 500 && polletsPrev + pred > comandaPollets + 4000) break
      pool.push(c)
      polletsPrev += pred
    }
    if (polletsPrev < comandaPollets - 500) pool = carrosOrd
  } else {
    pool = carrosOrd
  }

  // ── 2. Helper: slots disponibles per incubadora ─────────────────────────
  function slotsDisponibles(incInst: IncInst): { pos: number; zona: ZonaMS | null; costat: 'esq' | 'dre' | 'cap' }[] {
    const inc = incsById.get(incInst.id)
    if (!inc) return []
    const sub = subtipus(inc.tipus, inc.capacitat_carros)
    const ocupatsInst = new Set(
      incInst.carros.filter(c => c.posicio !== null).map(c => `${c.posicio}|${c.zona ?? '-'}`)
    )
    function esDisp(pos: number, zona: ZonaMS | null): boolean {
      const k = keyCell(incInst.id, pos, zona)
      const ocupatInst = ocupatsInst.has(`${pos}|${zona ?? '-'}`)
      const ocupatFull = carroPerCellaParam.has(k)
      const llAviat = lliureAviatPerCellaParam.has(k)
      return (!ocupatInst && !ocupatFull) || llAviat
    }
    const slots: { pos: number; zona: ZonaMS | null; costat: 'esq' | 'dre' | 'cap' }[] = []
    if (sub === 'SS') {
      for (let p = 1; p <= 24; p++) {
        if (!esDisp(p, null)) continue
        const { col } = ssPosToCell(p)
        slots.push({ pos: p, zona: null, costat: col <= 2 ? 'esq' : 'dre' })
      }
    } else {
      const maxEsq = sub === 'MSG' ? 4 : 2
      const maxDre = sub === 'MSG' ? 8 : 4
      for (let p = 1; p <= maxEsq; p++) if (esDisp(p, 'central')) slots.push({ pos: p, zona: 'central', costat: 'esq' })
      for (let p = maxEsq + 1; p <= maxDre; p++) if (esDisp(p, 'central')) slots.push({ pos: p, zona: 'central', costat: 'dre' })
    }
    return slots
  }

  // ── 3a. Helper: un lot consecutiu des de la posició `start` fins a `maxN` ─
  function nextLotSlice(arr: CarroEstoc[], start: number, maxN: number): CarroEstoc[] {
    if (start >= arr.length || maxN === 0) return []
    const lotId = arr[start].lots_reproductores.id
    const res: CarroEstoc[] = []
    for (let i = start; i < arr.length && res.length < maxN; i++) {
      if (arr[i].lots_reproductores.id !== lotId) break
      res.push(arr[i])
    }
    return res
  }

  // ── 3b. Helper: calor futura d'un costat MS (existents + nous) ──────────
  function calorCostatMS(
    incInst: IncInst,
    sub: SubTipus,
    costat: 'esq' | 'dre',
    novsCarros: { ous: number; setm: number }[]
  ): number {
    const [minP, maxP] = costat === 'esq'
      ? (sub === 'MSG' ? [1, 4] : [1, 2])
      : (sub === 'MSG' ? [5, 8] : [3, 4])
    let calor = 0
    for (const c of incInst.carros) {
      if (c.posicio === null || c.dia_incubacio === null || c.setmanes_lot === null) continue
      if (c.posicio < minP || c.posicio > maxP) continue
      calor += calorFuturaCarro(c.quantitat_ous, c.setmanes_lot, c.dia_incubacio)
    }
    for (const nc of novsCarros) calor += calorFuturaCarro(nc.ous, nc.setm, 0)
    return calor
  }

  // ── 4. Ordre d'incubadores per dia ──────────────────────────────────────
  let ordreIncs: number[]
  if (diaCarrega === 'dijous') {
    const ssInsts = estatInstParam.incubadores
      .filter(ii => { const inc = incsById.get(ii.id); return inc && subtipus(inc.tipus, inc.capacitat_carros) === 'SS' })
      .sort((a, b) => slotsDisponibles(b).length - slotsDisponibles(a).length)
    const ssNums = ssInsts.map(ii => incsById.get(ii.id)!.numero)
    ordreIncs = [...ssNums, 1, 2, 8]
  } else {
    ordreIncs = [3, 4, 5, 6, 9, 10, 8]
  }

  // ── 5. Separar carros per SS i MS (dijous) ──────────────────────────────
  let poolSS: CarroEstoc[] = []
  let poolMS: CarroEstoc[] = [...pool]

  if (diaCarrega === 'dijous') {
    // Trobar SS disponible i quants slots té
    const ssNum = ordreIncs.find(n => {
      const inc = incByNumero.get(n)
      if (!inc || subtipus(inc.tipus, inc.capacitat_carros) !== 'SS') return false
      const inst = instById.get(inc.id)
      return inst && slotsDisponibles(inst).length > 0
    })
    if (ssNum !== undefined) {
      const ssInc = incByNumero.get(ssNum)!
      const ssInst = instById.get(ssInc.id)!
      const nSlotsSS = slotsDisponibles(ssInst).length
      // Del pool, agafar els K carros amb més setmanes_lot per a SS
      const poolOrdenatPerSetm = [...pool].sort((a, b) =>
        setmanesLot(b.lots_reproductores.data_naixement) - setmanesLot(a.lots_reproductores.data_naixement)
      )
      poolSS = poolOrdenatPerSetm.slice(0, nSlotsSS)
      const idsSS = new Set(poolSS.map(c => c.id))
      poolMS = pool.filter(c => !idsSS.has(c.id))
    }
  }

  // ── 6. Assignació ────────────────────────────────────────────────────────
  // Si l'usuari ha pre-seleccionat incubadores, filtrar ordreIncs per elles
  const ordreIncsFiltrat = incsFiltrades.size > 0
    ? ordreIncs.filter(n => {
        const inc = incByNumero.get(n)
        return inc && incsFiltrades.has(inc.id)
      })
    : ordreIncs

  const assignats = new Set<number>()

  for (const num of ordreIncsFiltrat) {
    const inc = incByNumero.get(num)
    if (!inc) continue
    const incInst = instById.get(inc.id)
    if (!incInst) continue
    const sub = subtipus(inc.tipus, inc.capacitat_carros)
    const slots = slotsDisponibles(incInst)
    if (slots.length === 0) continue

    if (sub === 'SS') {
      // Carros per SS: els preseleccionats (poolSS), menys calor → central
      const carrosAquiSS = poolSS.filter(c => !assignats.has(c.id))
      if (carrosAquiSS.length === 0) continue

      // Calcular calor futura per cada carro
      const ambCalor = carrosAquiSS.map(c => {
        const setm = setmanesLot(c.lots_reproductores.data_naixement)
        return { c, calor: calorFuturaCarro(c.quantitat_ous, setm, 0) }
      })

      // Slots SS ordenats: central (9-16) primer → paret (1-8) → pulsator (17-24)
      const slotsSSOrds = [...slots].sort((a, b) => {
        const ord = (p: number) => p >= 9 && p <= 16 ? 0 : p >= 1 && p <= 8 ? 1 : 2
        if (ord(a.pos) !== ord(b.pos)) return ord(a.pos) - ord(b.pos)
        // Dins la mateixa zona: alternar esq/dre (parelles)
        const costatOrd = (p: number) => {
          const { col } = ssPosToCell(p)
          return col <= 2 ? 0 : 1
        }
        if (costatOrd(a.pos) !== costatOrd(b.pos)) return costatOrd(a.pos) - costatOrd(b.pos)
        return a.pos - b.pos
      })

      // Carros de menys calor → posicions centrals (menys calor)
      // Assignar parelles: 1 esq + 1 dre per mantenir equilibri
      ambCalor.sort((a, b) => a.calor - b.calor)
      const n = Math.min(ambCalor.length, slotsSSOrds.length)
      for (let i = 0; i < n; i++) {
        const carro = ambCalor[i].c
        const slot = slotsSSOrds[i]
        resultat.set(carro.id, { incId: incInst.id, pos: slot.pos, zona: slot.zona })
        assignats.add(carro.id)
      }

    } else {
      // MS: un sol lot per costat, equilibri ESQ/DRE
      const carrosAquiMS = poolMS.filter(c => !assignats.has(c.id))
      if (carrosAquiMS.length === 0) continue

      const slotsEsq = slots.filter(s => s.costat === 'esq').sort((a, b) => a.pos - b.pos)
      const slotsDre = slots.filter(s => s.costat === 'dre').sort((a, b) => a.pos - b.pos)
      if (slotsEsq.length === 0 && slotsDre.length === 0) continue

      // Opció A: primer lot → esq (fins a omplir o acabar lot), continuació → dre
      const esqA = nextLotSlice(carrosAquiMS, 0, slotsEsq.length)
      const dreA = nextLotSlice(carrosAquiMS, esqA.length, slotsDre.length)
      // Opció B: primer lot → dre, continuació → esq
      const dreB = nextLotSlice(carrosAquiMS, 0, slotsDre.length)
      const esqB = nextLotSlice(carrosAquiMS, dreB.length, slotsEsq.length)

      const toNovs = (cs: CarroEstoc[]) => cs.map(c => ({ ous: c.quantitat_ous, setm: setmanesLot(c.lots_reproductores.data_naixement) }))
      const deseqA = Math.abs(calorCostatMS(incInst, sub, 'esq', toNovs(esqA)) - calorCostatMS(incInst, sub, 'dre', toNovs(dreA)))
      const deseqB = Math.abs(calorCostatMS(incInst, sub, 'esq', toNovs(esqB)) - calorCostatMS(incInst, sub, 'dre', toNovs(dreB)))

      const [esqFinal, dreFinal] = deseqA <= deseqB ? [esqA, dreA] : [esqB, dreB]

      for (let i = 0; i < esqFinal.length && i < slotsEsq.length; i++) {
        resultat.set(esqFinal[i].id, { incId: incInst.id, pos: slotsEsq[i].pos, zona: slotsEsq[i].zona })
        assignats.add(esqFinal[i].id)
      }
      for (let i = 0; i < dreFinal.length && i < slotsDre.length; i++) {
        resultat.set(dreFinal[i].id, { incId: incInst.id, pos: slotsDre[i].pos, zona: slotsDre[i].zona })
        assignats.add(dreFinal[i].id)
      }
    }
  }

  return resultat
}

// ─────────────────────────────────────────────────────────────────────────────
// Component principal
// ─────────────────────────────────────────────────────────────────────────────

export default function Planificacio() {
  const params = useParams()
  const router = useRouter()

  const [full, setFull] = useState<Full | null>(null)
  const [disponibles, setDisponibles] = useState<CarroEstoc[]>([])
  const [incs, setIncs] = useState<Incubadora[]>([])
  const [estatInst, setEstatInst] = useState<EstatInst | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [guardant, setGuardant] = useState(false)
  const [resultatGuardar, setResultatGuardar] = useState<string>('')

  // Mapa: carro_id → posició planificada (incId+posicio+zona)
  const [colocats, setColocats] = useState<Map<number, { incId: number; pos: number; zona: ZonaMS | null }>>(new Map())
  // Set de claus 'incId|pos|zona' marcades com a destí del pre-suggerit
  const [seleccionades, setSeleccionades] = useState<Set<string>>(new Set())

  const [dia, setDia] = useState<Dia>('dijous')
  const [mspOrdre, setMspOrdre] = useState<number[]>([8, 9, 10])
  const [mostrarProjectat, setMostrarProjectat] = useState(true)
  // Pre-selecció d'incubadores per al suggeriment (buit = totes)
  const [incsFiltrades, setIncsFiltrades] = useState<Set<number>>(new Set())

  function toggleIncFiltrada(incId: number) {
    setIncsFiltrades(prev => {
      const s = new Set(prev)
      if (s.has(incId)) s.delete(incId)
      else s.add(incId)
      return s
    })
  }

  // ── Càrrega inicial
  const carregarDades = useCallback(async () => {
    if (!params.id) return
    setLoading(true)
    try {
      const [fullRes, carrosRes, incRes, instRes] = await Promise.all([
        fetch(`/api/carrega/${params.id}`).then(r => r.json()),
        fetch('/api/carros').then(r => r.json()),
        fetch('/api/incubadores').then(r => r.json()),
        fetch('/api/instalacions').then(r => r.json()),
      ])
      setFull(fullRes)
      setDisponibles(Array.isArray(carrosRes) ? carrosRes : [])
      setIncs(Array.isArray(incRes) ? incRes : [])
      setEstatInst(instRes)

      // Inicialitzar el mapa de col·locats amb les assignacions existents del full
      const mapaInicial = new Map<number, { incId: number; pos: number; zona: ZonaMS | null }>()
      if (fullRes && Array.isArray(fullRes.assignacions)) {
        for (const a of fullRes.assignacions) {
          if (a.posicio === null || a.posicio === undefined) continue
          mapaInicial.set(a.carros_estoc.id, {
            incId: a.incubadora_id,
            pos: a.posicio,
            zona: a.zona,
          })
        }
      }
      setColocats(mapaInicial)
      setSeleccionades(new Set())

      // Inferir dia
      if (fullRes?.carrega) {
        const d = diaDeFull(fullRes.carrega)
        if (d) setDia(d)
      }
    } catch (e) {
      setErrorMsg('Error carregant dades: ' + String(e))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  // ── Derivacions
  const incsById = useMemo(() => new Map(incs.map(i => [i.id, i])), [incs])

  // Carros que es poden col·locar: disponibles + els assignats al full
  // (perquè si tornes a la pàgina i en treus algun, ha de tornar a la safata)
  const carrosLot = useMemo<CarroEstoc[]>(() => {
    const ja: Map<number, CarroEstoc> = new Map()
    for (const c of disponibles) ja.set(c.id, c)
    if (full) {
      for (const a of full.assignacions) {
        const ce = a.carros_estoc
        if (!ja.has(ce.id)) {
          ja.set(ce.id, {
            id: ce.id,
            posta: ce.posta,
            quantitat_ous: ce.quantitat_ous,
            estat: 'Assignat',
            lots_reproductores: ce.lots_reproductores,
          } as CarroEstoc)
        }
      }
    }
    return Array.from(ja.values())
  }, [disponibles, full])

  // Carros que encara NO estan col·locats al mapa
  const carrosPendents = useMemo<CarroEstoc[]>(() => {
    return carrosLot.filter(c => !colocats.has(c.id))
  }, [carrosLot, colocats])

  // Map de cel·la → carro_id col·locat
  const carroPerCella = useMemo(() => {
    const m = new Map<string, number>()
    colocats.forEach((p, cid) => {
      m.set(keyCell(p.incId, p.pos, p.zona), cid)
    })
    return m
  }, [colocats])

  // Té carros MS col·locats al full actual?
  const hiHaMsColocats = useMemo(() => {
    let found = false
    colocats.forEach((p) => {
      const inc = incsById.get(p.incId)
      if (inc && inc.tipus === 'Multistage') found = true
    })
    return found
  }, [colocats, incsById])

  // Ocupació "altres fulls" (per pintar de gris a la cel·la)
  const ocupatsAltresFullsPerCella = useMemo(() => {
    const m = new Map<string, { num_carro_full: number; num_carrega: number; estirp: string | null; data_transferencia_full: string | null }>()
    if (!estatInst || !full) return m
    for (const inc of estatInst.incubadores) {
      for (const c of inc.carros) {
        if (c.posicio === null || c.posicio === undefined) continue
        // Si aquest carro és del full actual, no compta com a "altres fulls"
        const esDelFullActual = full.assignacions.some(a => a.id === c.assignacio_id)
        if (esDelFullActual) continue
        m.set(keyCell(inc.id, c.posicio, c.zona), {
          num_carro_full: c.num_carro_full,
          num_carrega: c.num_carrega,
          estirp: c.estirp,
          data_transferencia_full: c.data_transferencia_full ?? null,
        })
      }
    }
    return m
  }, [estatInst, full])

  // Subconjunt d'ocupatsAltresFullsPerCella on la transferència és <= data d'entrada del full actual.
  // Aquests slots estaran lliures quan entrin els carros nous → es poden seleccionar/assignar.
  // ROTACIÓ MS: quan un carro del pulsator (~14d) transfereix, el carro del central es desplaça
  // cap al pulsator i el passadís central queda buit. Per tant remapegem pulsator → central.
  const lliureAviatPerCella = useMemo(() => {
    const m = new Map<string, { diesFins: number; num_carro_full: number; num_carrega: number; data_transferencia_full: string }>()
    if (!full) return m
    const dataCarrega = new Date(full.carrega + 'T00:00:00').getTime()
    const avui = new Date(); avui.setHours(0, 0, 0, 0)
    ocupatsAltresFullsPerCella.forEach((info, k) => {
      if (!info.data_transferencia_full) return
      const dataTrans = new Date(info.data_transferencia_full + 'T00:00:00').getTime()
      if (dataTrans <= dataCarrega) {
        const diesFins = Math.max(0, Math.floor((dataTrans - avui.getTime()) / 86400000))
        const parts = k.split('|')
        const targetKey = parts[2] === 'pulsator' ? `${parts[0]}|${parts[1]}|central` : k
        m.set(targetKey, { diesFins, num_carro_full: info.num_carro_full, num_carrega: info.num_carrega, data_transferencia_full: info.data_transferencia_full })
      }
    })
    return m
  }, [ocupatsAltresFullsPerCella, full])

  // ── Handlers de cel·la
  function toggleSeleccio(incId: number, pos: number, zona: ZonaMS | null) {
    const k = keyCell(incId, pos, zona)
    if (carroPerCella.has(k)) return
    if (ocupatsAltresFullsPerCella.has(k) && !lliureAviatPerCella.has(k)) return
    setSeleccionades(prev => {
      const s = new Set(prev)
      if (s.has(k)) s.delete(k); else s.add(k)
      return s
    })
  }

  function seleccionarLliuresInc(inc: Incubadora) {
    const sub = subtipus(inc.tipus, inc.capacitat_carros)
    const next = new Set(seleccionades)
    const afegir = (pos: number, zona: ZonaMS | null) => {
      const k = keyCell(inc.id, pos, zona)
      if (!carroPerCella.has(k) && (!ocupatsAltresFullsPerCella.has(k) || lliureAviatPerCella.has(k))) next.add(k)
    }
    if (sub === 'SS') {
      for (let p = 1; p <= 24; p++) afegir(p, null)
    } else if (sub === 'MSG') {
      for (const z of ['central', 'paret', 'pulsator'] as ZonaMS[]) for (let p = 1; p <= 8; p++) afegir(p, z)
    } else if (sub === 'MSP') {
      for (const z of ['central', 'paret', 'pulsator'] as ZonaMS[]) for (let p = 1; p <= 4; p++) afegir(p, z)
    }
    setSeleccionades(next)
  }

  function netejarSeleccio() {
    setSeleccionades(new Set())
  }

  function reiniciar() {
    if (!confirm('Reiniciar tota la planificació? Es perdrà el que has marcat i col·locat.')) return
    setColocats(new Map())
    setSeleccionades(new Set())
  }

  // ── Drag-and-drop
  function onDragStartCarro(e: React.DragEvent, carroId: number, origenCella: string | null) {
    e.dataTransfer.setData('carro_id', String(carroId))
    e.dataTransfer.setData('origen', origenCella || 'safata')
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOverCell(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDropCell(e: React.DragEvent, incId: number, pos: number, zona: ZonaMS | null) {
    e.preventDefault()
    const carroId = parseInt(e.dataTransfer.getData('carro_id'), 10)
    if (!Number.isFinite(carroId)) return
    const k = keyCell(incId, pos, zona)
    if (carroPerCella.has(k)) return
    if (ocupatsAltresFullsPerCella.has(k) && !lliureAviatPerCella.has(k)) return
    setColocats(prev => {
      const m = new Map(prev)
      m.set(carroId, { incId, pos, zona })
      return m
    })
    // Treure de seleccionades si hi era
    setSeleccionades(prev => {
      if (!prev.has(k)) return prev
      const s = new Set(prev); s.delete(k); return s
    })
  }

  function onDropSafata(e: React.DragEvent) {
    e.preventDefault()
    const carroId = parseInt(e.dataTransfer.getData('carro_id'), 10)
    if (!Number.isFinite(carroId)) return
    setColocats(prev => {
      const m = new Map(prev)
      m.delete(carroId)
      return m
    })
  }

  function clicarCarroColocat(carroId: number) {
    // Click sobre un carro col·locat → el treu i torna a la safata
    setColocats(prev => {
      const m = new Map(prev)
      m.delete(carroId)
      return m
    })
  }

  // ── Pre-suggerit
  function aplicarPreSuggerit() {
    if (!full || !estatInst) return
    const sug = suggerirAssignacioCompleta(
      carrosPendents,
      full,
      incs,
      estatInst,
      dia,
      lliureAviatPerCella,
      carroPerCella,
      incsFiltrades
    )
    if (sug.size === 0) return
    setColocats(prev => {
      const m = new Map(prev)
      sug.forEach((p, cid) => m.set(cid, p))
      return m
    })
    setSeleccionades(new Set())

    // Avís si pollets previstos per sota de la comanda
    const comandaPollets = full.comandes
      .filter(c => c.tipus !== 'maquila' && c.quantitat_pollets !== null && c.quantitat_pollets > 0)
      .reduce((s, c) => s + (c.quantitat_pollets ?? 0), 0)
    if (comandaPollets > 0) {
      const polletsSug = Array.from(sug.keys()).reduce((acc, cid) => {
        const c = carrosPendents.find(x => x.id === cid)
        if (!c) return acc
        const setm = setmanesLot(c.lots_reproductores.data_naixement)
        return acc + c.quantitat_ous * fertilitatEstimada(setm) * ECLOSIO_EST
      }, 0)
      if (polletsSug < comandaPollets - 500) {
        setErrorMsg(
          `⚠️ Atenció: els ${sug.size} carros assignats preveuen ~${Math.round(polletsSug).toLocaleString('ca')} pollets, ` +
          `per sota de la comanda (${comandaPollets.toLocaleString('ca')}). ` +
          `Necessites seleccionar més incubadores o afegir carros.`
        )
      }
    }
  }

  // ── Optimització tèrmica de zones MS
  function aplicarOptimitzacioTermica() {
    if (!estatInst || !full) return
    const msColocats = Array.from(colocats.entries()).filter(([, p]) => {
      const inc = incsById.get(p.incId)
      return inc && inc.tipus === 'Multistage'
    })
    if (msColocats.length === 0) return
    if (!confirm(
      `Redistribuirà les zones (central/paret/pulsator) de ${msColocats.length} carro(s) a les Multistage\nbasat en l'equilibri de calor projectat a 21 dies.\n\nVols continuar?`
    )) return

    const assignacioIdsDelFull = new Set<number>(
      full.assignacions.map((a) => a.id)
    )
    const novaColocats = optimitzarZonesTermiques(
      colocats,
      carrosLot,
      estatInst,
      incsById,
      assignacioIdsDelFull
    )
    setColocats(novaColocats)
  }

  // ── Guardar
  async function guardar() {
    if (!full) return
    if (colocats.size === 0) {
      if (!confirm('No hi ha cap carro col·locat. Vols guardar igualment (buidaria el full)?')) return
    }
    setGuardant(true)
    setErrorMsg('')
    setResultatGuardar('')
    try {
      const items = Array.from(colocats.entries()).map(([carro_id, p]) => ({
        carro_id,
        incubadora_id: p.incId,
        posicio: p.pos,
        zona: p.zona,
      }))
      const res = await fetch(`/api/carrega/${full.id}/planificacio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dia, msp_ordre: mspOrdre, items }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.orfes_bloquejades) {
          const llista = data.orfes_bloquejades.map((o: { num_carro_full: number; te_transferencia: boolean; te_vacuna: boolean }) =>
            `· Carro #${o.num_carro_full}: ${o.te_transferencia ? 'té transferència' : ''}${o.te_transferencia && o.te_vacuna ? ' i ' : ''}${o.te_vacuna ? 'té vacunes' : ''}`
          ).join('\n')
          setErrorMsg(`No es pot guardar:\n${data.error}\n\n${llista}`)
        } else {
          setErrorMsg(data.error || 'Error desconegut al guardar')
        }
        return
      }
      setResultatGuardar(`Guardat: ${data.inserits} nous, ${data.actualitzats} mogudes, ${data.esborrats} esborrades`)
      // Recarregar dades reals
      await carregarDades()
    } catch (e) {
      setErrorMsg('Error de xarxa: ' + String(e))
    } finally {
      setGuardant(false)
    }
  }

  // ── Render
  if (loading || !full) {
    return (
      <main style={{ padding: '1.5rem' }}>
        <p style={{ color: '#6b7280', textAlign: 'center' }}>Carregant...</p>
      </main>
    )
  }

  return (
    <main style={{ background: '#f7f7f5', minHeight: '100vh', paddingBottom: '90px' }}>
      <HeaderPlan full={full} dia={dia} setDia={setDia} pendents={carrosPendents.length} total={carrosLot.length} colocats={colocats.size} />

      {/* Toggle vista projectada */}
      {lliureAviatPerCella.size > 0 && (
        <div style={{ padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 8, background: mostrarProjectat ? '#f0fdf4' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: mostrarProjectat ? '#15803d' : '#6b7280', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={mostrarProjectat}
              onChange={e => setMostrarProjectat(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#16a34a', cursor: 'pointer' }}
            />
            Mostra estat post-transferència ({lliureAviatPerCella.size} slot{lliureAviatPerCella.size !== 1 ? 's' : ''} s&apos;alliberaran a temps)
          </label>
          {!mostrarProjectat && (
            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>
              Els slots en verd s&apos;alliberaran abans de la càrrega
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 290px', gap: '16px', padding: '16px 20px' }}>
        <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Singlestage */}
          <SeccioInc titol="Single Stage" badge="SS · cap 24"
            incs={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'SS')}
            children={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'SS').map(inc => (
              <IncubadoraSS key={inc.id} inc={inc}
                carrosLot={carrosLot}
                carroPerCella={carroPerCella}
                ocupatsAltresFulls={ocupatsAltresFullsPerCella}
                lliureAviatPerCella={lliureAviatPerCella}
                mostrarProjectat={mostrarProjectat}
                colocats={colocats}
                seleccionades={seleccionades}
                filtrada={incsFiltrades.has(inc.id)}
                anyFiltrada={incsFiltrades.size > 0}
                onToggleFiltrada={() => toggleIncFiltrada(inc.id)}
                onClicCella={(p) => toggleSeleccio(inc.id, p, null)}
                onSelLliures={() => seleccionarLliuresInc(inc)}
                onDragStartCarro={onDragStartCarro}
                onDragOverCell={onDragOverCell}
                onDropCell={(p) => (e: React.DragEvent) => onDropCell(e, inc.id, p, null)}
                onClicCarroColocat={clicarCarroColocat}
              />
            ))} />

          {/* MSG */}
          <SeccioInc titol="Multi Stage grans" badge="MS · cap 24 · 3 zones × 8 posicions"
            incs={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'MSG')}
            children={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'MSG').map(inc => (
              <IncubadoraMS key={inc.id} inc={inc} sub="MSG" carrosLot={carrosLot}
                carroPerCella={carroPerCella}
                ocupatsAltresFulls={ocupatsAltresFullsPerCella}
                lliureAviatPerCella={lliureAviatPerCella}
                mostrarProjectat={mostrarProjectat}
                colocats={colocats}
                seleccionades={seleccionades}
                filtrada={incsFiltrades.has(inc.id)}
                anyFiltrada={incsFiltrades.size > 0}
                onToggleFiltrada={() => toggleIncFiltrada(inc.id)}
                onClicCella={(p, z) => toggleSeleccio(inc.id, p, z)}
                onSelLliures={() => seleccionarLliuresInc(inc)}
                onDragStartCarro={onDragStartCarro}
                onDragOverCell={onDragOverCell}
                onDropCell={(p, z) => (e: React.DragEvent) => onDropCell(e, inc.id, p, z)}
                onClicCarroColocat={clicarCarroColocat}
              />
            ))} />

          {/* MSP */}
          <SeccioInc titol="Multi Stage petites" badge="MS · cap 12 · 3 zones × 4 posicions"
            incs={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'MSP')}
            extra={
              <OrdreMSP ordre={mspOrdre} onChange={setMspOrdre} />
            }
            children={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'MSP').map(inc => (
              <IncubadoraMS key={inc.id} inc={inc} sub="MSP" carrosLot={carrosLot}
                carroPerCella={carroPerCella}
                ocupatsAltresFulls={ocupatsAltresFullsPerCella}
                lliureAviatPerCella={lliureAviatPerCella}
                mostrarProjectat={mostrarProjectat}
                colocats={colocats}
                seleccionades={seleccionades}
                filtrada={incsFiltrades.has(inc.id)}
                anyFiltrada={incsFiltrades.size > 0}
                onToggleFiltrada={() => toggleIncFiltrada(inc.id)}
                onClicCella={(p, z) => toggleSeleccio(inc.id, p, z)}
                onSelLliures={() => seleccionarLliuresInc(inc)}
                onDragStartCarro={onDragStartCarro}
                onDragOverCell={onDragOverCell}
                onDropCell={(p, z) => (e: React.DragEvent) => onDropCell(e, inc.id, p, z)}
                onClicCarroColocat={clicarCarroColocat}
              />
            ))} />

          {/* Naixedores només lectura */}
          {estatInst && estatInst.naixedores.length > 0 && (
            <section style={cardSeccio()}>
              <h2 style={h2Seccio()}>Naixedores <span style={badgeStyle()}>només informatives</span></h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {estatInst.naixedores.map(n => (
                  <div key={n.id} style={cardInc()}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Naix {n.numero} <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 400 }}>{n.carros.length}/{n.capacitat}</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 60 }}>
                      {n.carros.length === 0
                        ? <div style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', padding: 8 }}>buida</div>
                        : n.carros.map((c, i) => <div key={i} style={chipNaix()}>#{c.num_carro_full}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: 8, padding: 12, alignSelf: 'start', position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}
               onDragOver={onDragOverCell}
               onDrop={onDropSafata}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Carros a col·locar</h3>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 10 }}>
            {carrosPendents.length} pendents · {colocats.size} col·locats
          </div>
          <Safata
            pendents={carrosPendents}
            onDragStartCarro={onDragStartCarro}
            full={full}
          />
          <div style={{ marginTop: 12, padding: 8, background: '#f3f4f6', borderRadius: 6, fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
            <b>Com va:</b><br />
            1) Clica cel·les lliures per seleccionar-les (groc).<br />
            2) Prem <i>Pre-suggerit</i> per repartir.<br />
            3) Arrossega per ajustar a mà.<br />
            4) Click sobre un carro col·locat per treure'l.
          </div>
        </aside>
      </div>

      {/* Errors i resultats */}
      {(errorMsg || resultatGuardar) && (
        <div style={{ position: 'fixed', bottom: 60, left: 20, right: 20, zIndex: 50 }}>
          {errorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#991b1b', padding: 10, borderRadius: 6, whiteSpace: 'pre-wrap', fontSize: 13, marginBottom: 6 }}>
              {errorMsg}
              <button onClick={() => setErrorMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 16 }}>×</button>
            </div>
          )}
          {resultatGuardar && (
            <div style={{ background: '#ecfdf5', border: '1px solid #34d399', color: '#065f46', padding: 10, borderRadius: 6, fontSize: 13 }}>
              {resultatGuardar}
              <button onClick={() => setResultatGuardar('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 16 }}>×</button>
            </div>
          )}
        </div>
      )}

      <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #d4d4d4', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -2px 8px rgba(0,0,0,0.04)', zIndex: 40 }}>
        <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8 }}>
          {carrosPendents.length > 0 && <>Queden <b style={{ color: '#1f2937' }}>{carrosPendents.length}</b> carros sense ubicar</>}
          {carrosPendents.length === 0 && colocats.size > 0 && <>Tots els carros estan col·locats ({colocats.size})</>}
          {' · '}<span>{seleccionades.size} cel·les seleccionades</span>
          {incsFiltrades.size > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
              ✓ {incsFiltrades.size} inc. seleccionades
              <button onClick={() => setIncsFiltrades(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', fontSize: 14, padding: '0 2px', lineHeight: 1 }} title="Esborra filtre">×</button>
            </span>
          )}
        </div>
        <div>
          <Link href={`/carrega/${full.id}`} style={{ ...btnStyle(false), textDecoration: 'none', marginRight: 8 }}>Tornar al full</Link>
          <button onClick={netejarSeleccio} style={btnStyle(false)}>Netejar selecció</button>
          <button onClick={reiniciar} style={btnStyle(false)}>Reiniciar</button>
          <button onClick={aplicarPreSuggerit} style={btnStyle(false)} disabled={carrosPendents.length === 0 || !full || !estatInst}>Suggereix assignació</button>
          <button
            onClick={aplicarOptimitzacioTermica}
            disabled={!hiHaMsColocats}
            title={hiHaMsColocats ? 'Redistribueix zones MS per equilibrar calor projectada a 21 dies' : 'Necessites carros MS col·locats primer'}
            style={{
              ...btnStyle(false),
              background: hiHaMsColocats ? '#ecfdf5' : undefined,
              border: hiHaMsColocats ? '1px solid #34d399' : undefined,
              color: hiHaMsColocats ? '#065f46' : undefined,
            }}
          >
            ⚡ Optimitzar zones (calor)
          </button>
          <button onClick={guardar} style={btnStyle(true)} disabled={guardant}>{guardant ? 'Guardant...' : 'Guardar planificació'}</button>
        </div>
      </footer>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function HeaderPlan({ full, dia, setDia, pendents, total, colocats }: { full: Full; dia: Dia; setDia: (d: Dia) => void; pendents: number; total: number; colocats: number }) {
  const diaInferit = diaDeFull(full.carrega)
  return (
    <header style={{ background: '#fff', borderBottom: '1px solid #d4d4d4', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 18 }}>Planificació full #{full.num_carrega}</h1>
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          Càrrega <b style={{ color: '#1f2937' }}>{full.carrega}</b> · {total} carros disponibles · {colocats} col·locats · {pendents} pendents
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#6b7280' }}>
          Patró del dia:&nbsp;
          <select value={dia} onChange={e => setDia(e.target.value as Dia)} style={{ padding: '4px 8px', fontSize: 13 }}>
            <option value="dijous">Dijous (SS · Inc 1-2 · MSP)</option>
            <option value="dilluns">Dilluns (Inc 3-6 · MSP)</option>
          </select>
          {diaInferit && diaInferit !== dia && (
            <span style={{ color: '#b45309', fontSize: 12, marginLeft: 8 }}>(el full és {diaInferit}!)</span>
          )}
        </label>
      </div>
    </header>
  )
}

function OrdreMSP({ ordre, onChange }: { ordre: number[]; onChange: (o: number[]) => void }) {
  function mou(idx: number, dir: -1 | 1) {
    const novaOrdre = [...ordre]
    const j = idx + dir
    if (j < 0 || j >= novaOrdre.length) return
    ;[novaOrdre[idx], novaOrdre[j]] = [novaOrdre[j], novaOrdre[idx]]
    onChange(novaOrdre)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
      Ordre MSP:
      {ordre.map((n, i) => (
        <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <button onClick={() => mou(i, -1)} disabled={i === 0} style={{ ...miniBtn(), padding: '0 4px' }}>◀</button>
          <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>{n}</span>
          <button onClick={() => mou(i, 1)} disabled={i === ordre.length - 1} style={{ ...miniBtn(), padding: '0 4px' }}>▶</button>
        </span>
      ))}
    </div>
  )
}

function Safata({ pendents, onDragStartCarro, full }: { pendents: CarroEstoc[]; onDragStartCarro: (e: React.DragEvent, id: number, origen: string | null) => void; full: Full }) {
  // Agrupar per lot (granja+estirp+posta)
  const grups: { key: string; nom: string; estirp: string | null; posta: string; carros: CarroEstoc[] }[] = []
  const map = new Map<string, { nom: string; estirp: string | null; posta: string; carros: CarroEstoc[] }>()
  for (const c of pendents) {
    const k = `${c.lots_reproductores.granges_reproductores.granja}|${c.lots_reproductores.estirp || ''}|${c.posta}`
    if (!map.has(k)) map.set(k, { nom: nomCarroCurt(c), estirp: c.lots_reproductores.estirp, posta: c.posta, carros: [] })
    map.get(k)!.carros.push(c)
  }
  map.forEach((v, k) => grups.push({ key: k, ...v }))
  grups.sort((a, b) => diesEstoc(b.posta, full.carrega) - diesEstoc(a.posta, full.carrega))

  return (
    <div>
      {grups.map(g => (
        <div key={g.key} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3, fontWeight: 600 }}>
            {g.nom}{g.estirp ? ` · ${g.estirp}` : ''} · posta {g.posta} · {g.carros.length} carro{g.carros.length !== 1 ? 's' : ''}
          </div>
          {g.carros.map(c => (
            <div key={c.id}
              draggable
              onDragStart={(e) => onDragStartCarro(e, c.id, null)}
              style={{ background: '#bfdbfe', border: '1px solid #2563eb', borderRadius: 6, padding: '6px 8px', marginBottom: 4, cursor: 'grab', fontSize: 12, lineHeight: 1.3, userSelect: 'none' }}>
              <div style={{ color: '#1e3a8a', fontSize: 11 }}>{c.quantitat_ous.toLocaleString('ca')} ous · estoc {diesEstoc(c.posta, full.carrega)}d</div>
            </div>
          ))}
        </div>
      ))}
      {pendents.length === 0 && <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: 12 }}>Cap carro pendent</div>}
    </div>
  )
}

function SeccioInc({ titol, badge, incs, children, extra }: { titol: string; badge: string; incs: Incubadora[]; children: React.ReactNode; extra?: React.ReactNode }) {
  if (incs.length === 0) return null
  return (
    <section style={cardSeccio()}>
      <h2 style={h2Seccio()}>
        {titol} <span style={badgeStyle()}>{badge}</span>
        {extra && <span style={{ marginLeft: 'auto' }}>{extra}</span>}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(incs.length, 3)}, 1fr)`, gap: 14 }}>
        {children}
      </div>
    </section>
  )
}

// ── Singlestage incubadora ────────────────────────────────────────────────

interface CellPropsCommon {
  carrosLot: CarroEstoc[]
  carroPerCella: Map<string, number>
  ocupatsAltresFulls: Map<string, { num_carro_full: number; num_carrega: number; estirp: string | null; data_transferencia_full: string | null }>
  lliureAviatPerCella: Map<string, { diesFins: number; num_carro_full: number; num_carrega: number; data_transferencia_full: string }>
  colocats: Map<number, { incId: number; pos: number; zona: ZonaMS | null }>
  seleccionades: Set<string>
  onSelLliures: () => void
  onDragStartCarro: (e: React.DragEvent, id: number, origen: string | null) => void
  onDragOverCell: (e: React.DragEvent) => void
  onClicCarroColocat: (id: number) => void
  mostrarProjectat: boolean
}

function IncubadoraSS({ inc, onClicCella, onDropCell, filtrada, anyFiltrada, onToggleFiltrada, ...p }: CellPropsCommon & {
  inc: Incubadora
  onClicCella: (pos: number) => void
  onDropCell: (pos: number) => (e: React.DragEvent) => void
  filtrada: boolean
  anyFiltrada: boolean
  onToggleFiltrada: () => void
}) {
  const ocupNous = Array.from(p.colocats.values()).filter(c => c.incId === inc.id).length
  const ocupAltres = Array.from(p.ocupatsAltresFulls.keys()).filter(k => k.startsWith(`${inc.id}|`)).length
  const exclosa = anyFiltrada && !filtrada
  return (
    <div style={{ ...cardInc(), outline: filtrada ? '2px solid #2563eb' : exclosa ? '1px solid #e5e7eb' : undefined, opacity: exclosa ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 13, gap: 4 }}>
        <button onClick={onToggleFiltrada} title={filtrada ? 'Exclou del suggeriment' : 'Inclou al suggeriment'} style={{ fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: filtrada ? '#2563eb' : '#1f2937', fontSize: 13 }}>
          {filtrada ? '✓ ' : ''}SS {inc.numero}
        </button>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 11 }}>{ocupNous + ocupAltres}/{inc.capacitat_carros}</span>
          <button onClick={p.onSelLliures} style={btnSelLliures()} title="Selecciona totes les cel·les lliures">+ sel. lliures</button>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 6px 1fr 1fr 1fr', gap: 3 }}>
        {['Paret esq', 'Central esq', 'Pulsator esq', '', 'Pulsator dre', 'Central dre', 'Paret dre'].map((h, i) => (
          <div key={i} style={{ gridColumn: i + 1, gridRow: 1, fontSize: 9, textAlign: 'center', color: '#6b7280' }}>{h}</div>
        ))}
        <div style={{ gridColumn: 4, gridRow: '2 / 6', background: '#1f2937', borderRadius: 1 }} />
        {Array.from({ length: 24 }, (_, i) => i + 1).map(pos => {
          const { col, row } = ssPosToCell(pos)
          const gridCol = col < 3 ? (col + 1) : (col + 2)
          const gridRow = 2 + (3 - row)
          return (
            <Cell key={pos} {...p}
              incId={inc.id}
              pos={pos}
              zona={null}
              gridCol={gridCol}
              gridRow={gridRow}
              onClick={() => onClicCella(pos)}
              onDrop={onDropCell(pos)}
            />
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>↓ porta frontal ↓</div>
    </div>
  )
}

function IncubadoraMS({ inc, sub, onClicCella, onDropCell, filtrada, anyFiltrada, onToggleFiltrada, ...p }: CellPropsCommon & {
  inc: Incubadora
  sub: 'MSG' | 'MSP'
  onClicCella: (pos: number, zona: ZonaMS) => void
  onDropCell: (pos: number, zona: ZonaMS) => (e: React.DragEvent) => void
  filtrada: boolean
  anyFiltrada: boolean
  onToggleFiltrada: () => void
}) {
  const ocupNous = Array.from(p.colocats.values()).filter(c => c.incId === inc.id).length
  const ocupAltres = Array.from(p.ocupatsAltresFulls.keys()).filter(k => k.startsWith(`${inc.id}|`)).length
  const profunditat = sub === 'MSG' ? 4 : 2
  const posEsq = sub === 'MSG' ? [1, 2, 3, 4] : [1, 2]
  const posDre = sub === 'MSG' ? [5, 6, 7, 8] : [3, 4]
  const exclosa = anyFiltrada && !filtrada

  return (
    <div style={{ ...cardInc(), outline: filtrada ? '2px solid #2563eb' : exclosa ? '1px solid #e5e7eb' : undefined, opacity: exclosa ? 0.5 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 13, gap: 4 }}>
        <button onClick={onToggleFiltrada} title={filtrada ? 'Exclou del suggeriment' : 'Inclou al suggeriment'} style={{ fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: filtrada ? '#2563eb' : '#1f2937', fontSize: 13 }}>
          {filtrada ? '✓ ' : ''}Inc {inc.numero}
        </button>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 11 }}>{ocupNous + ocupAltres}/{inc.capacitat_carros}</span>
          <button onClick={p.onSelLliures} style={btnSelLliures()} title="Selecciona totes les cel·les lliures">+ sel. lliures</button>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 6px 1fr 1fr 1fr', gap: 3 }}>
        {/* Capçaleres */}
        {[{ z: 'paret', d: '~7d', col: 1 }, { z: 'central', d: '~0d', col: 2 }, { z: 'pulsator', d: '~14d', col: 3 },
          { z: 'pulsator', d: '~14d', col: 5 }, { z: 'central', d: '~0d', col: 6 }, { z: 'paret', d: '~7d', col: 7 }].map((h, i) => (
          <div key={i} style={{ gridColumn: h.col, gridRow: 1, fontSize: 8, textAlign: 'center', color: '#6b7280', lineHeight: 1.05 }}>
            {h.z}<br /><span style={{ color: '#9ca3af' }}>{h.d}</span>
          </div>
        ))}
        <div style={{ gridColumn: 4, gridRow: `2 / ${2 + profunditat}`, background: '#1f2937', borderRadius: 1 }} />
        {/* Costat esq: zones paret/central/pulsator (cols 1-3) */}
        {MS_ZONES_ESQ.map((z, zi) => posEsq.map(pos => (
          <Cell key={`esq-${pos}-${z}`} {...p}
            incId={inc.id} pos={pos} zona={z}
            gridCol={zi + 1}
            gridRow={2 + (profunditat - pos)}
            zonaClass={z}
            onClick={() => onClicCella(pos, z)}
            onDrop={onDropCell(pos, z)}
          />
        )))}
        {/* Costat dre: zones pulsator/central/paret (cols 5-7) */}
        {MS_ZONES_DRE.map((z, zi) => posDre.map(pos => {
          const posLocal = pos - (sub === 'MSG' ? 4 : 2)
          return (
            <Cell key={`dre-${pos}-${z}`} {...p}
              incId={inc.id} pos={pos} zona={z}
              gridCol={zi + 5}
              gridRow={2 + (profunditat - posLocal)}
              zonaClass={z}
              onClick={() => onClicCella(pos, z)}
              onDrop={onDropCell(pos, z)}
            />
          )
        }))}
      </div>
      <div style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>↓ porta frontal ↓</div>
    </div>
  )
}

// ── Cel·la individual ──────────────────────────────────────────────────────

function Cell({ incId, pos, zona, gridCol, gridRow, zonaClass, onClick, onDrop, carrosLot, carroPerCella, ocupatsAltresFulls, lliureAviatPerCella, mostrarProjectat, colocats, seleccionades, onDragStartCarro, onDragOverCell, onClicCarroColocat }: CellPropsCommon & {
  incId: number
  pos: number
  zona: ZonaMS | null
  gridCol: number
  gridRow: number
  zonaClass?: ZonaMS
  onClick: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const k = keyCell(incId, pos, zona)
  const carroIdNou = carroPerCella.get(k)
  const ocupAltre = ocupatsAltresFulls.get(k)
  const lliureAviat = lliureAviatPerCella.get(k)
  const sel = seleccionades.has(k)

  // lliureAviat té prioritat sobre ocupAltre (és un subconjunt que permet interacció)
  // En mode projectat, les cel·les "lliure aviat" es mostren com a buides
  const tractarComBuit = mostrarProjectat && !!lliureAviat && carroIdNou === undefined
  const blocat = !!ocupAltre && !lliureAviat

  let bg = '#fefefe'
  let border = '1px dashed #cbd5e1'
  let color = '#1f2937'
  let cursor: 'default' | 'pointer' | 'grab' = 'default'

  if (zonaClass) {
    bg = zonaClass === 'paret' ? '#fee2e2' : zonaClass === 'central' ? '#f3f4f6' : '#fed7aa'
  }
  if (blocat) {
    bg = '#4b5563'
    color = '#fff'
    border = '1px solid #4b5563'
  } else if (lliureAviat && !carroIdNou && !tractarComBuit) {
    // Ocupat ara però lliure a temps — verd suau (mode no projectat)
    bg = '#dcfce7'
    border = '1px dashed #16a34a'
    color = '#14532d'
    cursor = 'pointer'
  } else if (carroIdNou !== undefined) {
    bg = '#bfdbfe'
    border = '1px solid #2563eb'
    color = '#1e3a8a'
    cursor = 'grab'
  } else if (sel) {
    bg = '#fde68a'
    border = '1px solid #f59e0b'
    color = '#92400e'
    cursor = 'pointer'
  } else {
    cursor = 'pointer'
  }

  const carroNouObj = carroIdNou !== undefined ? carrosLot.find(c => c.id === carroIdNou) : null

  // Text del comptador de dies per a cel·les "lliure aviat"
  function textDiesFins(dies: number): string {
    if (dies <= 0) return 'avui'
    if (dies === 1) return 'demà'
    return `${dies}d`
  }

  // Tooltip detallat
  const titleText = blocat
    ? `Ocupat · càrrega ${ocupAltre!.num_carrega}/#${ocupAltre!.num_carro_full}`
    : lliureAviat && !carroIdNou
    ? `Lliure en ${textDiesFins(lliureAviat.diesFins)} · transferència ${lliureAviat.data_transferencia_full} · carrega ${lliureAviat.num_carrega}/#${lliureAviat.num_carro_full} · click o arrossega per assignar`
    : carroNouObj
    ? `${nomCarroCurt(carroNouObj)} · ${carroNouObj.quantitat_ous} ous · click per treure`
    : `Pos ${pos}${zona ? ' · ' + zona : ''}`

  return (
    <div
      style={{ gridColumn: gridCol, gridRow, minHeight: 48, borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: 10, fontWeight: 600, padding: 2, lineHeight: 1.05, overflow: 'hidden', background: bg, border, color, cursor }}
      onClick={() => {
        if (carroIdNou !== undefined) onClicCarroColocat(carroIdNou)
        else if (!blocat) onClick()
      }}
      draggable={carroIdNou !== undefined}
      onDragStart={(e) => carroIdNou !== undefined && onDragStartCarro(e, carroIdNou, k)}
      onDragOver={!blocat ? onDragOverCell : undefined}
      onDrop={!blocat ? onDrop : undefined}
      title={titleText}
    >
      {blocat && ocupAltre && <span>#{ocupAltre.num_carro_full}</span>}
      {lliureAviat && !carroIdNou && !tractarComBuit && (
        <>
          <span style={{ fontSize: 8, opacity: 0.7, textAlign: 'center' }}>#{lliureAviat.num_carro_full}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d' }}>{textDiesFins(lliureAviat.diesFins)}</span>
        </>
      )}
      {carroNouObj && (
        <>
          <span style={{ fontSize: 10, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomCarroCurt(carroNouObj)}</span>
          <span style={{ fontSize: 9, opacity: 0.75 }}>p{pos}</span>
        </>
      )}
      {!blocat && (tractarComBuit || !lliureAviat) && !carroNouObj && (
        <span style={{ fontSize: 9, opacity: 0.5 }}>{pos}</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Estils helpers
// ─────────────────────────────────────────────────────────────────────────────

function cardSeccio(): React.CSSProperties { return { background: '#fff', border: '1px solid #d4d4d4', borderRadius: 8, padding: 14 } }
function h2Seccio(): React.CSSProperties { return { margin: '0 0 12px', fontSize: 15, display: 'flex', gap: 8, alignItems: 'center' } }
function badgeStyle(): React.CSSProperties { return { background: '#f7f7f5', border: '1px solid #d4d4d4', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, color: '#6b7280' } }
function cardInc(): React.CSSProperties { return { border: '1px solid #d4d4d4', borderRadius: 6, padding: 8, background: '#fafafa' } }
function btnSelLliures(): React.CSSProperties { return { background: '#fde68a', border: '1px solid #f59e0b', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: '#92400e', fontWeight: 600 } }
function chipNaix(): React.CSSProperties { return { background: '#4b5563', color: '#fff', padding: '4px 6px', borderRadius: 4, fontSize: 11 } }
function miniBtn(): React.CSSProperties { return { background: '#fff', border: '1px solid #d4d4d4', borderRadius: 3, cursor: 'pointer', fontSize: 10 } }
function btnStyle(primari: boolean): React.CSSProperties {
  return primari
    ? { padding: '8px 14px', borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, marginLeft: 8, fontWeight: 600 }
    : { padding: '8px 14px', borderRadius: 6, border: '1px solid #6b7280', background: '#f3f4f6', color: '#1f2937', cursor: 'pointer', fontSize: 13, marginLeft: 8, fontWeight: 500 }
}
