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

// Pollets estimats per a un carro. previsio_pct sempre ve calculada pel servidor;
// el fallback (0.82 × 0.88 ≈ 0.72) s'usa si per alguna raó arriba null.
export function polletsCarro(c: CarroEstoc | AssignacioActual['carros_estoc']): number {
  if (c.previsio_pct != null) return Math.round(c.quantitat_ous * c.previsio_pct)
  return Math.round(c.quantitat_ous * 0.72)
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

