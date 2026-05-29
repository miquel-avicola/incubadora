import { suggerirZonaMS, indexCalorCarro, fertilitatEstimada, calorFuturaCarro, type CarroTermic } from '@/lib/termico'

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

export type ZonaMS = 'central' | 'paret' | 'pulsator'
export type SubTipus = 'SS' | 'MSG' | 'MSP' | 'NAIX'
export type Dia = 'dijous' | 'dilluns'
export type Fase = 'seleccio' | 'assignacio'

export interface CarroEstoc {
  id: number
  posta: string
  quantitat_ous: number
  estat: string
  client_maquila_id?: number | null
  lots_reproductores: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: { granja: string; nom_informal: string | null }
  }
  previsio_pct?: number
}

export interface Incubadora {
  id: number
  numero: number
  model: string
  tipus: string
  capacitat_carros: number
}

export interface AssignacioActual {
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
    previsio_pct?: number
  }
  incubadores: { numero: number; model: string; tipus: string }
}

export interface Full {
  id: number
  num_carrega: number
  carrega: string
  assignacions: AssignacioActual[]
  comandes: { quantitat_pollets: number | null; quantitat_ous_maquila: number | null; tipus: string }[]
}

export interface CarroInst {
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

export interface IncInst {
  id: number
  numero: number
  tipus: string
  capacitat: number
  carros: CarroInst[]
}

export interface EstatInst {
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
export function ssPosToCell(pos: number): { col: number; row: number } {
  const grup = Math.floor((pos - 1) / 4)
  const row = (pos - 1) % 4
  const grupAColumna = [0, 5, 1, 4, 2, 3]
  return { col: grupAColumna[grup], row }
}

export const MS_ZONES_ESQ: ZonaMS[] = ['paret', 'central', 'pulsator']
export const MS_ZONES_DRE: ZonaMS[] = ['pulsator', 'central', 'paret']

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function subtipus(tipus: string, cap: number): SubTipus {
  if (tipus === 'Singlestage') return 'SS'
  if (tipus === 'Multistage' && cap === 24) return 'MSG'
  if (tipus === 'Multistage' && cap === 12) return 'MSP'
  return 'NAIX'
}

export function diaDeFull(dataIso: string): Dia | null {
  const d = new Date(dataIso + 'T12:00:00').getDay()
  if (d === 1) return 'dilluns'
  if (d === 4) return 'dijous'
  return null
}

export function nomCarroCurt(c: CarroEstoc | AssignacioActual['carros_estoc']): string {
  const lot = c.lots_reproductores
  return lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
}

export function keyCell(incId: number, pos: number, zona: ZonaMS | null): string {
  return `${incId}|${pos}|${zona || '-'}`
}

export function diesEstoc(posta: string, carrega: string): number {
  const p = new Date(posta + 'T00:00:00')
  const c = new Date(carrega + 'T00:00:00')
  return Math.floor((c.getTime() - p.getTime()) / 86400000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers tèrmics
// ─────────────────────────────────────────────────────────────────────────────

// Setmanes de vida del lot a partir de la data de naixement (ISO)
export function setmanesLot(dataNaixement: string): number {
  const ms = Date.now() - new Date(dataNaixement + 'T00:00:00').getTime()
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000))
}

// Replica TypeScript de la funció PL/pgSQL offset_per_dia().
// Retorna l'offset de numeració per a una incubadora donada.
// num_carro_full = offset + posicio
export function offsetPerDia(
  dia: Dia,
  tipus: string,
  cap: number,
  incNumero: number,
  ssPrincipalNum: number | null,
  mspOrdre: number[]
): number | null {
  if (dia === 'dijous') {
    if (tipus === 'Singlestage') {
      if (ssPrincipalNum === null) return null
      return incNumero === ssPrincipalNum ? 0 : 100
    } else if (cap === 24) {
      if (incNumero === 1) return 24
      if (incNumero === 2) return 32
      return 200 + incNumero * 8
    } else {
      const idx = mspOrdre.indexOf(incNumero)
      return idx >= 0 ? 40 + idx * 4 : null
    }
  } else { // dilluns
    if (tipus === 'Singlestage') return 100
    if (cap === 24) {
      if (incNumero >= 3 && incNumero <= 6) return (incNumero - 3) * 8
      return 200 + incNumero * 8
    } else {
      const idx = mspOrdre.indexOf(incNumero)
      return idx >= 0 ? 32 + idx * 4 : null
    }
  }
}

// Pollets estimats per a un carro (fórmula completa o fallback)
export function polletsCarro(c: CarroEstoc | AssignacioActual['carros_estoc']): number {
  if (c.previsio_pct != null) return Math.round(c.quantitat_ous * c.previsio_pct)
  const setm = setmanesLot(c.lots_reproductores.data_naixement)
  return Math.round(c.quantitat_ous * fertilitatEstimada(setm) * ECLOSIO_EST)
}

// Optimitza les zones (central/paret/pulsator) dels carros MS del full actual
// deixant les Singlestage i els carros d'altres fulls intactes.
// Algoritme greedy: per cada MS, tria la zona que minimitza el desequilibri
// projectat a 21 dies, processant els carros en ordre de calor potencial DESC.
export function optimitzarZonesTermiques(
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
// Projecció de l'estat de les instal·lacions al moment del load futur
// ─────────────────────────────────────────────────────────────────────────────
//
// Donat l'estat real actual i la data del load actual, retorna un nou EstatInst
// que reflecteix com estaran les màquines just abans del load: amb totes les
// transferències intermèdies aplicades (carros eliminats) i les rotacions MSG
// (paret→pulsator, central→paret) executades automàticament cada vegada que el
// pulsator d'una MSG queda buit. Replica el comportament del botó manual
// "Rotar zones" + la funció SQL rotar_zones_ms_gran.
//
// Regles:
//   · Es processen totes les transferències amb data_transferencia_full ≤ data
//     de càrrega del full actual i que no pertanyen al full actual.
//   · Les transferències s'apliquen en ordre cronològic ASC.
//   · Després de cada transferència, per cada MSG (cap=24) afectada: si el
//     pulsator d'aquella MS queda completament buit, s'aplica la rotació.
//   · Les MSP (cap=12) i les SS NO roten — només es treuen els carros
//     transferits.
//   · La rotació manté la `posicio` numèrica del carro, només canvia la `zona`.

export function projectarEstatInst(
  estatInst: EstatInst,
  dataCarrega: string,
  assignacioIdsDelFull: Set<number>
): EstatInst {
  // Còpia profunda per no mutar l'estat original
  const nou: EstatInst = structuredClone(estatInst)
  const dataLoad = new Date(dataCarrega + 'T00:00:00').getTime()

  // 1. Recopilar transferències pendents (clau única per carrega+data)
  type TransfEvent = { numCarrega: number; dataTransf: string }
  const transfMap = new Map<string, TransfEvent>()
  for (const inc of nou.incubadores) {
    for (const c of inc.carros) {
      if (assignacioIdsDelFull.has(c.assignacio_id)) continue
      if (!c.data_transferencia_full) continue
      const dataTrans = new Date(c.data_transferencia_full + 'T00:00:00').getTime()
      if (dataTrans > dataLoad) continue
      const key = `${c.num_carrega}|${c.data_transferencia_full}`
      if (!transfMap.has(key)) {
        transfMap.set(key, { numCarrega: c.num_carrega, dataTransf: c.data_transferencia_full })
      }
    }
  }

  // 2. Ordenar cronològicament ASC
  const transfsOrdenades = Array.from(transfMap.values()).sort(
    (a, b) => new Date(a.dataTransf + 'T00:00:00').getTime() - new Date(b.dataTransf + 'T00:00:00').getTime()
  )

  // 3. Aplicar cada transferència i rotar les MSG que quedin amb pulsator buit
  for (const ev of transfsOrdenades) {
    const incsAfectades = new Set<number>()

    for (const inc of nou.incubadores) {
      const abans = inc.carros.length
      inc.carros = inc.carros.filter((c) => {
        if (c.num_carrega !== ev.numCarrega) return true
        if (c.data_transferencia_full !== ev.dataTransf) return true
        return false
      })
      if (inc.carros.length !== abans) incsAfectades.add(inc.id)
    }

    // Rotació automàtica de MSG amb pulsator buit
    Array.from(incsAfectades).forEach((incId) => {
      const inc = nou.incubadores.find((i) => i.id === incId)
      if (!inc) return
      if (inc.tipus !== 'Multistage' || inc.capacitat !== 24) return
      const hiHaPulsator = inc.carros.some((c) => c.zona === 'pulsator')
      if (hiHaPulsator) return
      // paret → pulsator, central → paret (manté `posicio`)
      for (const c of inc.carros) {
        if (c.zona === 'paret') c.zona = 'pulsator'
        else if (c.zona === 'central') c.zona = 'paret'
      }
    })
  }

  return nou
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

export interface CellaSel {
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

export function ordreCellesSS(c: CellaSel): number {
  // Pulsator(esq)=0, Central(esq)=1, Paret(esq)=2, Paret(dre)=3, Central(dre)=4, Pulsator(dre)=5
  // Per prioritzar pulsator+central abans que paret:
  // Pulsator esq, Central esq, Pulsator dre, Central dre, Paret esq, Paret dre
  // → ordre desitjat: 0, 1, 5, 4, 2, 3
  const mapa: Record<number, number> = { 0: 0, 1: 1, 5: 2, 4: 3, 2: 4, 3: 5 }
  return mapa[c.prioritat] ?? 99
}

export function preSuggerit(
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

export const ECLOSIO_EST = 0.88

export function suggerirAssignacioCompleta(
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

  // ── 0. Separar maquila de pollets ───────────────────────────────────────
  // Els carros amb client_maquila_id són maquila: NO compten per a la comanda
  // de pollets i es reserven places al final del patró (dilluns últim, dijous
  // després de la SS, mai a la SS). Vegeu REGLES_ASSIGNACIO.md §2.1 i §2.8.
  const carrosPollets = carrosPendents.filter(c => c.client_maquila_id == null)
  const maquilaCarros = carrosPendents.filter(c => c.client_maquila_id != null)
  // Maquila ordenada per lot (consecutiu) i posta ASC.
  const maquilaOrd = (() => {
    const byLot = new Map<number, CarroEstoc[]>()
    for (const c of maquilaCarros) {
      const lid = c.lots_reproductores.id
      if (!byLot.has(lid)) byLot.set(lid, [])
      byLot.get(lid)!.push(c)
    }
    byLot.forEach(cs => cs.sort((a, b) =>
      new Date(a.posta + 'T00:00:00').getTime() - new Date(b.posta + 'T00:00:00').getTime()
    ))
    return Array.from(byLot.values())
      .sort((a, b) => new Date(a[0].posta + 'T00:00:00').getTime() - new Date(b[0].posta + 'T00:00:00').getTime())
      .flat()
  })()

  // ── 1. Construir pool ───────────────────────────────────────────────────
  // Comanda pollets propis
  const comandaPollets = full.comandes
    .filter(c => c.tipus !== 'maquila' && c.quantitat_pollets !== null && c.quantitat_pollets > 0)
    .reduce((s, c) => s + (c.quantitat_pollets ?? 0), 0)

  // Ordenar el pool de pollets. Agrupar per lot (lots consecutius a les MS) i
  // ordenar els lots per QUALITAT, PITJOR PRIMER (§2.5, §7 #12):
  //   · Lots FORA de l'òptim 30-55 setm (dolents, tant vells >55 com joves <30)
  //     van primer → matiners (Inc 3 / cua del patró).
  //   · Lots dins l'òptim 30-55 van al final → Avinatur (premium).
  //   · Dins la mateixa qualitat, per dies d'estoc (posta més antiga primer).
  // Dins de cada lot, carros ordenats per posta ASC.
  // NOTA: quan els lots dolents superen la capacitat de matiners, l'excés
  // desborda cap a Avinatur — el repartiment fi per client (anticipació §2.5)
  // encara no està implementat (vegeu §7 #12).
  const carrosOrd = (() => {
    const byLot = new Map<number, CarroEstoc[]>()
    for (const c of carrosPollets) {
      const lid = c.lots_reproductores.id
      if (!byLot.has(lid)) byLot.set(lid, [])
      byLot.get(lid)!.push(c)
    }
    byLot.forEach(cs => cs.sort((a, b) =>
      new Date(a.posta + 'T00:00:00').getTime() - new Date(b.posta + 'T00:00:00').getTime()
    ))
    const esOptim = (cs: CarroEstoc[]): boolean => {
      const setm = setmanesLot(cs[0].lots_reproductores.data_naixement)
      return setm >= 30 && setm <= 55
    }
    const lotsOrds = Array.from(byLot.values()).sort((a, b) => {
      const oa = esOptim(a), ob = esOptim(b)
      // Dolents (no òptims) primer; òptims al final.
      if (oa !== ob) return oa ? 1 : -1
      // Dins la mateixa qualitat: posta més antiga primer (més dies d'estoc).
      return new Date(a[0].posta + 'T00:00:00').getTime() - new Date(b[0].posta + 'T00:00:00').getTime()
    })
    return lotsOrds.flat()
  })()

  let pool: CarroEstoc[]
  if (comandaPollets > 0) {
    let polletsPrev = 0
    pool = []
    for (const c of carrosOrd) {
      const setm = setmanesLot(c.lots_reproductores.data_naixement)
      const pred = polletsCarro(c)
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
    } else if (sub === 'MSG') {
      // MSG: nous carros sempre al central (paret/pulsator es reserven per a la rotació)
      const maxEsq = 4
      const maxDre = 8
      for (let p = 1; p <= maxEsq; p++) if (esDisp(p, 'central')) slots.push({ pos: p, zona: 'central', costat: 'esq' })
      for (let p = maxEsq + 1; p <= maxDre; p++) if (esDisp(p, 'central')) slots.push({ pos: p, zona: 'central', costat: 'dre' })
    } else {
      // MSP: llibertat total — qualsevol zona disponible.
      // Ordre de preferència: central > paret > pulsator dins de cada costat.
      const maxEsq = 2
      const maxDre = 4
      const zonesPreferides: ZonaMS[] = ['central', 'paret', 'pulsator']
      for (const z of zonesPreferides) {
        for (let p = 1; p <= maxEsq; p++) if (esDisp(p, z)) slots.push({ pos: p, zona: z, costat: 'esq' })
        for (let p = maxEsq + 1; p <= maxDre; p++) if (esDisp(p, z)) slots.push({ pos: p, zona: z, costat: 'dre' })
      }
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

  // ── 4b. Reserva de places per a la maquila (§2.1, §7 #13) ───────────────
  // La maquila entra automàticament; se li han de garantir places encara que
  // els pollets desbordin. Calculem les places noves disponibles a les MS del
  // patró i limitem el pool de pollets a (total − maquila), deixant la cua per
  // a la maquila.
  const passaFiltre = (n: number): boolean => {
    if (incsFiltrades.size === 0) return true
    const inc = incByNumero.get(n)
    return !!inc && incsFiltrades.has(inc.id)
  }
  let totalMSSlots = 0
  for (const num of ordreIncs) {
    if (!passaFiltre(num)) continue
    const inc = incByNumero.get(num); if (!inc) continue
    const sub = subtipus(inc.tipus, inc.capacitat_carros)
    if (sub === 'SS') continue
    const incInst = instById.get(inc.id); if (!incInst) continue
    const nSlots = slotsDisponibles(incInst).length
    totalMSSlots += sub === 'MSP' ? Math.min(4, nSlots) : nSlots
  }
  const maxPolletsMS = Math.max(0, totalMSSlots - maquilaOrd.length)

  // ── 5. Separar carros per SS i MS (dijous) ──────────────────────────────
  // La maquila va sempre a MS, al final (mai a la SS). En afegir-la al final
  // de poolMS, l'ompliment consecutiu la deixa a la cua del patró (dilluns
  // últim; dijous després de la SS, a Inc 1/2/8). Els pollets es limiten a
  // maxPolletsMS perquè la maquila no quedi fora sota capacitat justa.
  let poolSS: CarroEstoc[] = []
  let poolMS: CarroEstoc[] = [...pool.slice(0, maxPolletsMS), ...maquilaOrd]

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
      // Maquila sempre a MS (al final), mai a la SS; pollets limitats per deixar-li lloc.
      poolMS = [...pool.filter(c => !idsSS.has(c.id)).slice(0, maxPolletsMS), ...maquilaOrd]
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
      // MS: ompliment CONSECUTIU sense forats (§3.4). El lot-junt es manté
      // perquè el pool ja ve agrupat per lot i pot creuar costats i incubadores
      // (§4.2). L'equilibri tèrmic esq/dre és preferència suau i NO reordena
      // aquí (§4.5): mana l'ordre de camió. Substitueix la lògica antiga
      // "un sol lot per costat", que deixava forats quan un lot omplia un
      // costat i part de l'altre.
      const carrosAquiMS = poolMS.filter(c => !assignats.has(c.id))
      if (carrosAquiMS.length === 0) continue

      // Seqüència de slots: central primer, esquerra abans que dreta, pos ASC.
      const ordreZona = (z: ZonaMS | null): number => z === 'central' ? 0 : z === 'paret' ? 1 : z === 'pulsator' ? 2 : 3
      const ordreCostat = (c: 'esq' | 'dre' | 'cap'): number => c === 'esq' ? 0 : c === 'dre' ? 1 : 2
      const slotSeqAll = [...slots].sort((a, b) => {
        const dz = ordreZona(a.zona) - ordreZona(b.zona)
        if (dz !== 0) return dz
        const dc = ordreCostat(a.costat) - ordreCostat(b.costat)
        if (dc !== 0) return dc
        return a.pos - b.pos
      })
      if (slotSeqAll.length === 0) continue
      // MSP: màxim 4 carros nous per càrrega (central; queda 2-2 de forma natural).
      const slotSeq = sub === 'MSP' ? slotSeqAll.slice(0, 4) : slotSeqAll

      let k = 0
      for (const slot of slotSeq) {
        if (k >= carrosAquiMS.length) break
        const carro = carrosAquiMS[k]
        resultat.set(carro.id, { incId: incInst.id, pos: slot.pos, zona: slot.zona })
        assignats.add(carro.id)
        k++
      }
    }
  }

  return resultat
}

