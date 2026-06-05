'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { calcularNaixement, formatData } from '@/lib/dates'

interface ExpedicioLot {
  id: number
  pollets: number
  lots_reproductores: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: { granja: string; nom_informal: string | null }
  }
}

interface Expedicio {
  id: number
  ordre: number | null
  pollets_comanda: number | null
  pollets_servits: number | null
  hora_prevista_naixement: string | null
  num_viatge: number | null
  comandes: { tipus: string; clients: { nom: string } }
  destinacions: { nom_granja: string; nau: string | null }
  transportistes: { id: number; nom: string } | null
  expedicio_lots: ExpedicioLot[]
  expedicio_vacunes: { vacuna_id: number; vacunes: { nom: string } }[]
  sexe: string | null
  grup_sexat_id: string | null
}

interface Assignacio {
  es_maquila: boolean
  carros_estoc: {
    quantitat_ous: number
    lots_reproductores: { id: number; estirp: string | null; granges_reproductores: { granja: string; nom_informal: string | null } }
  }
  transferencies: {
    ous_fertils_vacunats: number
    resultats_naix: { id: number; pollets_nascuts: number }[]
  }[]
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  distribucio_carros: DistribucioSaved | null
  assignacions: Assignacio[]
}

type DistribucioSaved = Record<string, {
  alcada: number
  pollets_caixa: number
  nom_transportista: string
  num_viatge: number
  transportista_id: number
  alcades_barrejades?: boolean
  resum_alcades?: Record<number, number>
  per_expedicio: Record<string, {
    carros_sencers: number
    pico_caixes: number
    pollets_reals: number
    diferencia: number
    en_carro_compartit: boolean
    alcades?: number[]
  }>
  carros_compartits: Array<{
    alcada_carro: number
    items: Array<{ expedicio_id: number; client: string; caixes: number }>
  }>
}>

// Formata alçades d'una expedició [12,12,11] → "2×12 + 1×11"
function formatAlcadesExp(alcades: number[] | undefined): string {
  if (!alcades || alcades.length === 0) return ''
  const resum: Record<number, number> = {}
  alcades.forEach(a => { resum[a] = (resum[a] || 0) + 1 })
  return Object.entries(resum)
    .map(([a, n]) => [parseInt(a), n] as [number, number])
    .sort((x, y) => x[0] - y[0])
    .map(([a, n]) => `${n}×${a}`)
    .join(' + ')
}

type ColEntry =
  | { type: 'single'; exp: Expedicio }
  | { type: 'parella'; expM: Expedicio; expF: Expedicio }

function nomDestinacio(d: { nom_granja: string; nau: string | null }) {
  return d.nau ? `${d.nom_granja} ${d.nau}` : d.nom_granja
}

function nomLot(lot: { estirp: string | null; granges_reproductores: { granja: string; nom_informal: string | null } }) {
  const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
  return `${granja}${lot.estirp ? ` ${lot.estirp}` : ''}`
}

