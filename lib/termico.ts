// ─────────────────────────────────────────────────────────────────────────────
// lib/termico.ts
//
// Funcions de càlcul de l'índex de calor metabòlica embrionària.
// Usades a /instal·lacions (capa visual) i a /assignacions (suggeriment de zona).
//
// Unitats: les funcions retornen índexs relatius sense unitat física (a.u.).
// ─────────────────────────────────────────────────────────────────────────────

export type ZonaMS = 'central' | 'paret' | 'pulsator'

export interface CarroTermic {
  zona: ZonaMS
  quantitat_ous: number
  setmanes_lot: number      // setmanes de vida de les reproductores en el moment de la posta
  dia_incubacio: number     // dia actual dins la incubadora (0 = primer dia, 21 = transferència)
}

// ─────────────────────────────────────────────────────────────────────────────
// Corba de producció de calor metabòlica normalitzada (màxim = 1.0 al dia 18).
//
// Basada en:
//   • Lourens, A. et al. (2007). "Effect of eggshell temperature during
//     incubation on embryo development." Poultry Science 86(5): 918–923.
//   • Tona, K. et al. (2004). "Relationship between broiler breeder age and
//     egg weight effects on embryo development and chick quality." Poultry
//     Science 83(12): 2030–2038.
//   • ROSS Broiler Management Guide (2018), secció "Incubation Heat Production".
//
// Índex CORBA_METAB[d] = factor de calor al dia d d'incubació (d = 0..21).
// ─────────────────────────────────────────────────────────────────────────────
export const CORBA_METAB: number[] = [
  0.00, // dia  0: acabat de col·locar, sense activitat metabòlica mesurable
  0.01, // dia  1
  0.02, // dia  2
  0.04, // dia  3
  0.07, // dia  4: inici gastrulació i vascularització
  0.12, // dia  5
  0.18, // dia  6
  0.26, // dia  7: cor batent, circulació activa
  0.35, // dia  8
  0.45, // dia  9: creixement vascular màxim
  0.55, // dia 10
  0.64, // dia 11
  0.72, // dia 12
  0.79, // dia 13
  0.85, // dia 14: sistema termoregulador del pollastre actiu
  0.90, // dia 15
  0.94, // dia 16
  0.97, // dia 17
  1.00, // dia 18: pic de calor metabòlica (màxim absolut)
  0.97, // dia 19: pollastre completa rotació i prepara sortida
  0.93, // dia 20
  0.88, // dia 21: dia de transferència a la naixedora
]

// ─────────────────────────────────────────────────────────────────────────────
// Fertilitat estimada (fracció 0–1) per setmana de vida de les reproductores.
// Corba típica de pollastre de carn Ross/Cobb (manual tècnic Ross 2018).
// ─────────────────────────────────────────────────────────────────────────────
export function fertilitatEstimada(setmanes: number): number {
  if (setmanes < 24) return 0.75
  if (setmanes < 28) return 0.87
  if (setmanes < 36) return 0.93  // pic de fertilitat (setmana 28–35)
  if (setmanes < 41) return 0.91
  if (setmanes < 46) return 0.87
  if (setmanes < 51) return 0.81
  if (setmanes < 56) return 0.74
  if (setmanes < 61) return 0.65
  return 0.55
}

// ─────────────────────────────────────────────────────────────────────────────
// Índex de calor absolut d'un carro al dia `dia` d'incubació.
// Fórmula: n_ous × fertilitat(setmanes) × f_metab(dia)
// ─────────────────────────────────────────────────────────────────────────────
export function indexCalorCarro(
  quantitat_ous: number,
  setmanes_lot: number,
  dia: number
): number {
  const d = Math.max(0, Math.min(21, Math.round(dia)))
  return quantitat_ous * fertilitatEstimada(setmanes_lot) * CORBA_METAB[d]
}

