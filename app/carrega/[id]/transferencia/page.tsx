'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Naixedora {
  id: number
  numero: number
  model: string
  capacitat: number
}

interface AssignacioVacuna {
  id: number
  dosi: number
  vacunes: { id: number; nom: string }
}

interface Transferencia {
  id: number
  ous_explosius: number
  ous_fertils_vacunats: number
  naixedora_id: number
  naixedores: { numero: number }
}

interface Assignacio {
  id: number
  num_carro_full: number
  previsio_naixement: number | null
  carros_estoc: {
    id: number
    posta: string
    quantitat_ous: number
    lots_reproductores: {
      estirp: string | null
      granges_reproductores: { granja: string; nom_informal: string | null }
    }
  }
  incubadores: { numero: number }
  assignacio_vacunes: AssignacioVacuna[]
  transferencies: Transferencia[]
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  assignacions: Assignacio[]
}

interface Previsio {
  pollets_previstos: number
  pct_naixement_previst: number
  eclosio_esperada: number
  font: string
  n_registres: number
}

const FONT_ETIQUETES: Record<string, string> = {
  supabase_setmana_exacta: 'dades recents',
  excel_setmana_exacta: 'històric',
  supabase_finestra_mobil: 'dades recents (finestra)',
  excel_finestra_mobil: 'històric (finestra)',
  mitjana_estirp_tipus: 'mitjana estirp',
  cobb_singlestage_estimat: 'estimació indirecta',
  fallback_constant: 'fallback genèric',
}

