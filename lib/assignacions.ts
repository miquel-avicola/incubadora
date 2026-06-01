import { suggerirZonaMS, indexCalorCarro, fertilitatEstimada, calorFuturaCarro, type CarroTermic } from '@/lib/termico'

// ─────────────────────────────────────────────────────────────────────────────
// Tipus
// ─────────────────────────────────────────────────────────────────────────────

export type ZonaMS = 'central' | 'paret' | 'pulsator'
export type SubTipus = 'SS' | 'MSG' | 'MSP' | 'NAIX'
export type Dia = 'dijous' | 'dilluns'
export type Fase = 'seleccio' | 'assignacio'
export type CategoriaClient = 'A' | 'B' | 'C' | 'M'
export type QualitatGranja = 'normal' | 'dolenta' | 'explosiva'

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
    granges_reproductores: { granja: string; nom_informal: string | null; qualitat?: QualitatGranja }
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
  carrega_seguent?: string | null  // per calcular anticipació §2.5
  assignacions: AssignacioActual[]
  comandes: {
    id?: number
    client_id?: number | null
    quantitat_pollets: number | null
    quantitat_ous_maquila: number | null
    tipus: string
    sexat?: boolean
    override_ordre_carrega?: number | null
    client?: {
      id: number
      nom: string
      categoria?: CategoriaClient | null
      ordre_carrega?: number | null
    }
  }[]
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