// ─────────────────────────────────────────────────────────────────────────────
// Projecció de calor per zona per als propers `horizont` dies.
// Retorna per a cada zona un array de (horizont+1) valors de calor.
// Carros que superen el dia 21 no compten (ja han sortit a la naixedora).
// ─────────────────────────────────────────────────────────────────────────────
export function projectarCalorZones(
  carros: CarroTermic[],
  horizont = 21
): Record<ZonaMS, number[]> {
  const zones: ZonaMS[] = ['central', 'paret', 'pulsator']
  const res = {} as Record<ZonaMS, number[]>
  for (const z of zones) {
    res[z] = Array.from({ length: horizont + 1 }, (_, k) =>
      carros
        .filter((c) => c.zona === z)
        .reduce((sum, c) => {
          const diaFutur = c.dia_incubacio + k
          if (diaFutur > 21) return sum
          return sum + indexCalorCarro(c.quantitat_ous, c.setmanes_lot, diaFutur)
        }, 0)
    )
  }
  return res
}

// ─────────────────────────────────────────────────────────────────────────────
// Calor actual (k=0) per zona. Convenient per a la capa visual.
// ─────────────────────────────────────────────────────────────────────────────
export function calorActualPerZona(carros: CarroTermic[]): Record<ZonaMS, number> {
  const proj = projectarCalorZones(carros, 0)
  return { central: proj.central[0], paret: proj.paret[0], pulsator: proj.pulsator[0] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Índex d'equilibri global d'una MS (0 = molt desequilibrada, 1 = perfecte).
// Calculat sobre el perfil projectat a 21 dies.
// Mètrica: 1 − mitjana_dies(max_desviació_relativa)
// ─────────────────────────────────────────────────────────────────────────────
export function indexEquilibri(carros: CarroTermic[]): number {
  if (carros.length === 0) return 1
  const zones: ZonaMS[] = ['central', 'paret', 'pulsator']
  const proj = projectarCalorZones(carros, 21)
  let sumDeseq = 0
  let countDies = 0
  for (let k = 0; k <= 21; k++) {
    const heats = zones.map((z) => proj[z][k])
    const total = heats.reduce((s, h) => s + h, 0)
    if (total === 0) continue
    const avg = total / 3
    const maxDiff = Math.max(...heats.map((h) => Math.abs(h - avg)))
    sumDeseq += maxDiff / total
    countDies++
  }
  if (countDies === 0) return 1
  return Math.max(0, 1 - sumDeseq / countDies)
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggerir la zona òptima per a un nou carro (dia=0) dins d'una MS.
//
// Algoritme greedy: prova cadascuna de les `zonesDisponibles` i tria la que
// minimitza el màxim desequilibri relatiu en tot el perfil de 21 dies futurs.
// ─────────────────────────────────────────────────────────────────────────────
export function suggerirZonaMS(
  carrosActuals: CarroTermic[],
  nouCarro: { quantitat_ous: number; setmanes_lot: number },
  zonesDisponibles: ZonaMS[] = ['central', 'paret', 'pulsator']
): ZonaMS {
  if (zonesDisponibles.length === 0) return 'central'
  if (zonesDisponibles.length === 1) return zonesDisponibles[0]

  const zones: ZonaMS[] = ['central', 'paret', 'pulsator']
  let millorZona: ZonaMS = zonesDisponibles[0]
  let millorScore = Infinity

  for (const z of zonesDisponibles) {
    const carrosAmb: CarroTermic[] = [
      ...carrosActuals,
      { zona: z, quantitat_ous: nouCarro.quantitat_ous, setmanes_lot: nouCarro.setmanes_lot, dia_incubacio: 0 },
    ]
    const proj = projectarCalorZones(carrosAmb, 21)

    let maxDeseq = 0
    for (let k = 0; k <= 21; k++) {
      const heats = zones.map((zz) => proj[zz][k])
      const total = heats.reduce((s, h) => s + h, 0)
      if (total === 0) continue
      const avg = total / 3
      const maxDiff = Math.max(...heats.map((h) => Math.abs(h - avg)))
      const deseq = maxDiff / total
      if (deseq > maxDeseq) maxDeseq = deseq
    }

    if (maxDeseq < millorScore) {
      millorScore = maxDeseq
      millorZona = z
    }
  }

  return millorZona
}
