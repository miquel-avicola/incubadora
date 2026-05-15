import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/previsio-comercial?inici=YYYY-MM-DD&setmanes=8
//
// Retorna la matriu de previsió comercial: files = dilluns i dijous + dates
// amb comandes extra, columnes = (client, tipus). Cada cel·la pot ser:
//  - 'real':      comanda confirmada amb full_carrega_id
//  - 'preliminar': comanda sense full_carrega_id encara
//  - 'recurrent': projecció d'una regla setmanal
//  - null:        cel·la buida

type Tipus = 'Pollets' | 'Maquila'
type Origen = 'real' | 'preliminar' | 'recurrent'

interface Cell {
  quantitat: number
  origen: Origen
  comanda_id?: number
}

interface Fila {
  data: string
  dia_setmana: string
  cells: Record<string, Cell>
  total_pollets: number
  total_maquila: number
  total_carros: number
}

interface Columna {
  key: string // `${client_id}_${tipus}`
  client_id: number
  nom_client: string
  tipus: Tipus
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diaSetmanaNom(d: number): string {
  return ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte'][d]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const iniciStr = searchParams.get('inici') || fmtDate(new Date())
  const setmanes = Math.max(1, Math.min(52, parseInt(searchParams.get('setmanes') || '8') || 8))

  const inici = new Date(iniciStr + 'T00:00:00')
  if (isNaN(inici.getTime())) {
    return NextResponse.json({ error: 'Data d\'inici invàlida' }, { status: 400 })
  }
  const fi = new Date(inici)
  fi.setDate(fi.getDate() + setmanes * 7)
  const fiStr = fmtDate(fi)

  // 1. Mitjana pollets/carro recent (últims 90 dies). Si no n'hi ha, fallback 3900.
  const fa90 = new Date()
  fa90.setDate(fa90.getDate() - 90)
  const { data: naixRecents } = await supabase
    .from('resultats_naix')
    .select('pollets_nascuts, naixement')
    .gte('naixement', fmtDate(fa90))
    .not('pollets_nascuts', 'is', null)
  let polletsPerCarro = 3900
  if (naixRecents && naixRecents.length > 0) {
    const suma = naixRecents.reduce((s, r) => s + (r.pollets_nascuts || 0), 0)
    polletsPerCarro = Math.round(suma / naixRecents.length)
  }

  // 2. Comandes al rang, amb data efectiva (data_prevista_naixement o derivada del full)
  const { data: comandes, error: errCo } = await supabase
    .from('comandes')
    .select(`
      id, client_id, tipus, quantitat_pollets, quantitat_ous_maquila,
      data_prevista_naixement, full_carrega_id,
      clients ( nom )
    `)
  if (errCo) return NextResponse.json({ error: errCo.message }, { status: 500 })

  // Per a comandes amb full_carrega_id però sense data_prevista_naixement,
  // necessitem la data del full de càrrega.
  const fullIds = Array.from(new Set((comandes || []).filter(c => c.full_carrega_id != null).map(c => c.full_carrega_id)))
  const fullsMap = new Map<number, string>()
  if (fullIds.length > 0) {
    const { data: fulls } = await supabase
      .from('fulls_carrega')
      .select('id, carrega')
      .in('id', fullIds)
    ;(fulls || []).forEach(f => fullsMap.set(f.id, f.carrega))
  }

  // 3. Regles recurrents actives
  const { data: regles, error: errReg } = await supabase
    .from('previsio_recurrent')
    .select('client_id, dia_setmana, tipus, quantitat, clients ( nom )')
    .eq('actiu', true)
  if (errReg) return NextResponse.json({ error: errReg.message }, { status: 500 })

  // Helper per derivar data efectiva d'una comanda
  function dataEfectivaComanda(co: any): string | null {
    if (co.data_prevista_naixement) return co.data_prevista_naixement
    if (co.full_carrega_id) {
      const carrega = fullsMap.get(co.full_carrega_id)
      if (carrega) {
        const d = new Date(carrega + 'T00:00:00')
        d.setDate(d.getDate() + 21)
        return fmtDate(d)
      }
    }
    return null
  }

  // 4. Generar dilluns (1) i dijous (4) del rang
  const datesGenerades: string[] = []
  const cursor = new Date(inici)
  while (cursor < fi) {
    if (cursor.getDay() === 1 || cursor.getDay() === 4) {
      datesGenerades.push(fmtDate(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  // 5. Afegir dates de comandes al rang que NO siguin dilluns/dijous
  const datesExtra = new Set<string>()
  ;(comandes || []).forEach(co => {
    const d = dataEfectivaComanda(co)
    if (!d) return
    if (d < iniciStr || d >= fiStr) return
    const dia = new Date(d + 'T00:00:00').getDay()
    if (dia !== 1 && dia !== 4) datesExtra.add(d)
  })
  const totesDates = Array.from(new Set([...datesGenerades, ...datesExtra])).sort()

  // 6. Determinar columnes: tots els clients que tenen alguna activitat (regla o comanda)
  const columnesMap = new Map<string, Columna>()
  ;(regles || []).forEach((r: any) => {
    const key = `${r.client_id}_${r.tipus}`
    if (!columnesMap.has(key)) {
      columnesMap.set(key, {
        key, client_id: r.client_id, nom_client: r.clients?.nom || `Client ${r.client_id}`, tipus: r.tipus,
      })
    }
  })
  ;(comandes || []).forEach((co: any) => {
    const d = dataEfectivaComanda(co)
    if (!d || d < iniciStr || d >= fiStr) return
    const key = `${co.client_id}_${co.tipus}`
    if (!columnesMap.has(key)) {
      columnesMap.set(key, {
        key, client_id: co.client_id, nom_client: co.clients?.nom || `Client ${co.client_id}`, tipus: co.tipus,
      })
    }
  })

  // Ordenar columnes: Pollets primer (per nom), després Maquila (per nom)
  const columnes = Array.from(columnesMap.values()).sort((a, b) => {
    if (a.tipus !== b.tipus) return a.tipus === 'Pollets' ? -1 : 1
    return a.nom_client.localeCompare(b.nom_client)
  })

  // 7. Construir files
  const files: Fila[] = totesDates.map(data => {
    const d = new Date(data + 'T00:00:00')
    const diaNum = d.getDay()
    const cells: Record<string, Cell> = {}

    // 7a. Aplicar regles recurrents que coincideixen amb el dia
    ;(regles || []).forEach((r: any) => {
      if (r.dia_setmana !== diaNum) return
      const key = `${r.client_id}_${r.tipus}`
      cells[key] = { quantitat: r.quantitat, origen: 'recurrent' }
    })

    // 7b. Sobreescriure amb comandes reals/preliminars d'aquesta data
    ;(comandes || []).forEach((co: any) => {
      const dCo = dataEfectivaComanda(co)
      if (dCo !== data) return
      const key = `${co.client_id}_${co.tipus}`
      const q = co.tipus === 'Pollets' ? (co.quantitat_pollets || 0) : (co.quantitat_ous_maquila || 0)
      cells[key] = {
        quantitat: q,
        origen: co.full_carrega_id ? 'real' : 'preliminar',
        comanda_id: co.id,
      }
    })

    // 7c. Totals
    let totalPollets = 0
    let totalMaquila = 0
    Object.entries(cells).forEach(([key, cell]) => {
      const col = columnesMap.get(key)
      if (!col) return
      if (col.tipus === 'Pollets') totalPollets += cell.quantitat
      else totalMaquila += cell.quantitat
    })
    const totalCarros = polletsPerCarro > 0 ? Math.round((totalPollets / polletsPerCarro) * 10) / 10 : 0

    return {
      data,
      dia_setmana: diaSetmanaNom(diaNum),
      cells,
      total_pollets: totalPollets,
      total_maquila: totalMaquila,
      total_carros: totalCarros,
    }
  })

  return NextResponse.json({
    rang: { inici: iniciStr, fi: fiStr },
    pollets_per_carro: polletsPerCarro,
    n_naixements_mitjana: naixRecents?.length || 0,
    columnes,
    files,
  })
}
