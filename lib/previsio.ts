// Lògica de previsió de naixement % amb cascada de fonts + correcció per historial del lot.
// Paral·lela a lib/eclosio.ts però sobre naixement_pct (pollets_nascuts / quantitat_ous),
// no sobre eclosió (pollets_nascuts / ous_fertils_vacunats).
//
// Aquesta cascada substitueix la consulta original a `previsio_referencia` perquè
// estratifica per tipus d'incubadora i evita l'offset hardcoded +4% Singlestage.

import { supabase } from '@/lib/supabase'

export type FontPrevisio =
  | 'supabase_setmana_exacta'
  | 'excel_setmana_exacta'
  | 'supabase_finestra_mobil'
  | 'excel_finestra_mobil'
  | 'mitjana_estirp_tipus'
  | 'cobb_singlestage_estimat'
  | 'fallback_constant'

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
  data_tall_inovo: string
  naixement_fallback: number
  finestra_mobil_setmanes: number
  minim_registres_finestra: number
  delta_lot_actiu: boolean
  delta_lot_d_recencia_dies: number
  delta_lot_llindar_outlier_pp: number
  delta_lot_min_registres: number
}

export async function llegirParametresPrevisio(): Promise<ParametresPrevisio> {
  const { data, error } = await supabase
    .from('parametres')
    .select('clau, valor')
    .in('clau', [
      'data_tall_inovo',
      'naixement_fallback',
      'finestra_mobil_setmanes',
      'minim_registres_finestra',
      'delta_lot_actiu',
      'delta_lot_d_recencia_dies',
      'delta_lot_llindar_outlier_pp',
      'delta_lot_min_registres',
    ])
  if (error) throw new Error(`Error llegint parametres: ${error.message}`)
  const m = new Map((data ?? []).map((p) => [p.clau, p.valor]))
  return {
    data_tall_inovo: m.get('data_tall_inovo') ?? '2026-05-11',
    naixement_fallback: Number(m.get('naixement_fallback') ?? '0.82'),
    finestra_mobil_setmanes: Number(m.get('finestra_mobil_setmanes') ?? '2'),
    minim_registres_finestra: Number(m.get('minim_registres_finestra') ?? '5'),
    delta_lot_actiu: (m.get('delta_lot_actiu') ?? 'false').toLowerCase() === 'true',
    delta_lot_d_recencia_dies: Number(m.get('delta_lot_d_recencia_dies') ?? '60'),
    delta_lot_llindar_outlier_pp: Number(m.get('delta_lot_llindar_outlier_pp') ?? '15'),
    delta_lot_min_registres: Number(m.get('delta_lot_min_registres') ?? '2'),
  }
}

async function avgNaixementSupabase(
  estirp: string, tipus: string, setm_min: number, setm_max: number, data_tall: string
): Promise<{ naix: number; n: number } | null> {
  const { data, error } = await supabase.rpc('avg_naixement_supabase', {
    p_estirp: estirp,
    p_tipus: tipus,
    p_setm_min: setm_min,
    p_setm_max: setm_max,
    p_data_tall: data_tall,
  })
  if (error || !data || (data as any[]).length === 0) return null
  const row = (data as any[])[0]
  if (!row || row.n == null || row.n === 0) return null
  return { naix: Number(row.naix), n: Number(row.n) }
}

async function avgNaixementExcel(
  estirp: string, tipus: string, setm_min: number, setm_max: number
): Promise<{ naix: number; n: number } | null> {
  const { data, error } = await supabase
    .from('eclosio_historic')
    .select('naixement_pct')
    .eq('estirp', estirp)
    .eq('tipus_incubadora', tipus)
    .gte('setmanes_vida', setm_min)
    .lte('setmanes_vida', setm_max)
  if (error || !data || data.length === 0) return null
  const naix = data.reduce((s, r) => s + Number(r.naixement_pct), 0) / data.length
  return { naix, n: data.length }
}

