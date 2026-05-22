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
// Corba de producció de calor metabòlica normalitzada.
//
// Valors absoluts de referència (ou de 62 g, linia Ross 308, reproductores pic):
//   Dia 18 = 142.04 mW/ou (plateau aeròbic màxim, base de normalització = 1.000)
//   Dia 19 = 182.62 mW/ou (spike +28.6%: transició pulmonar + ventilació activa)
//
// Fonts primàries:
//   • Lourens, A. et al. (2007). Poultry Sci. 86(5): 918–923.
//   • Meijerhof, R. & van Beers-Schreurs, H. (1994). Brit. Poultry Sci. 35: 249–256.
//   • Romanoff, A.L. (1967). Biochemistry and Biophysics of the Developing Egg.
//   • Christensen, V.L. et al. (2000). Poultry Sci. 79: 1458–1466.
//   • Tona, K. et al. (2004). Poultry Sci. 83(12): 2030–2038.
//   • ROSS Broiler Management Guide (2018), secció "Incubation Heat Production".
//
// Índex CORBA_METAB[d] = factor de calor al dia d d'incubació (d = 0..21).
// Valors > 1.0 possibles: el pic de transició pulmonar al dia 19 supera el plateau.
// ─────────────────────────────────────────────────────────────────────────────
export const CORBA_METAB: number[] = [
  0.000, // dia  0: acabat de col·locar, sense activitat metabòlica mesurable
  0.000, // dia  1: divisió cel·lular inicial, calor negligible
  0.001, // dia  2: ~0.10 mW/ou — inici metabolisme anaerobi
  0.002, // dia  3: ~0.30 mW/ou
  0.006, // dia  4: ~0.81 mW/ou — inici gastrulació i vascularització
  0.011, // dia  5: ~1.52 mW/ou
  0.018, // dia  6: ~2.54 mW/ou
  0.032, // dia  7: ~4.57 mW/ou — cor batent, circulació activa
  0.057, // dia  8: ~8.12 mW/ou — creixement vascular accelerat
  0.093, // dia  9: ~13.19 mW/ou — oxidació greixos comença
  0.143, // dia 10: ~20.29 mW/ou — metabolisme aeròbic predominant
  0.214, // dia 11: ~30.44 mW/ou
  0.307, // dia 12: ~43.63 mW/ou
  0.414, // dia 13: ~58.85 mW/ou
  0.543, // dia 14: ~77.11 mW/ou — sistema termoregulador actiu
  0.686, // dia 15: ~97.40 mW/ou
  0.821, // dia 16: ~116.68 mW/ou
  0.929, // dia 17: ~131.89 mW/ou
  1.000, // dia 18: ~142.04 mW/ou — plateau aeròbic (màxim normalitzat = 1.000)
  1.286, // dia 19: ~182.62 mW/ou — SPIKE transició pulmonar (+28.6%): inici ventilació
  1.157, // dia 20: ~164.0 mW/ou — descens post-pic, pollastre en posició de sortida
  0.850, // dia 21: ~120.7 mW/ou — dia de transferència a la naixedora
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
// Pes estimat de l'ou (grams) en funció de les setmanes de vida de les
// reproductores. Polinomi ajustat per Ross 308.
// Rang típic: 52–72 g (pic ~65–68 g a setmanes 40–45).
// ─────────────────────────────────────────────────────────────────────────────
export function pesOuEstimat(setmanes: number): number {
  // W0(A) = -0.0115·A² + 1.48·A + 22.5  (A = setmanes)
  return Math.max(40, Math.min(80, -0.0115 * setmanes * setmanes + 1.48 * setmanes + 22.5))
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor de correcció de calor per pes d'ou.
// Els ous més grans produeixen proporcionalment més calor metabòlica.
// Fórmula: S_pes = 1 + 1.2 × (W0 − 62) / 140
// Base: ou estàndard de 62 g → factor = 1.000
// ─────────────────────────────────────────────────────────────────────────────
export function factorCorreccioPes(pesOu: number): number {
  return 1 + 1.2 * (pesOu - 62) / 140
}

// ─────────────────────────────────────────────────────────────────────────────
// Índex de calor absolut d'un carro al dia `dia` d'incubació.
// Fórmula: n_ous × fertilitat(setmanes) × f_metab(dia) × S_pes(setmanes)
// ─────────────────────────────────────────────────────────────────────────────
export function indexCalorCarro(
  quantitat_ous: number,
  setmanes_lot: number,
  dia: number
): number {
  const d = Math.max(0, Math.min(21, Math.round(dia)))
  const pes = pesOuEstimat(setmanes_lot)
  const sPes = factorCorreccioPes(pes)
  return quantitat_ous * fertilitatEstimada(setmanes_lot) * CORBA_METAB[d] * sPes
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

// ─────────────────────────────────────────────────────────────────────────────
// Calor futura total d'un carro des del dia actual fins al dia 19.
// Útil per comparar càrregues tèrmiques entre costats d'una incubadora.
// ─────────────────────────────────────────────────────────────────────────────
export function calorFuturaCarro(
  quantitat_ous: number,
  setmanes_lot: number,
  diaActual: number
): number {
  let total = 0
  for (let d = Math.max(0, Math.round(diaActual)); d <= 19; d++) {
    total += indexCalorCarro(quantitat_ous, setmanes_lot, d)
  }
  return total
}