export default function Transferencia() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [naixedores, setNaixedores] = useState<Naixedora[]>([])
  const [previsions, setPrevisions] = useState<Record<number, Previsio>>({})
  const [loading, setLoading] = useState(true)
  const [carroObert, setCarroObert] = useState<number | null>(null)
  const [ousExplosius, setOusExplosius] = useState('')
  const [ousFertils, setOusFertils] = useState('')
  const [naixedoraId, setNaixedoraId] = useState('')
  const [guardant, setGuardant] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const carregarPrevisions = useCallback(async (fullData: Full) => {
    const transferenciaIds: number[] = []
    for (const a of fullData.assignacions) {
      for (const t of a.transferencies) transferenciaIds.push(t.id)
    }
    if (transferenciaIds.length === 0) return

    const resultats = await Promise.all(
      transferenciaIds.map(id =>
        fetch(`/api/previsio-post-transferencia?transferencia_id=${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    )
    const map: Record<number, Previsio> = {}
    transferenciaIds.forEach((id, i) => {
      const r = resultats[i]
      if (r && !r.error) map[id] = r
    })
    setPrevisions(map)
  }, [])

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [fullRes, naixedoresRes] = await Promise.all([
      fetch(`/api/carrega/${params.id}`).then(r => r.json()),
      fetch('/api/naixedores').then(r => r.json()),
    ])
    setFull(fullRes)
    setNaixedores(naixedoresRes)
    setLoading(false)
    carregarPrevisions(fullRes)
  }, [params.id, carregarPrevisions])

  useEffect(() => { carregarDades() }, [carregarDades])

  function obrirCarro(assignacioId: number, assignacio: Assignacio) {
    if (carroObert === assignacioId) {
      setCarroObert(null)
      return
    }
    setCarroObert(assignacioId)
    setOusExplosius('')
    setOusFertils(String(assignacio.carros_estoc.quantitat_ous))
    setNaixedoraId('')
    setErrorMsg('')
  }

  async function guardarTransferencia(assignacio: Assignacio) {
    if (!naixedoraId || ousFertils === '') return
    setGuardant(true)
    setErrorMsg('')

    const res = await fetch(`/api/carrega/${params.id}/transferencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignacio_id: assignacio.id,
        naixedora_id: parseInt(naixedoraId),
        ous_explosius: parseInt(ousExplosius) || 0,
        ous_fertils_vacunats: parseInt(ousFertils),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error || 'Error desconegut')
    } else {
      setCarroObert(null)
      carregarDades()
    }
    setGuardant(false)
  }

  async function eliminarTransferencia(transferencia: Transferencia, carroId: number) {
    await fetch(`/api/carrega/${params.id}/transferencia`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferencia_id: transferencia.id, carro_id: carroId }),
    })
    carregarDades()
  }

  if (loading || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  const assignacionsOrdenades = [...full.assignacions].sort((a, b) => a.num_carro_full - b.num_carro_full)
  const transferits = assignacionsOrdenades.filter(a => a.transferencies[0]).length
  const total = assignacionsOrdenades.length

  // Carros ja assignats per naixedora (comptem transferències, no ous)
  const carrosPerNaixedora: Record<number, number> = {}
  for (const a of full.assignacions) {
    for (const t of a.transferencies) {
      if (t.naixedora_id) {
        carrosPerNaixedora[t.naixedora_id] = (carrosPerNaixedora[t.naixedora_id] || 0) + 1
      }
    }
  }
  const naixedoraSeleccionada = naixedores.find(n => n.id === parseInt(naixedoraId))
  const carrosUsats = carrosPerNaixedora[parseInt(naixedoraId)] || 0
  const carrosDisponibles = naixedoraSeleccionada
    ? naixedoraSeleccionada.capacitat - carrosUsats
    : null
  const ousFertilsExcedits = ousFertils !== '' && parseInt(ousFertils) > 4800

  const inputStyle = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '0.6rem 0.75rem', color: 'var(--text)', fontSize: '0.9rem',
    outline: 'none', fontFamily: 'IBM Plex Sans', width: '100%',
  }
  const labelStyle = {
    display: 'block' as const, fontSize: '0.7rem', fontFamily: 'IBM Plex Mono',
    color: 'var(--text-dim)', textTransform: 'uppercase' as const,
    letterSpacing: '0.1em', marginBottom: '0.4rem',
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <Link href={`/carrega/${full.id}`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrrega #{full.num_carrega}</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Transferència</p>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Registrar transferència</h1>
          </div>
        </div>

        {/* Progrés */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Carros transferits</span>
            <span style={{ color: transferits === total ? 'var(--success)' : 'var(--accent)' }}>{transferits} / {total}</span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: '4px', height: '6px' }}>
            <div style={{ background: transferits === total ? 'var(--success)' : 'var(--accent)', borderRadius: '4px', height: '6px', width: `${total > 0 ? (transferits / total) * 100 : 0}%`, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Resum de previsió global */}
        {(() => {
          const previsionsArr = Object.values(previsions)
          if (previsionsArr.length === 0) return null
          const polletsTotals = previsionsArr.reduce((s, p) => s + p.pollets_previstos, 0)
          const ousTotals = assignacionsOrdenades.reduce((s, a) => s + (a.transferencies[0] ? a.carros_estoc.quantitat_ous : 0), 0)
          const pctMitja = ousTotals > 0 ? (polletsTotals / ousTotals) * 100 : 0
          return (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                Previsió actualitzada
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{polletsTotals.toLocaleString()} pollets</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontFamily: 'IBM Plex Mono' }}>{pctMitja.toFixed(1)}% naixement</span>
              </div>
              <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', marginTop: '0.3rem' }}>
                Basat en {previsionsArr.length} de {total} carros transferits
              </div>
            </div>
          )
        })()}

        {/* Llista de carros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {assignacionsOrdenades.map(a => {
            const granja = a.carros_estoc.lots_reproductores.granges_reproductores.nom_informal || a.carros_estoc.lots_reproductores.granges_reproductores.granja
            const estirp = a.carros_estoc.lots_reproductores.estirp
            const obert = carroObert === a.id
            const transferit = a.transferencies.length > 0
            return (
              <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid', borderColor: obert ? 'var(--accent)' : transferit ? 'var(--success)' : 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>

                {/* Capçalera del carro */}
                <button onClick={() => obrirCarro(a.id, a)} style={{
                  width: '100%', padding: '0.75rem 1rem', background: 'transparent',
                  border: 'none', cursor: transferit ? 'default' : 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', color: 'var(--text-dim)', minWidth: '2.5rem' }}>C{a.num_carro_full}</span>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{granja}{estirp ? ` ${estirp}` : ''}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                        Inc.{a.incubadores.numero} · {a.carros_estoc.posta}
                        {a.assignacio_vacunes.length > 0 && (
                          <span style={{ marginLeft: '0.5rem', color: 'var(--success)' }}>
                            · {[...a.assignacio_vacunes].sort((x, y) => x.vacunes.id - y.vacunes.id).map(av => `${av.dosi === 0.5 ? '½' : '1'} ${av.vacunes.nom}`).join(' + ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {transferit ? (
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontFamily: 'IBM Plex Mono' }}>
                          Naix.{a.transferencies[0]!.naixedores.numero} · {a.transferencies[0]!.ous_fertils_vacunats.toLocaleString()} fèrtils
                          {a.transferencies[0]!.ous_explosius > 0 && ` · ${a.transferencies[0]!.ous_explosius} exp.`}
                        </div>
                        {(() => {
                          const p = previsions[a.transferencies[0]!.id]
                          if (!p) return null
                          const previsioInicial = a.previsio_naixement
                          const diff = previsioInicial != null
                            ? (p.pct_naixement_previst - previsioInicial) * 100
                            : null
                          return (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginTop: '0.2rem' }}>
                              Previsió: {p.pollets_previstos.toLocaleString()} pollets ({(p.pct_naixement_previst * 100).toFixed(1)}%)
                              {previsioInicial != null && diff != null && (
                                <span style={{ color: diff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  {' '}({diff >= 0 ? '+' : ''}{diff.toFixed(1)} vs inicial)
                                </span>
                              )}
                              <span style={{ color: 'var(--text-dim)', opacity: 0.7 }}>
                                {' · '}{FONT_ETIQUETES[p.font] ?? p.font}
                              </span>
                            </div>
                          )
                        })()}
                        <button onClick={e => { e.stopPropagation(); eliminarTransferencia(a.transferencies[0]!, a.carros_estoc.id) }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono' }}>
                          desfer
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: obert ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                        {obert ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </button>

                {/* Formulari */}
                {obert && !transferit && (
                  <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <div>
                        <label style={labelStyle}>Ous explosius</label>
                        <input type="number" value={ousExplosius} onChange={e => setOusExplosius(e.target.value)}
                          min="0" placeholder="0"
                          style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Ous fèrtils vacunats</label>
                        <input type="number" value={ousFertils} onChange={e => setOusFertils(e.target.value)}
                          min="0"
                          max={4800}
                          style={{ ...inputStyle, borderColor: ousFertilsExcedits ? 'var(--danger)' : undefined }}
                        />
                        {ousFertilsExcedits && (
                          <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--danger)' }}>
                            Màxim: 4.800 ous per carro
                          </div>
                        )}
                      </div>
                    </div>

                    {(parseInt(ousExplosius) || 0) + parseInt(ousFertils || '0') > 0 && (
                      <div style={{ fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
                        Ous clars: {a.carros_estoc.quantitat_ous - (parseInt(ousExplosius) || 0) - (parseInt(ousFertils) || 0)}
                      </div>
                    )}

                    <div>
                      <label style={labelStyle}>Naixedora</label>
                      <select value={naixedoraId} onChange={e => { setNaixedoraId(e.target.value); setErrorMsg('') }} style={inputStyle}>
                        <option value="">Selecciona...</option>
                        {naixedores.map(n => (
                          <option key={n.id} value={n.id}>Naixedora {n.numero} — {n.model} ({n.capacitat.toLocaleString()})</option>
                        ))}
                      </select>
                      {naixedoraSeleccionada && carrosDisponibles !== null && (
                        <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', fontFamily: 'IBM Plex Mono', color: carrosDisponibles <= 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                          Disponible: {carrosDisponibles} / {naixedoraSeleccionada.capacitat} carros
                        </div>
                      )}
                    </div>

                    {errorMsg && (
                      <div style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', background: 'rgba(240,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem' }}>
                        {errorMsg}
                      </div>
                    )}

                    <button onClick={() => guardarTransferencia(a)}
                      disabled={!naixedoraId || ousFertils === '' || guardant || ousFertilsExcedits || carrosDisponibles === 0}
                      style={{
                        padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                        fontFamily: 'IBM Plex Sans', fontSize: '0.9rem', cursor: 'pointer',
                        background: (!naixedoraId || ousFertils === '' || guardant || ousFertilsExcedits || carrosDisponibles === 0) ? 'var(--border)' : 'var(--accent)',
                        color: (!naixedoraId || ousFertils === '' || guardant || ousFertilsExcedits || carrosDisponibles === 0) ? 'var(--text-dim)' : '#0f1117',
                      }}>
                      {guardant ? 'Guardant...' : 'Confirmar transferència'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