// Resultat del motor d'assignació (§2.9.5): assignacions + avisos per regles toves no complertes.
export interface ResultatAssignacio {
  assignacions: Map<number, { incId: number; pos: number; zona: ZonaMS | null }>
  avisos: string[]
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
// Helpers generals
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers del repartiment per client (§2.9)
// ─────────────────────────────────────────────────────────────────────────────

// Qualitat d'un carro per al repartiment A/B/C (§2.9.0, §2.3, §2.4):
//   'A' = lot en rang òptim 30-55 setm i granja normal → millors lots
//   'C' = lot fora de rang, granja dolenta o granja explosiva → pitjors lots
// explosiu: cert quan la granja té qualitat 'explosiva'; indica routing a cua MS
// al dijous (§2.8, §2.9.4). Al dilluns s'inclou al calaixC normalment.
export function qualitatLotCarro(c: CarroEstoc): { q: 'A' | 'C'; explosiu: boolean } {
  const qualGranja = c.lots_reproductores.granges_reproductores.qualitat ?? 'normal'
  const setm = setmanesLot(c.lots_reproductores.data_naixement)
  const optim = setm >= 30 && setm <= 55
  const explosiu = qualGranja === 'explosiva'
  if (!optim || qualGranja === 'dolenta' || explosiu) return { q: 'C', explosiu }
  return { q: 'A', explosiu: false }
}

// Paràmetres d'anticipació d'estoc (§2.5).
// Llindar de treball de l'Enric — a validar amb dades.
export const ANTICIPACIO_LLINDAR_DIES = 11
export const ANTICIPACIO_LLINDAR_QUANTITAT = 4

// Identifica els carros que s'han d'evacuar al client A per anticipació §2.5.
// Si >LLINDAR_QUANTITAT carros tindrien >LLINDAR_DIES dies a la propera càrrega,
// tots ells s'assignen al client A (en lloc de lots bons frescos que queden a estoc).
export function idsCarrosAEvacuar(
  carrosPollets: CarroEstoc[],
  dataProperaCàrrega: string
): Set<number> {
  const vells = carrosPollets.filter(c =>
    diesEstoc(c.posta, dataProperaCàrrega) > ANTICIPACIO_LLINDAR_DIES
  )
  if (vells.length <= ANTICIPACIO_LLINDAR_QUANTITAT) return new Set()
  return new Set(vells.map(c => c.id))
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimitza les zones (central/paret/pulsator) dels carros MS del full actual
// ─────────────────────────────────────────────────────────────────────────────

export function optimitzarZonesTermiques(
  colocatsActuals: Map<number, { incId: number; pos: number; zona: ZonaMS | null }>,
  carrosLotParam: CarroEstoc[],
  estatInstParam: EstatInst,
  incsById: Map<number, Incubadora>,
  assignacioIdsDelFull: Set<number>
): Map<number, { incId: number; pos: number; zona: ZonaMS | null }> {
  const resultat = new Map(colocatsActuals)

  const msIncIds = new Set<number>()
  colocatsActuals.forEach((p) => {
    const inc = incsById.get(p.incId)
    if (inc && inc.tipus === 'Multistage') msIncIds.add(p.incId)
  })

  msIncIds.forEach((incId) => {
    const inc = incsById.get(incId)
    if (!inc) return
    const maxPerZona = inc.capacitat_carros === 24 ? 8 : 4

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

    const carrosDeFull: { carroId: number; carro: CarroEstoc }[] = []
    colocatsActuals.forEach((p, carroId) => {
      if (p.incId !== incId) return
      const carro = carrosLotParam.find((c) => c.id === carroId)
      if (carro) carrosDeFull.push({ carroId, carro })
    })

    carrosDeFull.sort((a, b) => {
      const sa = setmanesLot(a.carro.lots_reproductores.data_naixement)
      const sb = setmanesLot(b.carro.lots_reproductores.data_naixement)
      return indexCalorCarro(b.carro.quantitat_ous, sb, 18)
           - indexCalorCarro(a.carro.quantitat_ous, sa, 18)
    })

    const carrosVirtuals: CarroTermic[] = [...carrosFixos]
    for (const { carroId, carro } of carrosDeFull) {
      const setm = setmanesLot(carro.lots_reproductores.data_naixement)
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

export function projectarEstatInst(
  estatInst: EstatInst,
  dataCarrega: string,
  assignacioIdsDelFull: Set<number>
): EstatInst {
  const nou: EstatInst = structuredClone(estatInst)
  const dataLoad = new Date(dataCarrega + 'T00:00:00').getTime()

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

  const transfsOrdenades = Array.from(transfMap.values()).sort(
    (a, b) => new Date(a.dataTransf + 'T00:00:00').getTime() - new Date(b.dataTransf + 'T00:00:00').getTime()
  )

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

    Array.from(incsAfectades).forEach((incId) => {
      const inc = nou.incubadores.find((i) => i.id === incId)
      if (!inc) return
      if (inc.tipus !== 'Multistage' || inc.capacitat !== 24) return
      const hiHaPulsator = inc.carros.some((c) => c.zona === 'pulsator')
      if (hiHaPulsator) return
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

export interface CellaSel {
  incId: number
  pos: number
  zona: ZonaMS | null
  prioritat: number
  costat: 'esq' | 'dre' | 'cap'
  columna: number
}

export function ordreCellesSS(c: CellaSel): number {
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

  const grupsCarros = new Map<string, CarroEstoc[]>()
  for (const c of carrosPendents) {
    const key = `${c.lots_reproductores.granges_reproductores.granja}|${c.lots_reproductores.estirp || ''}|${c.posta}`
    if (!grupsCarros.has(key)) grupsCarros.set(key, [])
    grupsCarros.get(key)!.push(c)
  }
  const grupsOrd = Array.from(grupsCarros.entries()).sort((a, b) => b[1].length - a[1].length)

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
      const costat = (sub === 'MSG' ? (cel.pos <= 4 ? 'esq' : 'dre') : (cel.pos <= 2 ? 'esq' : 'dre'))
      groupKey = `${cel.incId}|MS|${cel.zona}|${costat}`
    }
    if (!grupsCelles.has(groupKey)) grupsCelles.set(groupKey, [])
    grupsCelles.get(groupKey)!.push(cel)
  }

  const grupsCellesOrd = Array.from(grupsCelles.entries()).sort((a, b) => {
    const [keyA, cellsA] = a
    const [keyB, cellsB] = b
    const tipusA = keyA.split('|')[1]
    const tipusB = keyB.split('|')[1]
    if (tipusA !== tipusB) return tipusA === 'SS' ? -1 : 1
    if (tipusA === 'SS') {
      const colA = parseInt(keyA.split('|')[2])
      const colB = parseInt(keyB.split('|')[2])
      const ordA = ordreCellesSS(cellsA[0])
      const ordB = ordreCellesSS(cellsB[0])
      if (ordA !== ordB) return ordA - ordB
      return colA - colB
    } else {
      const partsA = keyA.split('|')
      const partsB = keyB.split('|')
      const ordZona: Record<string, number> = { central: 0, paret: 1, pulsator: 2 }
      const za = ordZona[partsA[2]] ?? 3
      const zb = ordZona[partsB[2]] ?? 3
      if (za !== zb) return za - zb
      if (partsA[3] !== partsB[3]) return partsA[3] === 'esq' ? -1 : 1
      return 0
    }
  })

  for (const [, cells] of grupsCellesOrd) {
    cells.sort((x, y) => x.pos - y.pos)
  }

  const ordreCelles: CellaSel[] = []
  for (const [, cells] of grupsCellesOrd) ordreCelles.push(...cells)

  const ordreCarros: CarroEstoc[] = []
  for (const [, carros] of grupsOrd) ordreCarros.push(...carros)

  const n = Math.min(ordreCarros.length, ordreCelles.length)
  for (let i = 0; i < n; i++) {
    const c = ordreCarros[i]
    const cel = ordreCelles[i]
    resultat.set(c.id, { incId: cel.incId, pos: cel.pos, zona: cel.zona })
  }
  return resultat
}

// ─────────────────────────────────────────────────────────────────────────────
// Algorisme de suggeriment complet (v3) — §2.9
// ─────────────────────────────────────────────────────────────────────────────
//
// Implementa el disseny complet de repartiment per client:
//   · Dos eixos independents per client: categoria (A/B/C/M) i ordre_carrega.
//   · Sexat → Ross (regla DURA, §2.9.2): reserva carros Ross per a comandes sexades.
//   · Repartiment A/B/C (§2.9.3): pitjors lots (C) als clients C; millors (A) als A.
//   · Anticipació §2.5: si >4 carros tindrien >11 dies a la propera càrrega, els
//     evacua al client A en lloc de lots bons (que queden a estoc).
//   · Dijous — dos fluxos (§2.9.4): SS = Pondex (B) + Sanco sans; explosius →
//     cua MS (mai a SS, §2.8). Maquila → cua MS sempre.
//   · Avisos (§2.9.5) per cada regla tova que no s'ha pogut complir.
//
// Retorna ResultatAssignacio { assignacions: Map<carro_id, posició>, avisos: string[] }.

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
): ResultatAssignacio {
  const resultat = new Map<number, { incId: number; pos: number; zona: ZonaMS | null }>()
  const avisos: string[] = []
  if (carrosPendents.length === 0) return { assignacions: resultat, avisos }

  const incsById = new Map(incs.map(i => [i.id, i]))
  const instById = new Map(estatInstParam.incubadores.map(ii => [ii.id, ii]))
  const incByNumero = new Map(incs.map(i => [i.numero, i]))

  // ── 0. Separar maquila de pollets ─────────────────────────────────────────
  const carrosPollets = carrosPendents.filter(c => c.client_maquila_id == null)
  const maquilaCarros = carrosPendents.filter(c => c.client_maquila_id != null)
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

  // ── 1. Classificar tots els carros de pollets per qualitat ────────────────
  type CarroQual = { c: CarroEstoc; q: 'A' | 'C'; explosiu: boolean }
  const carrosQual: CarroQual[] = carrosPollets.map(c => ({ c, ...qualitatLotCarro(c) }))

  // ── 2. Sexat → Ross (regla DURA §2.9.2) ──────────────────────────────────
  const comandesPollets = full.comandes.filter(
    c => c.tipus !== 'maquila' && (c.quantitat_pollets ?? 0) > 0
  )
  const comandesSexades = comandesPollets.filter(c => c.sexat)
  const demanaSexada = comandesSexades.reduce((s, c) => s + (c.quantitat_pollets ?? 0), 0)

  const idsReservatsRoss = new Set<number>()
  if (demanaSexada > 0) {
    // Carros Ross: A primers (millors), dins de la mateixa qualitat per posta ASC (vells primer)
    const rossDisp = carrosQual
      .filter(x => x.c.lots_reproductores.estirp?.toLowerCase().includes('ross'))
      .sort((a, b) => a.q === b.q
        ? new Date(a.c.posta).getTime() - new Date(b.c.posta).getTime()
        : (a.q === 'A' ? -1 : 1)
      )
    let prevRoss = 0
    for (const x of rossDisp) {
      if (prevRoss >= demanaSexada - 300) break
      idsReservatsRoss.add(x.c.id)
      prevRoss += polletsCarro(x.c)
    }
    if (prevRoss < demanaSexada - 300) {
      avisos.push(
        `⚠️ Sexat: disponibles ~${prevRoss.toLocaleString('ca')} pollets Ross, ` +
        `comanda sexada ${demanaSexada.toLocaleString('ca')}. Podria faltar Ross.`
      )
    }
  }

  // Pool lliure: tots els pollets excepte els Ross reservats per a sexades
  const poolLliure = carrosQual.filter(x => !idsReservatsRoss.has(x.c.id))

  // ── 3. Anticipació §2.5 ───────────────────────────────────────────────────
  let idsEvacuar = new Set<number>()
  if (full.carrega_seguent) {
    idsEvacuar = idsCarrosAEvacuar(poolLliure.map(x => x.c), full.carrega_seguent)
  }

  // ── 4. Demanda per categoria ──────────────────────────────────────────────
  // Exclou les comandes sexades (ja cobertes pels Ross reservats)
  const idsComandesSexades = new Set(comandesSexades.map(c => c.id).filter((id): id is number => id != null))
  const demanaCat = { A: 0, B: 0, C: 0 }
  for (const cmd of comandesPollets) {
    if (cmd.id != null && idsComandesSexades.has(cmd.id)) continue
    const cat = cmd.client?.categoria
    if (!cat || cat === 'M') continue
    const catKey = cat as 'A' | 'B' | 'C'
    demanaCat[catKey] += cmd.quantitat_pollets ?? 0
  }

  // ── 5. Construir calaixos per categoria ───────────────────────────────────
  //
  // Helper: agafa carros d'una llista (agrupats per lot, ordenats per vells primer)
  // fins cobrir `demanda` pollets (finestra [-300, +3000]).
  function agafarFinsCobrirDemanda(candidats: CarroQual[], demanda: number): CarroEstoc[] {
    if (demanda <= 0) return []
    // Agrupar per lot
    const byLot = new Map<number, CarroQual[]>()
    for (const x of candidats) {
      const lid = x.c.lots_reproductores.id
      if (!byLot.has(lid)) byLot.set(lid, [])
      byLot.get(lid)!.push(x)
    }
    // Dins de cada lot: vells primer
    byLot.forEach(cs => cs.sort((a, b) =>
      new Date(a.c.posta + 'T00:00:00').getTime() - new Date(b.c.posta + 'T00:00:00').getTime()
    ))
    // Ordenar lots: posta del primer carro del lot ASC (vells primer)
    const lotsOrdenats = Array.from(byLot.values()).sort(
      (a, b) => new Date(a[0].c.posta + 'T00:00:00').getTime() - new Date(b[0].c.posta + 'T00:00:00').getTime()
    )
    const res: CarroEstoc[] = []
    let prev = 0
    outer: for (const lot of lotsOrdenats) {
      for (const x of lot) {
        const pred = polletsCarro(x.c)
        if (prev >= demanda - 300 && prev + pred > demanda + 3000) break outer
        res.push(x.c)
        prev += pred
      }
    }
    return res
  }

  // Lots classificats
  const lotsC_tot   = poolLliure.filter(x => x.q === 'C')
  const lotsA_norm  = poolLliure.filter(x => x.q === 'A')
  // Explosius: subconjunt dels C (routing a cua MS al dijous, §2.8)
  const lotsC_explosiu = poolLliure.filter(x => x.explosiu)

  // Calaix A: evacuació C (§2.5) al davant + lots A fins cobrir demanaCat.A
  const lotsC_evac = lotsC_tot.filter(x => idsEvacuar.has(x.c.id))
  const calaixA = agafarFinsCobrirDemanda([...lotsC_evac, ...lotsA_norm], demanaCat.A)
  const idsCalaixA = new Set(calaixA.map(c => c.id))

  // Avís anticipació
  if (idsEvacuar.size > 0 && demanaCat.A > 0) {
    const evEnA = lotsC_evac.filter(x => idsCalaixA.has(x.c.id))
    if (evEnA.length > 0) {
      const p = evEnA.reduce((s, x) => s + polletsCarro(x.c), 0)
      avisos.push(
        `ℹ️ Anticipació §2.5: ${evEnA.length} carro(s) C vell(s) al client A ` +
        `(~${p.toLocaleString('ca')} pollets). Lots bons frescos queden a estoc.`
      )
    }
  }
  const polletsPrevA = calaixA.reduce((s, c) => s + polletsCarro(c), 0)
  if (demanaCat.A > 0 && polletsPrevA < demanaCat.A - 300) {
    avisos.push(
      `⚠️ Client A: previsió ${polletsPrevA.toLocaleString('ca')} pollets, ` +
      `comanda ${demanaCat.A.toLocaleString('ca')}.`
    )
  }

  // Calaix C: lots C (al dilluns inclou explosius; al dijous exclou explosius —
  // els explosius van a la cua de la MS via calaixExplosiu)
  const lotsC_perC = diaCarrega === 'dijous'
    ? lotsC_tot.filter(x => !x.explosiu && !idsCalaixA.has(x.c.id))
    : lotsC_tot.filter(x => !idsCalaixA.has(x.c.id))
  const calaixC = agafarFinsCobrirDemanda(lotsC_perC, demanaCat.C)
  const idsCalaixC = new Set(calaixC.map(c => c.id))

  const polletsPrevC = calaixC.reduce((s, c) => s + polletsCarro(c), 0)
  if (demanaCat.C > 0 && polletsPrevC < demanaCat.C - 300) {
    avisos.push(
      `⚠️ Clients C: previsió ${polletsPrevC.toLocaleString('ca')} pollets, ` +
      `comanda ${demanaCat.C.toLocaleString('ca')}.`
    )
  }

  // Calaix B: tot el que sobra (ni A ni C ni explosiu pendents ni Ross sexat)
  const idsUsats = new Set([
    ...Array.from(idsCalaixA),
    ...Array.from(idsCalaixC),
    ...Array.from(idsReservatsRoss),
    ...lotsC_explosiu.filter(x => !idsCalaixA.has(x.c.id) && !idsCalaixC.has(x.c.id)).map(x => x.c.id)
  ])
  const calaixB = poolLliure.filter(x => !idsUsats.has(x.c.id)).map(x => x.c)

  // Explosius pendents (no han entrat als calaixos A/C): cua de MS al dijous
  const calaixExplosiu = lotsC_explosiu
    .filter(x => !idsCalaixA.has(x.c.id) && !idsCalaixC.has(x.c.id))
    .map(x => x.c)

  // Carros Ross reservats per a sexades
  const carrosRossReservats = carrosQual
    .filter(x => idsReservatsRoss.has(x.c.id))
    .map(x => x.c)

  // ── 6. Helper: slots disponibles per incubadora ───────────────────────────
  function slotsDisponibles(incInst: IncInst): { pos: number; zona: ZonaMS | null; costat: 'esq' | 'dre' | 'cap' }[] {
    const inc = incsById.get(incInst.id)
    if (!inc) return []
    const sub = subtipus(inc.tipus, inc.capacitat_carros)
    const ocupatsInst = new Set(
      incInst.carros.filter(c => c.posicio !== null).map(c => `${c.posicio}|${c.zona ?? '-'}`)
    )
    function esDisp(pos: number, zona: ZonaMS | null): boolean {
      const k = keyCell(incInst.id, pos, zona)
      return (!ocupatsInst.has(`${pos}|${zona ?? '-'}`) && !carroPerCellaParam.has(k)) || lliureAviatPerCellaParam.has(k)
    }
    const slots: { pos: number; zona: ZonaMS | null; costat: 'esq' | 'dre' | 'cap' }[] = []
    if (sub === 'SS') {
      for (let p = 1; p <= 24; p++) {
        if (!esDisp(p, null)) continue
        const { col } = ssPosToCell(p)
        slots.push({ pos: p, zona: null, costat: col <= 2 ? 'esq' : 'dre' })
      }
    } else if (sub === 'MSG') {
      for (let p = 1; p <= 4; p++) if (esDisp(p, 'central')) slots.push({ pos: p, zona: 'central', costat: 'esq' })
      for (let p = 5; p <= 8; p++) if (esDisp(p, 'central')) slots.push({ pos: p, zona: 'central', costat: 'dre' })
    } else {
      // MSP: llibertat total
      const zonesPreferides: ZonaMS[] = ['central', 'paret', 'pulsator']
      for (const z of zonesPreferides) {
        for (let p = 1; p <= 2; p++) if (esDisp(p, z)) slots.push({ pos: p, zona: z, costat: 'esq' })
        for (let p = 3; p <= 4; p++) if (esDisp(p, z)) slots.push({ pos: p, zona: z, costat: 'dre' })
      }
    }
    return slots
  }

  // ── 7. Ordre d'incubadores per dia ────────────────────────────────────────
  let ordreIncs: number[]
  if (diaCarrega === 'dijous') {
    const ssInsts = estatInstParam.incubadores
      .filter(ii => { const inc = incsById.get(ii.id); return inc && subtipus(inc.tipus, inc.capacitat_carros) === 'SS' })
      .sort((a, b) => slotsDisponibles(b).length - slotsDisponibles(a).length)
    ordreIncs = [...ssInsts.map(ii => incsById.get(ii.id)!.numero), 1, 2, 8]
  } else {
    ordreIncs = [3, 4, 5, 6, 9, 10, 8]
  }

  // ── 7b. Reserva de places per a la maquila ────────────────────────────────
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
  const maxNormsMS = Math.max(0, totalMSSlots - maquilaOrd.length - calaixExplosiu.length)

  // ── 8. Construir poolSS i poolMS ──────────────────────────────────────────
  let poolSS: CarroEstoc[] = []
  let poolMS: CarroEstoc[]

  if (diaCarrega === 'dijous') {
    // DOS FLUXOS (§2.9.4)
    // SS: lots B (Pondex recuperables per XStreamer) + lots C sans (Sanco) fins 24
    // Explosius: DURA mai a SS → cua de MS
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
      // Candidats SS: B (Pondex) + C sans (Sanco sense explosius)
      // Ordenats per setmanes DESC: vells = més calor = §5.1
      const candidatsSS = [...calaixB, ...calaixC]
        .sort((a, b) =>
          setmanesLot(b.lots_reproductores.data_naixement) -
          setmanesLot(a.lots_reproductores.data_naixement)
        )
      poolSS = candidatsSS.slice(0, nSlotsSS)
    }
    const idsSS = new Set(poolSS.map(c => c.id))
    // Pool MS: Ross sexat + A + B no-SS + C no-SS + explosius (cua) + maquila
    const msNormals = [
      ...carrosRossReservats,
      ...calaixA,
      ...calaixB.filter(c => !idsSS.has(c.id)),
      ...calaixC.filter(c => !idsSS.has(c.id))
    ].slice(0, maxNormsMS)
    poolMS = [...msNormals, ...calaixExplosiu, ...maquilaOrd]
  } else {
    // DILLUNS: tot a MS
    // Ordre: [C] + [Ross sexat] + [A] + [B] (llots dolents primer → Inc 3; bons → Inc 4-6)
    // + [explosius cua si n'hi ha] + [maquila]
    const msNormals = [
      ...calaixC,
      ...carrosRossReservats,
      ...calaixA,
      ...calaixB
    ].slice(0, maxNormsMS)
    poolMS = [...msNormals, ...calaixExplosiu, ...maquilaOrd]
  }

  // ── 9. Assignació a incubadores ───────────────────────────────────────────
  const ordreIncsFiltrat = incsFiltrades.size > 0
    ? ordreIncs.filter(n => { const inc = incByNumero.get(n); return inc && incsFiltrades.has(inc.id) })
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
      // SS: menys calor futura → posicions centrals (9-16); més calor → paret/pulsator (§5.1)
      const carrosAquiSS = poolSS.filter(c => !assignats.has(c.id))
      if (carrosAquiSS.length === 0) continue

      const ambCalor = carrosAquiSS.map(c => ({
        c,
        calor: calorFuturaCarro(c.quantitat_ous, setmanesLot(c.lots_reproductores.data_naixement), 0)
      }))

      const slotsSSOrds = [...slots].sort((a, b) => {
        const ord = (p: number) => p >= 9 && p <= 16 ? 0 : p >= 1 && p <= 8 ? 1 : 2
        if (ord(a.pos) !== ord(b.pos)) return ord(a.pos) - ord(b.pos)
        const costatOrd = (p: number) => { const { col } = ssPosToCell(p); return col <= 2 ? 0 : 1 }
        if (costatOrd(a.pos) !== costatOrd(b.pos)) return costatOrd(a.pos) - costatOrd(b.pos)
        return a.pos - b.pos
      })

      // Menys calor → centrals (posicions ja estan ordenades centrals-primer)
      ambCalor.sort((a, b) => a.calor - b.calor)
      const n = Math.min(ambCalor.length, slotsSSOrds.length)
      for (let i = 0; i < n; i++) {
        resultat.set(ambCalor[i].c.id, { incId: incInst.id, pos: slotsSSOrds[i].pos, zona: null })
        assignats.add(ambCalor[i].c.id)
      }

    } else {
      // MS: ompliment CONSECUTIU sense forats (§3.4)
      // L'ordre del pool garanteix lot-junt i l'ordre pel client (§4.2, §2.9)
      const carrosAquiMS = poolMS.filter(c => !assignats.has(c.id))
      if (carrosAquiMS.length === 0) continue

      const ordreZona = (z: ZonaMS | null): number => z === 'central' ? 0 : z === 'paret' ? 1 : 2
      const ordreCostat = (c: 'esq' | 'dre' | 'cap'): number => c === 'esq' ? 0 : c === 'dre' ? 1 : 2
      const slotSeqAll = [...slots].sort((a, b) => {
        const dz = ordreZona(a.zona) - ordreZona(b.zona)
        if (dz !== 0) return dz
        const dc = ordreCostat(a.costat) - ordreCostat(b.costat)
        if (dc !== 0) return dc
        return a.pos - b.pos
      })
      // MSP: màxim 4 carros nous per càrrega
      const slotSeq = sub === 'MSP' ? slotSeqAll.slice(0, 4) : slotSeqAll

      let k = 0
      for (const slot of slotSeq) {
        if (k >= carrosAquiMS.length) break
        resultat.set(carrosAquiMS[k].id, { incId: incInst.id, pos: slot.pos, zona: slot.zona })
        assignats.add(carrosAquiMS[k].id)
        k++
      }
    }
  }

  return { assignacions: resultat, avisos }
}