export default function ExpedicionsNaixement() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [full, setFull] = useState<Full | null>(null)
  const [expedicions, setExpedicions] = useState<Expedicio[]>([])
  const [loading, setLoading] = useState(true)
  const [expedicioOberta, setExpedicioOberta] = useState<number | null>(null)
  const [guardant, setGuardant] = useState(false)
  const [distribucio, setDistribucio] = useState<DistribucioSaved>({})

  // Helpers per accedir a la distribució d'una expedició
  function getGrupKey(e: Expedicio): string | null {
    if (!e.transportistes || e.num_viatge == null) return null
    return `${e.transportistes.id}_${e.num_viatge}`
  }

  function getDistExp(e: Expedicio) {
    const key = getGrupKey(e)
    if (!key || !distribucio[key]) return null
    return distribucio[key].per_expedicio[String(e.id)] ?? null
  }

  function getDistGrup(e: Expedicio) {
    const key = getGrupKey(e)
    if (!key) return null
    return distribucio[key] ?? null
  }

  function getPolletsRealsOComanda(e: Expedicio) {
    return e.pollets_servits || getDistExp(e)?.pollets_reals || e.pollets_comanda || 0
  }

  const [polletsServits, setPolletsServits] = useState('')
  const [polletsPerLot, setPolletsPerLot] = useState<Record<number, string>>({})

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [fullRes, expRes] = await Promise.all([
      fetch(`/api/carrega/${params.id}`).then(r => r.json()),
      fetch(`/api/carrega/${params.id}/expedicions`).then(r => r.json()),
    ])
    setFull(fullRes)
    setExpedicions(expRes)
    setDistribucio(fullRes?.distribucio_carros || {})
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  useEffect(() => {
    if (!loading && searchParams.get('print') === 'true') {
      // Donem temps a que el navegador renderitzi la taula completament
      setTimeout(() => window.print(), 500)
    }
  }, [loading, searchParams])

  function obrirExpedicio(exp: Expedicio) {
    if (expedicioOberta === exp.id) {
      setExpedicioOberta(null)
      return
    }
    setExpedicioOberta(exp.id)
    setPolletsServits(String(getPolletsRealsOComanda(exp) || ''))
    const lotsExistents: Record<number, string> = {}
    exp.expedicio_lots.forEach(el => {
      lotsExistents[el.lots_reproductores.id] = String(el.pollets)
    })
    setPolletsPerLot(lotsExistents)
  }

  async function guardarExpedicio(exp: Expedicio) {
    setGuardant(true)
    await fetch(`/api/expedicions/${exp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollets_servits: parseInt(polletsServits) || null }),
    })
    for (const el of exp.expedicio_lots) {
      await fetch(`/api/expedicions/${exp.id}/lots`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expedicio_lot_id: el.id }),
      })
    }
    for (const [lot_id, pollets] of Object.entries(polletsPerLot)) {
      const n = parseInt(pollets)
      if (n > 0) {
        await fetch(`/api/expedicions/${exp.id}/lots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lot_id: parseInt(lot_id), pollets: n }),
        })
      }
    }
    setExpedicioOberta(null)
    setGuardant(false)
    carregarDades()
  }

  if (loading || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  // Calcular pollets nascuts, ous entrats i assignats per lot
  const statsPerLot: Record<number, { nom: string; nascuts: number; ousEntrats: number; assignats: number }> = {}
  const resultatsComptats = new Set<number>()

  full.assignacions.forEach(a => {
    const lot = a.carros_estoc.lots_reproductores
    if (!statsPerLot[lot.id]) {
      statsPerLot[lot.id] = { nom: nomLot(lot), nascuts: 0, ousEntrats: 0, assignats: 0 }
    }
    statsPerLot[lot.id].ousEntrats += a.carros_estoc.quantitat_ous
    a.transferencies.forEach(t => {
      t.resultats_naix.forEach(r => {
        if (!resultatsComptats.has(r.id)) {
          resultatsComptats.add(r.id)
          statsPerLot[lot.id].nascuts += r.pollets_nascuts
        }
      })
    })
  })

  expedicions.forEach(e => {
    e.expedicio_lots.forEach(el => {
      const lotId = el.lots_reproductores.id
      if (statsPerLot[lotId]) statsPerLot[lotId].assignats += el.pollets
    })
  })

  // Lots de maquila (ous del client) i expedicions de maquila (granja del client)
  const maquilaLotIds = new Set<number>()
  full.assignacions.forEach(a => {
    if (a.es_maquila) maquilaLotIds.add(a.carros_estoc.lots_reproductores.id)
  })
  const esExpMaquila = (e: Expedicio) => e.comandes?.tipus === 'Maquila'
  // Una cel·la (lot × expedició) ressaltada = pollets d'un lot NOSTRE que van a una granja de maquila
  const esAportacioNostra = (lotId: number, e: Expedicio) => esExpMaquila(e) && !maquilaLotIds.has(lotId)

  const lotsDisponibles = Object.entries(statsPerLot)
  const totalNascuts = Object.values(statsPerLot).reduce((s, l) => s + l.nascuts, 0)
  const totalAssignats = expedicions.reduce((s, e) => s + getPolletsRealsOComanda(e), 0)

  const expedicionsOrdenades = [...expedicions].sort((a, b) => {
    const oA = a.ordre ?? 999
    const oB = b.ordre ?? 999
    return oA - oB
  })

  // Construir columnes: agrupar expedicions de la mateixa parella sexada
  const cols: ColEntry[] = []
  const grupSexatVistos = new Set<string>()
  expedicionsOrdenades.forEach(e => {
    if (e.grup_sexat_id) {
      if (grupSexatVistos.has(e.grup_sexat_id)) return
      grupSexatVistos.add(e.grup_sexat_id)
      const parella = expedicionsOrdenades.filter(x => x.grup_sexat_id === e.grup_sexat_id)
      const expM = parella.find(x => x.sexe === 'M') ?? parella[0]
      const expF = parella.find(x => x.sexe === 'F') ?? parella[1]
      if (expM && expF) {
        cols.push({ type: 'parella', expM, expF })
      } else {
        cols.push({ type: 'single', exp: e })
      }
    } else {
      cols.push({ type: 'single', exp: e })
    }
  })

  const lotIds = Object.keys(statsPerLot).map(Number)



  // Carros compartits que apareixeran a la llegenda
  const carrosCompartitsLlegenda: Array<{
    nom_transportista: string
    num_viatge: number
    carros: DistribucioSaved[string]['carros_compartits']
  }> = []
  const keysVistos = new Set<string>()
  expedicionsOrdenades.forEach(e => {
    const key = getGrupKey(e)
    if (!key || keysVistos.has(key)) return
    const grup = distribucio[key]
    if (!grup) return
    const teCompartits = grup.carros_compartits.some(cc => cc.items.length > 1)
    if (!teCompartits) return
    keysVistos.add(key)
    carrosCompartitsLlegenda.push({
      nom_transportista: grup.nom_transportista,
      num_viatge: grup.num_viatge,
      carros: grup.carros_compartits.filter(cc => cc.items.length > 1),
    })
  })

  const inputStyle = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '0.75rem', color: 'var(--text)', fontSize: '1rem',
    outline: 'none', fontFamily: 'IBM Plex Sans', width: '100%',
  }

  return (
    <>
      <style>{`
        @page { size: landscape; margin: 0; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: Arial, sans-serif; }
          .print-table th, .print-table td { border: 1px solid #999; padding: 4px 6px; text-align: center; }
          .print-table th { background: #f0f0f0; font-weight: bold; }
          .print-table td.lot-nom { text-align: left; font-weight: bold; }
          .print-table tr.total-row td { background: #e8e8e8; font-weight: bold; }
          .print-table tr.dist-row td { background: #f8f4e8; font-size: 9px; }
          .print-table th.maquila-col { background: #ede4f7 !important; }
          .print-table td.cel-aportacio { background: #fde7c8 !important; font-weight: bold; }
          .print-table td.dist-label { text-align: left; font-weight: bold; font-size: 9px; }
          .print-header { font-family: Arial, sans-serif; margin-bottom: 12px; }
          .print-header h2 { font-size: 14px; margin: 0 0 4px 0; }
          .print-header p { font-size: 10px; margin: 0; color: #555; }
          .print-llegenda { font-family: Arial, sans-serif; font-size: 9px; margin-top: 14px; border-top: 1px solid #ccc; padding-top: 6px; }
          .print-llegenda h4 { font-size: 10px; margin: 0 0 4px 0; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      {/* Taula d'impressió (invisible a pantalla) */}
      <div className="print-only" style={{ padding: '1cm' }}>
        <div className="print-header">
          <h2>Repartiment de pollets — Càrrega #{full.num_carrega}</h2>
          <p>
            Càrrega: {formatData(full.carrega)} ·
            Transferència: {full.transferencia ? formatData(full.transferencia) : '—'} ·
            Naixement: {formatData(calcularNaixement(full.carrega))} ·
            Total nascuts: {totalNascuts.toLocaleString()} ·
            Total assignats: {totalAssignats.toLocaleString()}
          </p>
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Ous entrats</th>
              <th>Nascuts</th>
              {cols.map((col) => {
                if (col.type === 'single') {
                  const e = col.exp
                  const distExp = getDistExp(e)
                  const enCompartit = distExp?.en_carro_compartit ?? false
                  return (
                    <th key={e.id} className={esExpMaquila(e) ? 'maquila-col' : undefined}>
                      <div>{nomDestinacio(e.destinacions)}{enCompartit ? ' *' : ''}</div>
                      <div style={{ fontWeight: 'normal', fontSize: '9px' }}>{e.comandes?.clients?.nom}{esExpMaquila(e) ? ' · MAQUILA' : ''}</div>
                      {e.hora_prevista_naixement && <div style={{ fontWeight: 'normal', fontSize: '9px' }}>{e.hora_prevista_naixement}</div>}
                      {e.expedicio_vacunes?.length > 0 && (
                        <div style={{ fontWeight: 'normal', fontSize: '8px', color: '#555', marginTop: '2px' }}>
                          {e.expedicio_vacunes.map(ev => ev.vacunes.nom).join(' · ')}
                        </div>
                      )}
                    </th>
                  )
                } else {
                  const { expM, expF } = col
                  const distM = getDistExp(expM)
                  const distF = getDistExp(expF)
                  const enCompartit = (distM?.en_carro_compartit ?? false) || (distF?.en_carro_compartit ?? false)
                  return (
                    <th key={`par_${expM.id}`} className={esExpMaquila(expM) ? 'maquila-col' : undefined}>
                      <div>{nomDestinacio(expM.destinacions)}{enCompartit ? ' *' : ''}</div>
                      <div style={{ fontWeight: 'normal', fontSize: '9px' }}>{expM.comandes?.clients?.nom}{esExpMaquila(expM) ? ' · MAQUILA' : ''}</div>
                      {expM.hora_prevista_naixement && <div style={{ fontWeight: 'normal', fontSize: '9px' }}>{expM.hora_prevista_naixement}</div>}
                      <div style={{ fontWeight: 600, fontSize: '9px', color: '#333', marginTop: '2px' }}>
                        ♂ {(expM.pollets_comanda || 0).toLocaleString()} · ♀ {(expF.pollets_comanda || 0).toLocaleString()}
                      </div>
                      {expM.expedicio_vacunes?.length > 0 && (
                        <div style={{ fontWeight: 'normal', fontSize: '8px', color: '#555', marginTop: '2px' }}>
                          {expM.expedicio_vacunes.map(ev => ev.vacunes.nom).join(' · ')}
                        </div>
                      )}
                    </th>
                  )
                }
              })}
              <th>Total assignat</th>
              <th>Sobrants</th>
            </tr>
          </thead>
          <tbody>
            {lotIds.map(lotId => {
              const stats = statsPerLot[lotId]
              const totalLot = expedicionsOrdenades.reduce((s, e) => {
                const el = e.expedicio_lots.find(el => el.lots_reproductores.id === lotId)
                return s + (el?.pollets || 0)
              }, 0)
              return (
                <tr key={lotId}>
                  <td className="lot-nom">{stats.nom}{maquilaLotIds.has(lotId) ? ' · maquila' : ''}</td>
                  <td>{stats.ousEntrats.toLocaleString()}</td>
                  <td>{stats.nascuts.toLocaleString()}</td>
                  {cols.map((col) => {
                    if (col.type === 'single') {
                      const el = col.exp.expedicio_lots.find(el => el.lots_reproductores.id === lotId)
                      const aportacio = !!el && el.pollets > 0 && esAportacioNostra(lotId, col.exp)
                      return <td key={col.exp.id} className={aportacio ? 'cel-aportacio' : undefined}>{el ? el.pollets.toLocaleString() : ''}</td>
                    } else {
                      const elM = col.expM.expedicio_lots.find(el => el.lots_reproductores.id === lotId)
                      const elF = col.expF.expedicio_lots.find(el => el.lots_reproductores.id === lotId)
                      const valM = elM?.pollets || 0
                      const valF = elF?.pollets || 0
                      if (valM === 0 && valF === 0) return <td key={`par_${col.expM.id}`}></td>
                      const aportacio = esAportacioNostra(lotId, col.expM)
                      return (
                        <td key={`par_${col.expM.id}`} className={aportacio ? 'cel-aportacio' : undefined}>
                          {valM > 0 && <span>♂ {valM.toLocaleString()}</span>}
                          {valM > 0 && valF > 0 && <br />}
                          {valF > 0 && <span>♀ {valF.toLocaleString()}</span>}
                        </td>
                      )
                    }
                  })}
                  <td>{totalLot > 0 ? totalLot.toLocaleString() : ''}</td>
                  <td>{stats.nascuts - totalLot !== 0 ? (stats.nascuts - totalLot).toLocaleString() : ''}</td>
                </tr>
              )
            })}
            <tr className="total-row">
              <td className="lot-nom">TOTAL</td>
              <td>{Object.values(statsPerLot).reduce((s, l) => s + l.ousEntrats, 0).toLocaleString()}</td>
              <td>{totalNascuts.toLocaleString()}</td>
              {cols.map((col) => {
                if (col.type === 'single') {
                  const e = col.exp
                  return <td key={e.id}>{getPolletsRealsOComanda(e).toLocaleString()}</td>
                } else {
                  const { expM, expF } = col
                  return (
                    <td key={`par_${expM.id}`}>
                      <span>♂ {getPolletsRealsOComanda(expM).toLocaleString()}</span><br />
                      <span>♀ {getPolletsRealsOComanda(expF).toLocaleString()}</span>
                    </td>
                  )
                }
              })}
              <td>{totalAssignats.toLocaleString()}</td>
              <td>{(totalNascuts - totalAssignats).toLocaleString()}</td>
            </tr>
            {/* Fila: Pollets/caixa */}
            <tr className="dist-row">
              <td className="dist-label">Pollets/caixa</td>
              <td></td>
              <td></td>
              {cols.map((col) => {
                const grup = col.type === 'single' ? getDistGrup(col.exp) : getDistGrup(col.expM)
                const key = col.type === 'single' ? col.exp.id : `par_${col.expM.id}`
                return <td key={key}>{grup ? grup.pollets_caixa : '—'}</td>
              })}
              <td></td>
              <td></td>
            </tr>
            {/* Fila: Alçada carro */}
            <tr className="dist-row">
              <td className="dist-label">Alçada carro</td>
              <td></td>
              <td></td>
              {cols.map((col) => {
                const grup = col.type === 'single' ? getDistGrup(col.exp) : getDistGrup(col.expM)
                const key = col.type === 'single' ? col.exp.id : `par_${col.expM.id}`
                if (!grup) return <td key={key}>—</td>
                if (grup.alcades_barrejades) {
                  if (col.type === 'single') {
                    return <td key={key}>{formatAlcadesExp(getDistExp(col.exp)?.alcades) || '—'}</td>
                  }
                  const m = formatAlcadesExp(getDistExp(col.expM)?.alcades)
                  const f = formatAlcadesExp(getDistExp(col.expF)?.alcades)
                  return <td key={key}><span>♂ {m || '—'}</span><br /><span>♀ {f || '—'}</span></td>
                }
                return <td key={key}>{grup.alcada}</td>
              })}
              <td></td>
              <td></td>
            </tr>
            {/* Fila: Distribució */}
            <tr className="dist-row">
              <td className="dist-label">Distribució</td>
              <td></td>
              <td></td>
              {cols.map((col) => {
                const fmt = (d: ReturnType<typeof getDistExp>) => {
                  if (!d) return '—'
                  if (d.pico_caixes === 0) return `${d.carros_sencers}c${d.en_carro_compartit ? ' *' : ''}`
                  return `${d.carros_sencers}c + ${d.pico_caixes}${d.en_carro_compartit ? ' *' : ''}`
                }
                if (col.type === 'single') {
                  return <td key={col.exp.id}>{fmt(getDistExp(col.exp))}</td>
                } else {
                  const { expM, expF } = col
                  return <td key={`par_${expM.id}`}><span>♂ {fmt(getDistExp(expM))}</span><br /><span>♀ {fmt(getDistExp(expF))}</span></td>
                }
              })}
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {/* Llegenda maquila */}
        {(maquilaLotIds.size > 0 || expedicions.some(esExpMaquila)) && (
          <div className="print-llegenda">
            <h4>Maquila</h4>
            <div><span style={{ background: '#ede4f7', padding: '0 6px' }}>Columna maquila</span> = granja del client (ous seus). <span style={{ background: '#fde7c8', padding: '0 6px' }}>Cel·la ressaltada</span> = pollets d&apos;un lot nostre afegits a una granja de maquila.</div>
          </div>
        )}

        {/* Llegenda carros compartits */}
        {carrosCompartitsLlegenda.length > 0 && (
          <div className="print-llegenda">
            <h4>* Carros compartits</h4>
            {carrosCompartitsLlegenda.map((ll, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>
                <strong>{ll.nom_transportista} · Viatge {ll.num_viatge}:</strong>{' '}
                {ll.carros.map((cc, ci) => (
                  <span key={ci}>
                    Carro {ci + 1} ({cc.alcada_carro} cx): {cc.items.map(it => `${it.client} ${it.caixes}cx`).join(' + ')}
                    {ci < ll.carros.length - 1 ? '  |  ' : ''}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pàgina normal (amagada en imprimir) */}
      <div className="no-print bg-bg min-h-full p-4 md:p-6 pb-20">
        <div className="max-w-2xl mx-auto w-full space-y-4 md:space-y-6">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href={`/carrega/${params.id}/expedicions`} className="hidden md:block text-text-dim no-underline text-sm mono hover:text-accent transition-colors">← Expedicions</Link>
              <div>
                <p className="text-accent mono text-[11px] tracking-wider uppercase m-0">Expedicions</p>
                <h1 className="text-xl md:text-2xl font-bold m-0">Repartiment de pollets</h1>
              </div>
            </div>
            <button onClick={() => window.print()} className="w-full md:w-auto px-4 py-2.5 bg-surface border border-border rounded-lg text-text font-bold text-sm cursor-pointer hover:bg-bg transition-colors shadow-sm">
              🖨 Imprimir
            </button>
          </div>

          {/* Comptador viu per lot */}
          <div className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm">
            <div className="text-[11px] mono text-text-dim uppercase tracking-wider mb-3">
              Pollets per lot
            </div>
            <div className="flex flex-col gap-1">
              {lotsDisponibles.map(([lotId, stats]) => {
                const disponibles = stats.nascuts - stats.assignats
                return (
                  <div key={lotId} className="flex justify-between items-center py-1.5 border-b border-border text-sm">
                    <span className="font-semibold text-text flex items-center gap-2">
                      {stats.nom}
                      {maquilaLotIds.has(Number(lotId)) && (
                        <span className="text-[9px] mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 uppercase tracking-wider">
                          Maquila
                        </span>
                      )}
                    </span>
                    <div className="text-right mono text-xs">
                      <span className={disponibles < 0 ? 'text-danger' : disponibles === 0 ? 'text-success' : 'text-accent'}>
                        {disponibles.toLocaleString()} disp.
                      </span>
                      <span className="text-text-dim ml-2">
                        / {stats.nascuts.toLocaleString()} nascuts
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            {lotsDisponibles.length === 0 && (
              <p className="text-text-dim text-xs m-0 py-2">Sense pollets registrats encara</p>
            )}
            <div className="flex justify-between mt-3 text-xs mono pt-2 border-t border-border border-dashed">
              <span className="text-text-dim font-bold">Total assignat</span>
              <span className={`font-bold ${totalAssignats > totalNascuts ? 'text-danger' : 'text-text'}`}>
                {totalAssignats.toLocaleString()} / {totalNascuts.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Llista d'expedicions */}
          <div className="flex flex-col gap-3">
            {expedicions.map(e => {
              const obert = expedicioOberta === e.id
              const tePollets = e.pollets_servits !== null
              const distExp = getDistExp(e)
              const distGrup = getDistGrup(e)
              return (
                <div key={e.id} className={`bg-surface border rounded-xl overflow-hidden shadow-sm transition-colors ${obert ? 'border-accent' : tePollets ? 'border-success' : 'border-border'}`}>
                  <button onClick={() => obrirExpedicio(e)} className="w-full p-4 bg-transparent border-none cursor-pointer text-left flex justify-between items-center hover:bg-bg transition-colors">
                    <div className="flex-1">
                      <div className="font-bold text-[15px] flex items-center gap-2">
                        {nomDestinacio(e.destinacions)}
                        {esExpMaquila(e) && (
                          <span className="text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 uppercase tracking-wider">
                            Maquila
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-dim mono mt-1">
                        {e.comandes?.clients?.nom}
                        {e.hora_prevista_naixement && ` · ${e.hora_prevista_naixement}`}
                        {e.num_viatge != null && e.transportistes && (
                          <span className="text-accent font-bold"> · {e.transportistes.nom} V{e.num_viatge}</span>
                        )}
                      </div>
                      {distExp && distGrup && (
                        <div className="text-[11px] text-text-dim mono mt-1.5">
                          {distGrup.alcades_barrejades
                            ? `${distExp.carros_sencers}c`
                            : `${distExp.carros_sencers}c + ${distExp.pico_caixes} cx pico`}
                          <span className="ml-2 text-text-dim opacity-70">
                            · {distGrup.alcades_barrejades ? `${formatAlcadesExp(distExp.alcades)} cx` : `${distGrup.alcada} cx`} · {distGrup.pollets_caixa} p/cx
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`mono text-sm font-bold ${tePollets ? 'text-success' : 'text-text-dim'}`}>
                        {getPolletsRealsOComanda(e).toLocaleString()}
                      </div>
                      {e.pollets_comanda && e.pollets_servits && e.pollets_servits !== e.pollets_comanda && (
                        <div className="text-[10px] text-text-dim mono mt-0.5 opacity-70">
                          prev. {e.pollets_comanda.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </button>

                  {obert && (
                    <div className="px-4 pb-4 border-t border-border flex flex-col gap-4 pt-4">
                      <div>
                        <div className="text-[10px] mono text-text-dim uppercase tracking-wider mb-2">
                          Pollets servits
                        </div>
                        <input type="number" value={polletsServits} onChange={e => setPolletsServits(e.target.value)} inputMode="numeric" 
                          className="bg-bg border border-border rounded-lg px-3 py-2 text-text text-base w-full outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all" 
                        />
                      </div>

                      {lotsDisponibles.length > 0 && (
                        <div>
                          <div className="text-[10px] mono text-text-dim uppercase tracking-wider mb-2">
                            De quin lot
                          </div>
                          <div className="flex flex-col gap-2">
                            {lotsDisponibles.map(([lotId, stats]) => {
                              const lotIdNum = parseInt(lotId)
                              const valorActual = parseInt(polletsPerLot[lotIdNum] || '0') || 0
                              const jaTenia = e.expedicio_lots.find(el => el.lots_reproductores.id === lotIdNum)?.pollets || 0
                              const assignatsAltres = stats.assignats - jaTenia
                              const disponiblesDinamic = stats.nascuts - assignatsAltres - valorActual
                              const colorDisp = disponiblesDinamic < 0 ? 'text-danger' : disponiblesDinamic === 0 ? 'text-text-dim' : 'text-accent'
                              return (
                                <div key={lotId} className="flex items-center gap-2">
                                  <div className="flex-1 flex flex-col">
                                    <span className="text-sm text-text font-semibold">{stats.nom}</span>
                                    <span className={`text-[11px] mono ${colorDisp}`}>
                                      {disponiblesDinamic.toLocaleString()} disp.
                                    </span>
                                  </div>
                                  <input
                                    type="number"
                                    value={polletsPerLot[lotIdNum] || ''}
                                    onChange={ev => setPolletsPerLot(prev => ({ ...prev, [lotIdNum]: ev.target.value }))}
                                    inputMode="numeric"
                                    placeholder="0"
                                    className="bg-bg border border-border rounded-lg px-3 py-2 text-text text-sm w-28 text-right outline-none focus:border-accent"
                                  />
                                </div>
                              )
                            })}
                          </div>
                          {(() => {
                            const sumaLots = Object.values(polletsPerLot).reduce((s, v) => s + (parseInt(v) || 0), 0)
                            const total = parseInt(polletsServits) || 0
                            if (total === 0 && sumaLots === 0) return null
                            const diff = total - sumaLots
                            let label = ''
                            let color = 'text-text-dim'
                            if (diff > 0) { label = `Falten ${diff.toLocaleString()}`; color = 'text-danger' }
                            else if (diff < 0) { label = `Sobren ${(-diff).toLocaleString()}`; color = 'text-danger' }
                            else { label = '✓ Complet'; color = 'text-success' }
                            return (
                              <div className="mt-3 flex justify-end items-baseline gap-2 pt-2 border-t border-border border-dashed">
                                <span className="text-xs mono text-text-dim">
                                  {sumaLots.toLocaleString()} / {total.toLocaleString()}
                                </span>
                                <span className={`text-sm font-bold ${color}`}>
                                  {label}
                                </span>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      <button onClick={() => guardarExpedicio(e)} disabled={guardant} className={`
                        w-full py-3 border-none rounded-lg font-bold text-base cursor-pointer transition-colors mt-2
                        ${guardant ? 'bg-border text-text-dim' : 'bg-accent text-[#0f1117] hover:bg-accent-dim'}
                      `}>
                        {guardant ? 'Guardant...' : 'Confirmar'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