async function getPrevisioCascadaDirecta(
  estirp: string,
  setmanes: number,
  tipus: string,
  params: ParametresPrevisio
): Promise<PrevisioResult> {
  const r = params.finestra_mobil_setmanes
  const minN = params.minim_registres_finestra
  const setm_min = setmanes - r
  const setm_max = setmanes + r

  // Nivell 1: Supabase post-tall, setmana exacta
  const sup1 = await avgNaixementSupabase(estirp, tipus, setmanes, setmanes, params.data_tall_inovo)
  if (sup1 && sup1.n >= 1) {
    return {
      previsio: Math.round(sup1.naix * 10000) / 10000,
      font: 'supabase_setmana_exacta',
      n_registres: sup1.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 2: Excel, setmana exacta
  const exc1 = await avgNaixementExcel(estirp, tipus, setmanes, setmanes)
  if (exc1 && exc1.n >= 1) {
    return {
      previsio: Math.round(exc1.naix * 10000) / 10000,
      font: 'excel_setmana_exacta',
      n_registres: exc1.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 3: Supabase, finestra mòbil
  const sup2 = await avgNaixementSupabase(estirp, tipus, setm_min, setm_max, params.data_tall_inovo)
  if (sup2 && sup2.n >= minN) {
    return {
      previsio: Math.round(sup2.naix * 10000) / 10000,
      font: 'supabase_finestra_mobil',
      n_registres: sup2.n,
      estirp, setmanes, tipus_incubadora: tipus,
      detalls: { finestra: `${setm_min}-${setm_max}` },
    }
  }

  // Nivell 4: Excel, finestra mòbil
  const exc2 = await avgNaixementExcel(estirp, tipus, setm_min, setm_max)
  if (exc2 && exc2.n >= minN) {
    return {
      previsio: Math.round(exc2.naix * 10000) / 10000,
      font: 'excel_finestra_mobil',
      n_registres: exc2.n,
      estirp, setmanes, tipus_incubadora: tipus,
      detalls: { finestra: `${setm_min}-${setm_max}` },
    }
  }

  // Nivell 5: Mitjana global Excel per (estirp, tipus)
  const exc3 = await avgNaixementExcel(estirp, tipus, 0, 100)
  if (exc3 && exc3.n >= 1) {
    return {
      previsio: Math.round(exc3.naix * 10000) / 10000,
      font: 'mitjana_estirp_tipus',
      n_registres: exc3.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 7: Constant fallback
  return {
    previsio: params.naixement_fallback,
    font: 'fallback_constant',
    n_registres: 0,
    estirp, setmanes, tipus_incubadora: tipus,
  }
}

/**
 * Funció principal: obté la previsió de naixement % per a una combinació.
 * Gestiona el cas especial Cobb Singlestage internament amb la mateixa fórmula
 * derivada que la cascada d'eclosió:
 *   naixement(Cobb,X,Single) ≈ naixement(Cobb,X,Multi) + [naixement(Ross,X,Single) − naixement(Ross,X,Multi)]
 */
export async function obtenirNaixementPct(
  estirp: string,
  setmanes: number,
  tipus: string,
  params?: ParametresPrevisio
): Promise<PrevisioResult> {
  const p = params ?? (await llegirParametresPrevisio())

  if (estirp === 'Cobb' && tipus === 'Singlestage') {
    const [cobbMulti, rossSingle, rossMulti] = await Promise.all([
      getPrevisioCascadaDirecta('Cobb', setmanes, 'Multistage', p),
      getPrevisioCascadaDirecta('Ross', setmanes, 'Singlestage', p),
      getPrevisioCascadaDirecta('Ross', setmanes, 'Multistage', p),
    ])
    const offset = rossSingle.previsio - rossMulti.previsio
    const previsio_final = Math.max(0, Math.min(1, cobbMulti.previsio + offset))
    return {
      previsio: Math.round(previsio_final * 10000) / 10000,
      font: 'cobb_singlestage_estimat',
      n_registres: Math.min(cobbMulti.n_registres, rossSingle.n_registres, rossMulti.n_registres),
      estirp, setmanes, tipus_incubadora: tipus,
      detalls: {
        cobb_multi_previsio: cobbMulti.previsio,
        ross_single_previsio: rossSingle.previsio,
        ross_multi_previsio: rossMulti.previsio,
        offset_singlestage: Math.round(offset * 10000) / 10000,
        font_cobb_multi: cobbMulti.font,
        font_ross_single: rossSingle.font,
        font_ross_multi: rossMulti.font,
        avis: 'Estimació indirecta: no hi ha dades directes de Cobb Singlestage.',
      },
    }
  }

  return getPrevisioCascadaDirecta(estirp, setmanes, tipus, p)
}

// ---------------------------------------------------------------------------
// DELTA DEL LOT
// ---------------------------------------------------------------------------

export interface DeltaLotResult {
  delta: number | null               // null si no s'aplica
  n_valids: number                   // registres després del filtre d'outliers
  n_descartats: number               // registres descartats per outlier
  n_total: number                    // registres trobats abans del filtre
  motiu_no_aplicat?: string          // raó si delta == null
}

interface NaixementPassatLot {
  carro_id: number
  data_naixement: string
  naixement_pct: number
  setmanes_carro: number
  tipus_incubadora: string
  estirp: string
}

async function llegirNaixementsPassatsDelLot(
  lot_id: number, data_referencia: string
): Promise<NaixementPassatLot[]> {
  // Volem tots els carros d'aquest lot que ja tenen naixement registrat
  // amb data anterior a la data de referència (la data de la nova càrrega).
  // Cal travessar la cadena carros_estoc -> transferencies -> resultats_naix.
  const { data, error } = await supabase
    .from('resultats_naix')
    .select(`
      naixement,
      pollets_nascuts,
      transferencia:transferencies!inner (
        assignacio:assignacions!inner (
          incubadora:incubadores!inner (tipus)
        ),
        carro:carros_estoc!inner (
          id,
          posta,
          quantitat_ous,
          lot:lots_reproductores!inner (id, estirp, data_naixement)
        )
      )
    `)
    .lt('naixement', data_referencia)
    .not('naixement', 'is', null)
    .not('pollets_nascuts', 'is', null)

  if (error) throw new Error(`Error llegint naixements del lot: ${error.message}`)
  if (!data) return []

  const result: NaixementPassatLot[] = []
  for (const row of data as any[]) {
    const tr = row.transferencia
    if (!tr) continue
    const carro = tr.carro
    const lot = carro?.lot
    const inc = tr.assignacio?.incubadora
    if (!carro || !lot || !inc) continue
    if (lot.id !== lot_id) continue
    if (!carro.quantitat_ous || carro.quantitat_ous <= 0) continue

    const setmanes = Math.floor(
      (new Date(carro.posta).getTime() - new Date(lot.data_naixement).getTime()) /
      (7 * 24 * 60 * 60 * 1000)
    )

    result.push({
      carro_id: carro.id,
      data_naixement: row.naixement,
      naixement_pct: Number(row.pollets_nascuts) / Number(carro.quantitat_ous),
      setmanes_carro: setmanes,
      tipus_incubadora: inc.tipus,
      estirp: lot.estirp,
    })
  }
  return result
}

/**
 * Calcula el delta del lot per ajustar la referència actual.
 *
 * Per a cada naixement passat del lot:
 *   delta_i = naixement_real_i − referencia(estirp, setmana_del_seu_carro, tipus_d'aquell_carro)
 *
 * Filtra outliers (|delta_i| > llindar_pp/100), pondera per (proximitat × recencia)
 * i retorna la mitjana ponderada.
 *
 * Retorna delta=null si:
 *  - No hi ha prou registres (< delta_lot_min_registres després del filtre).
 *  - O si l'usuari decideix no aplicar-lo per algun motiu.
 */
export async function calcularDeltaLot(
  lot_id: number,
  setmanes_actual: number,
  data_referencia: string, // ISO date (avui o data de la càrrega)
  params: ParametresPrevisio
): Promise<DeltaLotResult> {
  const passats = await llegirNaixementsPassatsDelLot(lot_id, data_referencia)
  const n_total = passats.length

  if (n_total === 0) {
    return { delta: null, n_valids: 0, n_descartats: 0, n_total: 0,
      motiu_no_aplicat: 'Lot sense naixements passats' }
  }

  // Per a cada passat, calcular la referència que tenia en aquell moment
  // (estirp del lot, setmana del seu carro, tipus on va incubar).
  const llindar = params.delta_lot_llindar_outlier_pp / 100
  const D = params.delta_lot_d_recencia_dies
  const tNow = new Date(data_referencia).getTime()

  const deltes_individuals: Array<{
    delta: number
    diff_setmanes: number
    dies_enrere: number
  }> = []
  let n_descartats = 0

  for (const p of passats) {
    const ref = await obtenirNaixementPct(p.estirp, p.setmanes_carro, p.tipus_incubadora, params)
    const delta_i = p.naixement_pct - ref.previsio
    if (Math.abs(delta_i) > llindar) {
      n_descartats += 1
      continue
    }
    const diff_setmanes = setmanes_actual - p.setmanes_carro
    const dies_enrere = Math.max(0,
      (tNow - new Date(p.data_naixement).getTime()) / (24 * 60 * 60 * 1000)
    )
    deltes_individuals.push({ delta: delta_i, diff_setmanes, dies_enrere })
  }

  const n_valids = deltes_individuals.length
  if (n_valids < params.delta_lot_min_registres) {
    return {
      delta: null,
      n_valids,
      n_descartats,
      n_total,
      motiu_no_aplicat: `Només ${n_valids} registres vàlids (mínim requerit: ${params.delta_lot_min_registres})`,
    }
  }

  // Mitjana ponderada amb pes = (1/(1+diff²)) × (1/(1+dies/D))
  let suma_pesos = 0
  let suma_ponderada = 0
  for (const d of deltes_individuals) {
    const w_prox = 1 / (1 + d.diff_setmanes * d.diff_setmanes)
    const w_rec = 1 / (1 + d.dies_enrere / D)
    const w = w_prox * w_rec
    suma_pesos += w
    suma_ponderada += w * d.delta
  }
  const delta_mitja = suma_pesos > 0 ? suma_ponderada / suma_pesos : 0

  return {
    delta: Math.round(delta_mitja * 10000) / 10000,
    n_valids,
    n_descartats,
    n_total,
  }
}

// ---------------------------------------------------------------------------
// FUNCIÓ ORQUESTRADORA: referència + delta del lot
// ---------------------------------------------------------------------------

export interface PrevisioFinalResult {
  previsio: number
  font: FontPrevisio
  referencia_pura: number
  delta_aplicat: number               // 0 si no s'aplica
  n_registres_referencia: number
  n_registres_lot: number
  n_registres_descartats: number
  motiu_delta_no_aplicat?: string
  estirp: string
  setmanes: number
  tipus_incubadora: string
  detalls?: Record<string, unknown>
}

/**
 * Funció final que retorna la previsió de naixement per a un carro nou:
 *   1. Obté la referència actual (cascada per estirp + setmana + tipus).
 *   2. Si la referència no és `fallback_constant`, calcula i aplica el delta del lot.
 *   3. Retorna el resultat clampat a [0, 1].
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

  // Si la referència ja és fallback, no apliquem delta (la base no és fiable)
  if (ref.font === 'fallback_constant') {
    return {
      previsio: ref.previsio,
      font: ref.font,
      referencia_pura: ref.previsio,
      delta_aplicat: 0,
      n_registres_referencia: ref.n_registres,
      n_registres_lot: 0,
      n_registres_descartats: 0,
      motiu_delta_no_aplicat: 'Referència no fiable (fallback_constant)',
      estirp, setmanes, tipus_incubadora: tipus,
      detalls: ref.detalls,
    }
  }

  // Si el delta està desactivat per paràmetre, retornem només la referència.
  // La validació backtested del 15/05/2026 amb 85 punts va mostrar que el delta
  // empitjorava marginalment (3.06% → 3.28% error mig). Revalidar amb més dades.
  if (!p.delta_lot_actiu) {
    return {
      previsio: ref.previsio,
      font: ref.font,
      referencia_pura: ref.previsio,
      delta_aplicat: 0,
      n_registres_referencia: ref.n_registres,
      n_registres_lot: 0,
      n_registres_descartats: 0,
      motiu_delta_no_aplicat: 'Delta del lot desactivat per paràmetre',
      estirp, setmanes, tipus_incubadora: tipus,
      detalls: ref.detalls,
    }
  }

  const deltaRes = await calcularDeltaLot(lot_id, setmanes, data_referencia, p)
  const delta = deltaRes.delta ?? 0
  const previsio_final = Math.max(0, Math.min(1, ref.previsio + delta))

  return {
    previsio: Math.round(previsio_final * 10000) / 10000,
    font: ref.font,
    referencia_pura: ref.previsio,
    delta_aplicat: delta,
    n_registres_referencia: ref.n_registres,
    n_registres_lot: deltaRes.n_valids,
    n_registres_descartats: deltaRes.n_descartats,
    motiu_delta_no_aplicat: deltaRes.motiu_no_aplicat,
    estirp, setmanes, tipus_incubadora: tipus,
    detalls: ref.detalls,
  }
}
