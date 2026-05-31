// Previsió de naixement % (pollets_nascuts / quantitat_ous) per a un carro nou.
//
// MODEL (decidit i validat 2026-05-31, vegeu REGLES_ASSIGNACIO.md §8):
//   La previsió és funció NOMÉS de (estirp, edat en setmanes, tipus_incubadora).
//   - FORMA: corba precalculada a la taula `previsio_corba` (històric Excel suavitzat,
//     decreixement monòton a partir de 40 setm; Singlestage = Multistage + bonus SS).
//   - NIVELL: offset global calibrat amb dades reals post-tall (param previsio_offset_nivell).
//   - MARGE: planificació conservadora (param previsio_marge_seguretat), aplicat NOMÉS a
//     la xifra de planificació (`previsio_conservadora`), no a la previsió central.
//
//   NO s'aplica cap "delta del lot": amb les dades actuals l'historial propi del lot no
//   prediu el naixement un cop fixats estirp+edat+màquina (backtest leave-one-lot-out,
//   correlació ~0). Es reobrirà quan hi hagi força més lots. La maquinària del delta i la
//   cascada de fonts anteriors s'han eliminat (substituïdes per la corba).
//
//   Backtest LOO a nivell de lot: MAE ≈ 3,5 pp (vs ≈ 4,9 pp del fallback pla 0,82).

import { supabase } from '@/lib/supabase'

export type FontPrevisio =
  | 'corba_excel'                  // setmana dins la cobertura de l'històric Excel
  | 'corba_extrapolada'            // setmana fora de cobertura (extrapolació plana)
  | 'corba_estirp_via_ross'        // estirp sense corba pròpia: s'usa la de Ross
  | 'fallback_constant'            // no hi ha corba: constant de seguretat

export interface PrevisioResult {
  previsio: number
  font: FontPrevisio
  n_registres: number
  estirp: string
  setmanes: number
  tipus_incubadora: string
  detalls?: Record<string, unknown>
}

export interface ParametresPrevisio {
  naixement_fallback: number     // constant si no hi ha res a la corba
  offset_nivell: number          // calibratge de nivell (pp, en fracció) sobre la forma Excel
  marge_seguretat: number        // marge conservador per a planificació (fracció)
  setmana_min: number            // límit inferior de la corba (clamp)
  setmana_max: number            // límit superior de la corba (clamp)
}

export async function llegirParametresPrevisio(): Promise<ParametresPrevisio> {
  const { data, error } = await supabase
    .from('parametres')
    .select('clau, valor')
    .in('clau', [
      'naixement_fallback',
      'previsio_offset_nivell',
      'previsio_marge_seguretat',
    ])
  if (error) throw new Error(`Error llegint parametres: ${error.message}`)
  const m = new Map((data ?? []).map((p) => [p.clau, p.valor]))
  return {
    naixement_fallback: Number(m.get('naixement_fallback') ?? '0.82'),
    offset_nivell: Number(m.get('previsio_offset_nivell') ?? '0'),
    marge_seguretat: Number(m.get('previsio_marge_seguretat') ?? '0'),
    setmana_min: 24,
    setmana_max: 66,
  }
}

// ---------------------------------------------------------------------------
// CORBA (cau a memòria a la primera consulta; és una taula petita i estàtica)
// ---------------------------------------------------------------------------

interface CorbaRow { naixement_pct: number; font: string }
let corbaCache: Map<string, CorbaRow> | null = null

function clauCorba(estirp: string, tipus: string, setmanes: number): string {
  return `${estirp}|${tipus}|${setmanes}`
}

async function carregarCorba(): Promise<Map<string, CorbaRow>> {
  if (corbaCache) return corbaCache
  const { data, error } = await supabase
    .from('previsio_corba')
    .select('estirp, tipus_incubadora, setmanes, naixement_pct, font')
  if (error) throw new Error(`Error llegint previsio_corba: ${error.message}`)
  const m = new Map<string, CorbaRow>()
  for (const r of data ?? []) {
    m.set(clauCorba(r.estirp, r.tipus_incubadora, Number(r.setmanes)), {
      naixement_pct: Number(r.naixement_pct),
      font: String(r.font),
    })
  }
  corbaCache = m
  return m
}

