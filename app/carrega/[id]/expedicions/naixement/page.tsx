'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

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
  comandes: { clients: { nom: string } }
  destinacions: { nom_granja: string; nau: string | null }
  transportistes: { id: number; nom: string } | null
  expedicio_lots: ExpedicioLot[]
  expedicio_vacunes: { vacuna_id: number; vacunes: { nom: string } }[]
}

interface Assignacio {
  carros_estoc: {
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
  assignacions: Assignacio[]
}

type DistribucioSaved = Record<string, {
  alcada: number
  pollets_caixa: number
  nom_transportista: string
  num_viatge: number
  transportista_id: number
  per_expedicio: Record<string, {
    carros_sencers: number
    pico_caixes: number
    pollets_reals: number
    diferencia: number
    en_carro_compartit: boolean
  }>
  carros_compartits: Array<{
    alcada_carro: number
    items: Array<{ expedicio_id: number; client: string; caixes: number }>
  }>
}>

function nomDestinacio(d: { nom_granja: string; nau: string | null }) {
  return d.nau ? `${d.nom_granja} ${d.nau}` : d.nom_granja
}

function nomLot(lot: { estirp: string | null; granges_reproductores: { granja: string; nom_informal: string | null } }) {
  const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
  return `${granja}${lot.estirp ? ` ${lot.estirp}` : ''}`
}

export default function ExpedicionsNaixement() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [expedicions, setExpedicions] = useState<Expedicio[]>([])
  const [loading, setLoading] = useState(true)
  const [expedicioOberta, setExpedicioOberta] = useState<number | null>(null)
  const [guardant, setGuardant] = useState(false)
  const [distribucio, setDistribucio] = useState<DistribucioSaved>({})

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
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  useEffect(() => {
    if (!params.id) return
    try {
      const raw = localStorage.getItem(`mav_dist_${params.id}`)
      if (raw) setDistribucio(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [params.id])

  function obrirExpedicio(exp: Expedicio) {
    if (expedicioOberta === exp.id) {
      setExpedicioOberta(null)
      return
    }
    setExpedicioOberta(exp.id)
    setPolletsServits(String(exp.pollets_servits || exp.pollets_comanda || ''))
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

  // Calcular pollets nascuts i assignats per lot
  const statsPerLot: Record<number, { nom: string; nascuts: number; assignats: number }> = {}
  const resultatsComptats = new Set<number>()

  full.assignacions.forEach(a => {
    const lot = a.carros_estoc.lots_reproductores
    if (!statsPerLot[lot.id]) {
      statsPerLot[lot.id] = { nom: nomLot(lot), nascuts: 0, assignats: 0 }
    }
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

  const lotsDisponibles = Object.entries(statsPerLot)
  const totalNascuts = Object.values(statsPerLot).reduce((s, l) => s + l.nascuts, 0)
  const totalAssignats = expedicions.reduce((s, e) => s + (e.pollets_servits || e.pollets_comanda || 0), 0)

  const expedicionsOrdenades = [...expedicions].sort((a, b) => {
    const clientA = a.comandes?.clients?.nom || ''
    const clientB = b.comandes?.clients?.nom || ''
    if (clientA !== clientB) return clientA.localeCompare(clientB)
    const horaA = a.hora_prevista_naixement || '99:99'
    const horaB = b.hora_prevista_naixement || '99:99'
    return horaA.localeCompare(horaB)
  })

  const lotIds = Object.keys(statsPerLot).map(Number)

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
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: Arial, sans-serif; }
          .print-table th, .print-table td { border: 1px solid #999; padding: 4px 6px; text-align: center; }
          .print-table th { background: #f0f0f0; font-weight: bold; }
          .print-table td.lot-nom { text-align: left; font-weight: bold; }
          .print-table tr.total-row td { background: #e8e8e8; font-weight: bold; }
          .print-table tr.dist-row td { background: #f8f4e8; font-size: 9px; }
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
          <p>Data càrrega: {full.carrega} · Total nascuts: {totalNascuts.toLocaleString()} · Total assignats: {totalAssignats.toLocaleString()}</p>
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Lot</th>
              <th>Nascuts</th>
              {expedicionsOrdenades.map(e => {
                const distExp = getDistExp(e)
                const enCompartit = distExp?.en_carro_compartit ?? false
                return (
                  <th key={e.id}>
                    <div>{nomDestinacio(e.destinacions)}{enCompartit ? ' *' : ''}</div>
                    <div style={{ fontWeight: 'normal', fontSize: '9px' }}>{e.comandes?.clients?.nom}</div>
                    {e.hora_prevista_naixement && <div style={{ fontWeight: 'normal', fontSize: '9px' }}>{e.hora_prevista_naixement}</div>}
                    {e.expedicio_vacunes?.length > 0 && (
                      <div style={{ fontWeight: 'normal', fontSize: '8px', color: '#555', marginTop: '2px' }}>
                        {e.expedicio_vacunes.map(ev => ev.vacunes.nom).join(' · ')}
                      </div>
                    )}
                  </th>
                )
              })}
              <th>Total assignat</th>
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
                  <td className="lot-nom">{stats.nom}</td>
                  <td>{stats.nascuts.toLocaleString()}</td>
                  {expedicionsOrdenades.map(e => {
                    const el = e.expedicio_lots.find(el => el.lots_reproductores.id === lotId)
                    return <td key={e.id}>{el ? el.pollets.toLocaleString() : ''}</td>
                  })}
                  <td>{totalLot > 0 ? totalLot.toLocaleString() : ''}</td>
                </tr>
              )
            })}
            <tr className="total-row">
              <td className="lot-nom">TOTAL</td>
              <td>{totalNascuts.toLocaleString()}</td>
              {expedicionsOrdenades.map(e => (
                <td key={e.id}>{(e.pollets_servits || e.pollets_comanda || 0).toLocaleString()}</td>
              ))}
              <td>{totalAssignats.toLocaleString()}</td>
            </tr>
            {/* Fila: Pollets/caixa */}
            <tr className="dist-row">
              <td className="dist-label">Pollets/caixa</td>
              <td></td>
              {expedicionsOrdenades.map(e => {
                const grup = getDistGrup(e)
                return <td key={e.id}>{grup ? grup.pollets_caixa : '—'}</td>
              })}
              <td></td>
            </tr>
            {/* Fila: Alçada carro */}
            <tr className="dist-row">
              <td className="dist-label">Alçada carro</td>
              <td></td>
              {expedicionsOrdenades.map(e => {
                const grup = getDistGrup(e)
                return <td key={e.id}>{grup ? grup.alcada : '—'}</td>
              })}
              <td></td>
            </tr>
            {/* Fila: Distribució */}
            <tr className="dist-row">
              <td className="dist-label">Distribució</td>
              <td></td>
              {expedicionsOrdenades.map(e => {
                const distExp = getDistExp(e)
                const enCompartit = distExp?.en_carro_compartit ?? false
                const val = distExp
                  ? `${distExp.carros_sencers}c + ${distExp.pico_caixes}${enCompartit ? ' *' : ''}`
                  : '—'
                return <td key={e.id}>{val}</td>
              })}
              <td></td>
            </tr>
          </tbody>
        </table>

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
      <main className="no-print" style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1rem' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href={`/carrega/${params.id}/expedicions`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Expedicions</Link>
              <div>
                <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Dia del naixement</p>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Repartiment final</h1>
              </div>
            </div>
            <button onClick={() => window.print()} style={{
              padding: '0.5rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text)', fontFamily: 'IBM Plex Sans',
              fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600,
            }}>
              🖨 Imprimir
            </button>
          </div>

          {/* Comptador viu per lot */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.875rem 1rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.65rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              Pollets per lot
            </div>
            {lotsDisponibles.map(([lotId, stats]) => {
              const disponibles = stats.nascuts - stats.assignats
              return (
                <div key={lotId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text)' }}>{stats.nom}</span>
                  <div style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem' }}>
                    <span style={{ color: disponibles < 0 ? 'var(--danger)' : disponibles === 0 ? 'var(--success)' : 'var(--accent)' }}>
                      {disponibles.toLocaleString()} disp.
                    </span>
                    <span style={{ color: 'var(--text-dim)', marginLeft: '0.4rem' }}>
                      / {stats.nascuts.toLocaleString()} nascuts
                    </span>
                  </div>
                </div>
              )
            })}
            {lotsDisponibles.length === 0 && (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: 0 }}>Sense pollets registrats encara</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.78rem', fontFamily: 'IBM Plex Mono' }}>
              <span style={{ color: 'var(--text-dim)' }}>Total assignat</span>
              <span style={{ color: totalAssignats > totalNascuts ? 'var(--danger)' : 'var(--text)' }}>
                {totalAssignats.toLocaleString()} / {totalNascuts.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Llista d'expedicions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {expedicions.map(e => {
              const obert = expedicioOberta === e.id
              const tePollets = e.pollets_servits !== null
              const distExp = getDistExp(e)
              const distGrup = getDistGrup(e)
              return (
                <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid', borderColor: obert ? 'var(--accent)' : tePollets ? 'var(--success)' : 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <button onClick={() => obrirExpedicio(e)} style={{
                    width: '100%', padding: '0.875rem 1rem', background: 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{nomDestinacio(e.destinacions)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginTop: '0.15rem' }}>
                        {e.comandes?.clients?.nom}
                        {e.hora_prevista_naixement && ` · ${e.hora_prevista_naixement}`}
                        {e.num_viatge != null && e.transportistes && (
                          <span style={{ color: 'var(--accent)' }}> · {e.transportistes.nom} V{e.num_viatge}</span>
                        )}
                      </div>
                      {distExp && distGrup && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginTop: '0.2rem' }}>
                          {distExp.carros_sencers}c + {distExp.pico_caixes} cx pico
                          <span style={{ marginLeft: '0.4rem', color: 'var(--text-dim)' }}>
                            · {distGrup.alcada} cx · {distGrup.pollets_caixa} p/cx
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.88rem', fontWeight: 700, color: tePollets ? 'var(--success)' : 'var(--text-dim)' }}>
                        {(e.pollets_servits ?? e.pollets_comanda ?? 0).toLocaleString()}
                      </div>
                      {e.pollets_comanda && e.pollets_servits && e.pollets_servits !== e.pollets_comanda && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                          prev. {e.pollets_comanda.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </button>

                  {obert && (
                    <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                          Pollets servits
                        </div>
                        <input type="number" value={polletsServits} onChange={e => setPolletsServits(e.target.value)} inputMode="numeric" style={inputStyle} />
                      </div>

                      {lotsDisponibles.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.65rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                            De quin lot
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {lotsDisponibles.map(([lotId, stats]) => (
                              <div key={lotId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text)' }}>{stats.nom}</div>
                                <input
                                  type="number"
                                  value={polletsPerLot[parseInt(lotId)] || ''}
                                  onChange={ev => setPolletsPerLot(prev => ({ ...prev, [parseInt(lotId)]: ev.target.value }))}
                                  inputMode="numeric"
                                  placeholder="0"
                                  style={{ ...inputStyle, width: '7rem', textAlign: 'right', fontSize: '0.9rem' }}
                                />
                              </div>
                            ))}
                          </div>
                          {(() => {
                            const sumaLots = Object.values(polletsPerLot).reduce((s, v) => s + (parseInt(v) || 0), 0)
                            const total = parseInt(polletsServits) || 0
                            if (total === 0) return null
                            return (
                              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: sumaLots === total ? 'var(--success)' : 'var(--danger)', textAlign: 'right' }}>
                                {sumaLots.toLocaleString()} / {total.toLocaleString()} assignats per lot
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      <button onClick={() => guardarExpedicio(e)} disabled={guardant} style={{
                        padding: '0.875rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                        fontFamily: 'IBM Plex Sans', fontSize: '1rem', cursor: 'pointer',
                        background: guardant ? 'var(--border)' : 'var(--accent)',
                        color: guardant ? 'var(--text-dim)' : '#0f1117',
                      }}>
                        {guardant ? 'Guardant...' : 'Confirmar'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </>
  )
}
