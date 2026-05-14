import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ============================================================
// /api/eclosio-referencia
// ------------------------------------------------------------
// Retorna la taxa d'eclosió esperada (pollets nascuts / ous fèrtils)
// per a una combinació (estirp, setmanes_vida, tipus_incubadora),
// fent servir una CASCADA de fonts en ordre de fiabilitat:
//
//   1. Supabase post-tall, setmana exacta
//   2. Excel històric, setmana exacta
//   3. Supabase post-tall, finestra mòbil (setm ± N)
//   4. Excel històric, finestra mòbil (setm ± N)
//   5. Mitjana per (estirp, tipus), totes les fonts
//   6. (Només Cobb Singlestage) Cobb Multistage + offset Ross
//   7. Constant configurable (eclosio_fallback)
//
// Paràmetres rebuts via query string:
//   - estirp (obligatori): "Ross" o "Cobb"
//   - setmanes (obligatori): enter (FLOOR de les setmanes fraccionàries)
//   - tipus (obligatori): "Singlestage" o "Multistage"
// ============================================================

type Font =
  | 'supabase_setmana_exacta'
  | 'excel_setmana_exacta'
  | 'supabase_finestra_mobil'
  | 'excel_finestra_mobil'
  | 'mitjana_estirp_tipus'
  | 'cobb_singlestage_estimat'
  | 'fallback_constant'

interface EclosioResult {
  eclosio: number
  font: Font
  n_registres: number
  estirp: string
  setmanes: number
  tipus_incubadora: string
  detalls?: Record<string, unknown>
}

interface Parametres {
  data_tall_inovo: string
  eclosio_fallback: number
  finestra_mobil_setmanes: number
  minim_registres_finestra: number
}

async function llegirParametres(): Promise<Parametres> {
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

/**
 * Cerca a Supabase post-tall (taula transferencies + resultats_naix) la mitjana
 * d'eclosió per a un rang de setmanes [setm_min, setm_max]. Crida una funció PL/pgSQL
 * `avg_eclosio_supabase` perquè el JOIN entre 5 taules amb FLOOR EXTRACT no és
 * còmode amb el client supabase-js.
 */
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

/**
 * Cascada per a una combinació directa (no Cobb Singlestage).
 * Retorna la primera font que dona resultat amb prou registres.
 */
async function getEclosioCascada(
  estirp: string,
  setmanes: number,
  tipus: string,
  params: Parametres
): Promise<EclosioResult> {
  const r = params.finestra_mobil_setmanes
  const minN = params.minim_registres_finestra
  const setm_min = setmanes - r
  const setm_max = setmanes + r

  // Nivell 1: Supabase post-tall, setmana exacta (qualsevol n >= 1)
  const sup1 = await avgEclosioSupabase(estirp, tipus, setmanes, setmanes, params.data_tall_inovo)
  if (sup1 && sup1.n >= 1) {
    return {
      eclosio: Math.round(sup1.eclos * 10000) / 10000,
      font: 'supabase_setmana_exacta',
      n_registres: sup1.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 2: Excel històric, setmana exacta
  const exc1 = await avgEclosioExcel(estirp, tipus, setmanes, setmanes)
  if (exc1 && exc1.n >= 1) {
    return {
      eclosio: Math.round(exc1.eclos * 10000) / 10000,
      font: 'excel_setmana_exacta',
      n_registres: exc1.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 3: Supabase post-tall, finestra mòbil (n >= minim)
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

  // Nivell 4: Excel històric, finestra mòbil
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

  // Nivell 5: Mitjana global per (estirp, tipus) - només Excel (és la més voluminosa)
  const exc3 = await avgEclosioExcel(estirp, tipus, 0, 100)
  if (exc3 && exc3.n >= 1) {
    return {
      eclosio: Math.round(exc3.eclos * 10000) / 10000,
      font: 'mitjana_estirp_tipus',
      n_registres: exc3.n,
      estirp, setmanes, tipus_incubadora: tipus,
    }
  }

  // Nivell 7: Constant fallback (saltem el 6: només aplica si és Cobb Singlestage,
  // i això ja es gestiona al GET principal abans de cridar aquesta funció)
  return {
    eclosio: params.eclosio_fallback,
    font: 'fallback_constant',
    n_registres: 0,
    estirp, setmanes, tipus_incubadora: tipus,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const estirp = searchParams.get('estirp')
  const setmanesStr = searchParams.get('setmanes')
  const tipus = searchParams.get('tipus')

  if (!estirp || !setmanesStr || !tipus) {
    return NextResponse.json(
      { error: 'Falten paràmetres obligatoris: estirp, setmanes, tipus' },
      { status: 400 }
    )
  }
  if (!['Ross', 'Cobb'].includes(estirp)) {
    return NextResponse.json({ error: `Estirp no reconegut: ${estirp}` }, { status: 400 })
  }
  if (!['Singlestage', 'Multistage'].includes(tipus)) {
    return NextResponse.json({ error: `Tipus d'incubadora no reconegut: ${tipus}` }, { status: 400 })
  }
  const setmanes = parseInt(setmanesStr, 10)
  if (isNaN(setmanes) || setmanes < 1 || setmanes > 100) {
    return NextResponse.json({ error: `Setmanes invàlides: ${setmanesStr}` }, { status: 400 })
  }

  try {
    const params = await llegirParametres()

    // Cas especial: Cobb Singlestage no té dades directes a cap font.
    // Càlcul indirecte: eclosio(Cobb, X, Multi) + (eclosio(Ross, X, Single) - eclosio(Ross, X, Multi))
    if (estirp === 'Cobb' && tipus === 'Singlestage') {
      const [cobbMulti, rossSingle, rossMulti] = await Promise.all([
        getEclosioCascada('Cobb', setmanes, 'Multistage', params),
        getEclosioCascada('Ross', setmanes, 'Singlestage', params),
        getEclosioCascada('Ross', setmanes, 'Multistage', params),
      ])
      const offset = rossSingle.eclosio - rossMulti.eclosio
      const eclosio_final = Math.max(0, Math.min(1, cobbMulti.eclosio + offset))
      return NextResponse.json({
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
      } satisfies EclosioResult)
    }

    const result = await getEclosioCascada(estirp, setmanes, tipus, params)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error intern' }, { status: 500 })
  }
}