/** Permet invalidar la cache (p. ex. després de recalibrar la corba). */
export function invalidarCacheCorba(): void {
  corbaCache = null
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

/**
 * Previsió CENTRAL de naixement per a (estirp, setmanes, tipus).
 * = valor de la corba (forma) + offset de nivell, clampat a [0,1].
 * No aplica marge de seguretat (això és cosa de la planificació).
 */
export async function obtenirNaixementPct(
  estirp: string,
  setmanes: number,
  tipus: string,
  params?: ParametresPrevisio
): Promise<PrevisioResult> {
  const p = params ?? (await llegirParametresPrevisio())
  const corba = await carregarCorba()
  const setm = Math.max(p.setmana_min, Math.min(p.setmana_max, Math.round(setmanes)))

  // 1) corba pròpia de l'estirp
  let row = corba.get(clauCorba(estirp, tipus, setm))
  let font: FontPrevisio | null = null
  let estirpFont = estirp

  if (row) {
    font = row.font.startsWith('extrapolat') ? 'corba_extrapolada' : 'corba_excel'
  } else {
    // 2) estirp sense corba pròpia → fem servir Ross (la sèrie més ben coberta)
    row = corba.get(clauCorba('Ross', tipus, setm))
    if (row) {
      font = 'corba_estirp_via_ross'
      estirpFont = 'Ross'
    }
  }

  if (!row) {
    // 3) res a la corba → constant de seguretat
    return {
      previsio: clamp01(p.naixement_fallback),
      font: 'fallback_constant',
      n_registres: 0,
      estirp, setmanes: setm, tipus_incubadora: tipus,
      detalls: { motiu: 'Cap fila a previsio_corba per estirp/tipus' },
    }
  }

  const previsio = clamp01(row.naixement_pct + p.offset_nivell)
  return {
    previsio: Math.round(previsio * 10000) / 10000,
    font: font!,
    n_registres: 1,
    estirp, setmanes: setm, tipus_incubadora: tipus,
    detalls: {
      corba_forma: row.naixement_pct,
      offset_nivell: p.offset_nivell,
      estirp_corba: estirpFont,
      font_taula: row.font,
    },
  }
}

// ---------------------------------------------------------------------------
// FUNCIÓ FINAL (orquestradora): previsió central + xifra conservadora de planificació
// Es manté la signatura i els camps de l'API anterior per retrocompatibilitat.
// ---------------------------------------------------------------------------

export interface PrevisioFinalResult {
  previsio: number                 // previsió CENTRAL (per mostrar el naixement esperat)
  previsio_conservadora: number    // central − marge (per planificar carros per comanda, §2.9)
  font: FontPrevisio
  referencia_pura: number          // valor de la corba (forma, sense offset ni marge)
  delta_aplicat: number            // sempre 0 (delta del lot eliminat)
  marge_seguretat: number
  n_registres_referencia: number
  n_registres_lot: number          // sempre 0 (sense delta del lot)
  n_registres_descartats: number   // sempre 0
  motiu_delta_no_aplicat?: string
  estirp: string
  setmanes: number
  tipus_incubadora: string
  detalls?: Record<string, unknown>
}

/**
 * Previsió final per a un carro nou. `lot_id` i `data_referencia` es conserven a la
 * signatura per compatibilitat però ja no s'usen (el model no depèn de l'historial del lot).
 */
export async function calcularPrevisioFinal(
  lot_id: number,
  estirp: string,
  setmanes: number,
  tipus: string,
  data_referencia: string,
  params?: ParametresPrevisio
): Promise<PrevisioFinalResult> {
  const p = params ?? (await llegirParametresPrevisio())
  const ref = await obtenirNaixementPct(estirp, setmanes, tipus, p)
  const forma = (ref.detalls?.corba_forma as number | undefined) ?? ref.previsio

  return {
    previsio: ref.previsio,
    previsio_conservadora: Math.round(clamp01(ref.previsio - p.marge_seguretat) * 10000) / 10000,
    font: ref.font,
    referencia_pura: forma,
    delta_aplicat: 0,
    marge_seguretat: p.marge_seguretat,
    n_registres_referencia: ref.n_registres,
    n_registres_lot: 0,
    n_registres_descartats: 0,
    motiu_delta_no_aplicat: 'Delta del lot eliminat: sense senyal amb les dades actuals (§8.2)',
    estirp, setmanes: ref.setmanes, tipus_incubadora: tipus,
    detalls: ref.detalls,
  }
}
