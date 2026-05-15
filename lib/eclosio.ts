// Lògica de previsió d'eclosió amb cascada de fonts.
// Compartida entre /api/eclosio-referencia (consulta directa)
// i /api/previsio-post-transferencia (consulta interna).

import { supabase } from '@/lib/supabase'

export type FontEclosio =
  | 'supabase_setmana_exacta'
  | 'excel_setmana_exacta'
  | 'supabase_finestra_mobil'
  | 'excel_finestra_mobil'
  | 'mitjana_estirp_tipus'
  | 'cobb_singlestage_estimat'
  | 'fallback_constant'

export interface EclosioResult {
  eclosio: number
  font: FontEclosio
  n_registres: number
  estirp: string
  setmanes: number
  tipus_incubadora: string
  detalls?: Record<string, unknown>
}

export interface ParametresEclosio {
  data_tall_inovo: string
  eclosio_fallback: number
  finestra_mobil_setmanes: number
  minim_registres_finestra: number
}

export async function llegirParametresEclosio(): Promise<ParametresEclosio> {
  const { data, error } = await supabase
    .from('parametres')
    .select('clau, valor')
    .in('clau', [
      'data_tall_inovo',
      'eclosio_fallback',
      'finestra_mobil_setmanes',
      'minim_registres_finestra',
    ])
  if (error) throw new Error(`Error llegint parametres: ${error.message}`)
  const m = new Map((data ?? []).map((p) => [p.clau, p.valor]))
  return {
    data_tall_inovo: m.get('data_tall_inovo') ?? '2026-05-11',
    eclosio_fallback: Number(m.get('eclosio_fallback') ?? '0.90'),
    finestra_mobil_setmanes: Number(m.get('finestra_mobil_setmanes') ?? '2'),
    minim_registres_finestra: Number(m.get('minim_registres_finestra') ?? '5'),
  }
}

async function avgEclosioSupabase(
  estirp: string, tipus: string, setm_min: number, setm_max: number, data_tall: string
): Promise<{ eclos: number; n: number } | null> {
  const { data, error } = await supabase.rpc('avg_eclosio_supabase', {
    p_estirp: estirp,
    p_tipus: tipus,
    p_setm_min: setm_min,
    p_setm_max: setm_max,
    p_data_tall: data_tall,
  })
  if (error || !data || (data as any[]).length === 0) return null
  const row = (data as any[])[0]
  if (!row || row.n == null || row.n === 0) return null
  return { eclos: Number(row.eclos), n: Number(row.n) }
}

async function avgEclosioExcel(
  estirp: string, tipus: string, setm_min: number, setm_max: number
): Promise<{ eclos: number; n: number } | null> {
  const { data, error } = await supabase
    .from('eclosio_historic')
    .select('eclosio')
    .eq('estirp', estirp)
    .eq('tipus_incubadora', tipus)
    .gte('setmanes_vida', setm_min)
    .lte('setmanes_vida', setm_max)
  if (error || !data || data.length === 0) return null
  const eclos = data.reduce((s, r) => s + Number(r.eclosio), 0) / data.length
  return { eclos, n: data.length }
}

async function getEclosioCascadaDirecta(
  estirp: string,
  setmanes: number,
  tipus: string,
  params: ParametresEclosio
): Promise<EclosioResult> {
  const r = params.finestra_mobil_setmanes
  const minN = params.minim_registres_finestra
  const setm_min = setmanes - r
  const setm_max = setmanes + r

  // Nivell 1: Supabase post-tall, setmana exacta
  const sup1 = await avgEclosioSupabase(estirp, tipus, setmanes, setmanes, params.data_tall_inovo)
  if (sup1 && sup1.n >= 1) {
    return {
      eclosio: Math.round(sup1.eclos * 10000) / 10000,
      font: 'supabase_setmana_exacta',
      n_registres: sup1.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 2: Excel, setmana exacta
  const exc1 = await avgEclosioExcel(estirp, tipus, setmanes, setmanes)
  if (exc1 && exc1.n >= 1) {
    return {
      eclosio: Math.round(exc1.eclos * 10000) / 10000,
      font: 'excel_setmana_exacta',
      n_registres: exc1.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 3: Supabase, finestra mòbil
  const sup2 = await avgEclosioSupabase(estirp, tipus, setm_min, setm_max, params.data_tall_inovo)
  if (sup2 && sup2.n >= minN) {
    return {
      eclosio: Math.round(sup2.eclos * 10000) / 10000,
      font: 'supabase_finestra_mobil',
      n_registres: sup2.n,
      estirp, setmanes, tipus_incubadora: tipus,
      detalls: { finestra: `${setm_min}-${setm_max}` },
    }
  }

  // Nivell 4: Excel, finestra mòbil
  const exc2 = await avgEclosioExcel(estirp, tipus, setm_min, setm_max)
  if (exc2 && exc2.n >= minN) {
    return {
      eclosio: Math.round(exc2.eclos * 10000) / 10000,
      font: 'excel_finestra_mobil',
      n_registres: exc2.n,
      estirp, setmanes, tipus_incubadora: tipus,
      detalls: { finestra: `${setm_min}-${setm_max}` },
    }
  }

  // Nivell 5: Mitjana global Excel per (estirp, tipus)
  const exc3 = await avgEclosioExcel(estirp, tipus, 0, 100)
  if (exc3 && exc3.n >= 1) {
    return {
      eclosio: Math.round(exc3.eclos * 10000) / 10000,
      font: 'mitjana_estirp_tipus',
      n_registres: exc3.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 7: Constant fallback
  return {
    eclosio: params.eclosio_fallback,
    font: 'fallback_constant',
    n_registres: 0,
    estirp, setmanes, tipus_incubadora: tipus,
  }
}

/**
 * Funció principal: obté la previsió d'eclosió per a una combinació.
 * Gestiona el cas especial Cobb Singlestage internament.
 */
export async function obtenirEclosio(
  estirp: string,
  setmanes: number,
  tipus: string,
  params?: ParametresEclosio
): Promise<EclosioResult> {
  const p = params ?? (await llegirParametresEclosio())

  if (estirp === 'Cobb' && tipus === 'Singlestage') {
    const [cobbMulti, rossSingle, rossMulti] = await Promise.all([
      getEclosioCascadaDirecta('Cobb', setmanes, 'Multistage', p),
      getEclosioCascadaDirecta('Ross', setmanes, 'Singlestage', p),
      getEclosioCascadaDirecta('Ross', setmanes, 'Multistage', p),
    ])
    const offset = rossSingle.eclosio - rossMulti.eclosio
    const eclosio_final = Math.max(0, Math.min(1, cobbMulti.eclosio + offset))
    return {
      eclosio: Math.round(eclosio_final * 10000) / 10000,
      font: 'cobb_singlestage_estimat',
      n_registres: Math.min(cobbMulti.n_registres, rossSingle.n_registres, rossMulti.n_registres),
      estirp, setmanes, tipus_incubadora: tipus,
      detalls: {
        cobb_multi_eclosio: cobbMulti.eclosio,
        ross_single_eclosio: rossSingle.eclosio,
        ross_multi_eclosio: rossMulti.eclosio,
        offset_singlestage: Math.round(offset * 10000) / 10000,
        font_cobb_multi: cobbMulti.font,
        font_ross_single: rossSingle.font,
        font_ross_multi: rossMulti.font,
        avis: 'Estimació indirecta: no hi ha dades directes de Cobb Singlestage.',
      },
    }
  }

  return getEclosioCascadaDirecta(estirp, setmanes, tipus, p)
}
