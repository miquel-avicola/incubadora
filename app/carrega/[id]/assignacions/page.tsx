'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface CarroEstoc {
  id: number
  posta: string
  quantitat_ous: number
  estat: string
  recepcio: string
  lots_reproductores: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: { granja: string; nom_informal: string | null }
  }
}

interface Incubadora {
  id: number
  numero: number
  model: string
  tipus: string
  capacitat_carros: number
}

interface Assignacio {
  id: number
  num_carro_full: number
  previsio_naixement: number | null
  carros_estoc: { id: number; posta: string; quantitat_ous: number; lots_reproductores: { data_naixement: string; estirp: string | null; granges_reproductores: { granja: string; nom_informal: string | null } } }
  incubadores: { numero: number; model: string; tipus: string }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  assignacions: Assignacio[]
  comandes: { quantitat_pollets: number | null; quantitat_ous_maquila: number | null; tipus: string }[]
}

function nomCarro(carro: CarroEstoc) {
  const lot = carro.lots_reproductores
  const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
  const estirp = lot.estirp ? ` ${lot.estirp}` : ''
  return `${granja}${estirp}`
}

function diesEstoc(posta: string, carrega: string): number {
  const p = new Date(posta + 'T00:00:00')
  const c = new Date(carrega + 'T00:00:00')
  return Math.floor((c.getTime() - p.getTime()) / 86400000)
}
function setmanesReproductores(posta: string, dataNaixement: string): number {
  const p = new Date(posta + 'T00:00:00')
  const n = new Date(dataNaixement + 'T00:00:00')
  return Math.floor((p.getTime() - n.getTime()) / (86400000 * 7))
}
export default function Assignacions() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [carrosDisponibles, setCarrosDisponibles] = useState<CarroEstoc[]>([])
  const [incubadores, setIncubadores] = useState<Incubadora[]>([])
  const [loading, setLoading] = useState(true)
  const [assignant, setAssignant] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [grupSeleccionat, setGrupSeleccionat] = useState<CarroEstoc[] | null>(null)
  const [nombreAssignar, setNombreAssignar] = useState(1)
  const [incubadoraId, setIncubadoraId] = useState('')
  const [previsioManual, setPrevisioManual] = useState('')
  const [previsioCalculada, setPrevisioCalculada] = useState<number | null>(null)
  const [horaEntrada, setHoraEntrada] = useState('')
  const [numCarroInicial, setNumCarroInicial] = useState('')

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [fullRes, carrosRes, incRes] = await Promise.all([
      fetch(`/api/carrega/${params.id}`).then(r => r.json()),
      fetch('/api/carros').then(r => r.json()),
      fetch('/api/incubadores').then(r => r.json()),
    ])
    setFull(fullRes)
    setCarrosDisponibles(carrosRes)
    setIncubadores(incRes)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  useEffect(() => {
    if (!grupSeleccionat || !full) return
    const incubadora = incubadores.find(i => i.id === parseInt(incubadoraId))
    const tipus = incubadora?.tipus || 'Multistage'
    const primer = grupSeleccionat[0]
    fetch(`/api/previsio?lot_id=${primer.lots_reproductores.id}&posta=${primer.posta}&tipus=${tipus}`)
      .then(r => r.json())
      .then(data => {
        if (data.previsio) {
          setPrevisioCalculada(data.previsio)
          setPrevisioManual(String(Math.round(data.previsio * 100)))
        }
      })
  }, [grupSeleccionat, incubadoraId, incubadores, full])

  function seleccionarGrup(carros: CarroEstoc[]) {
    if (grupSeleccionat && grupSeleccionat[0].id === carros[0].id) {
      setGrupSeleccionat(null)
      setNombreAssignar(1)
    } else {
      setGrupSeleccionat(carros)
      setNombreAssignar(1)
      setErrorMsg('')
    }
  }

  async function assignar() {
    if (!grupSeleccionat || !incubadoraId || !full) return
    setAssignant(true)
    setErrorMsg('')
    const previsio = parseFloat(previsioManual) / 100
    const carrosAassignar = grupSeleccionat.slice(0, nombreAssignar).map(c => c.id)
    const isSinglestage = incubadores.find(i => i.id === parseInt(incubadoraId))?.tipus === 'Singlestage'

    const body: Record<string, unknown> = {
      carro_ids: carrosAassignar,
      incubadora_id: parseInt(incubadoraId),
      hora_entrada: horaEntrada || null,
      previsio_naixement: isNaN(previsio) ? null : previsio,
    }
    if (isSinglestage && numCarroInicial) {
      body.num_carro_inicial = parseInt(numCarroInicial)
    }

    const res = await fetch(`/api/carrega/${full.id}/assignacions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error || 'Error desconegut')
    } else {
      setGrupSeleccionat(null)
      setNombreAssignar(1)
      setIncubadoraId('')
      setPrevisioManual('')
      setPrevisioCalculada(null)
      setHoraEntrada('')
      setNumCarroInicial('')
      carregarDades()
    }
    setAssignant(false)
  }

  async function desassignar(assignacio: Assignacio) {
    await fetch(`/api/carrega/${params.id}/assignacions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignacio_id: assignacio.id, carro_id: assignacio.carros_estoc.id }),
    })
    carregarDades()
  }

  if (loading || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  const totalPollets = full.comandes.filter(c => c.tipus === 'Pollets').reduce((s, c) => s + (c.quantitat_pollets || 0), 0)
  const polletsPrevistos = full.assignacions.reduce((s, a) => s + Math.round(a.carros_estoc.quantitat_ous * (a.previsio_naixement || 0)), 0)

  const grups: Record<string, CarroEstoc[]> = {}
  carrosDisponibles.forEach(c => {
    const key = `${c.lots_reproductores.id}-${c.posta}`
    if (!grups[key]) grups[key] = []
    grups[key].push(c)
  })
  const grupsOrdenats = Object.entries(grups).sort((a, b) => {
    return diesEstoc(b[1][0].posta, full.carrega) - diesEstoc(a[1][0].posta, full.carrega)
  })

  // Carros per incubadora (per mostrar ocupació)
  const ocupacioPerInc: Record<number, number> = {}
  full.assignacions.forEach(a => {
    ocupacioPerInc[a.incubadores.numero] = (ocupacioPerInc[a.incubadores.numero] || 0) + 1
  })

  const incubadoraSeleccionada = incubadores.find(i => i.id === parseInt(incubadoraId))
  const ocupacioActual = incubadoraSeleccionada ? (ocupacioPerInc[incubadoraSeleccionada.numero] || 0) : 0
  const lliuresIncubadora = incubadoraSeleccionada ? incubadoraSeleccionada.capacitat_carros - ocupacioActual : 99
  const isSinglestage = incubadoraSeleccionada?.tipus === 'Singlestage'

  const inputStyle = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '0.6rem 0.75rem', color: 'var(--text)', fontSize: '0.9rem',
    outline: 'none', fontFamily: 'IBM Plex Sans',
  }
  const labelStyle = {
    display: 'block' as const, fontSize: '0.7rem', fontFamily: 'IBM Plex Mono',
    color: 'var(--text-dim)', textTransform: 'uppercase' as const,
    letterSpacing: '0.1em', marginBottom: '0.4rem',
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <Link href={`/carrega/${full.id}`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrrega #{full.num_carrega}</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Assignacions</p>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Assignar carros</h1>
          </div>
        </div>

        {totalPollets > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Pollets previstos</span>
              <span style={{ color: polletsPrevistos >= totalPollets ? 'var(--success)' : 'var(--accent)' }}>
                {polletsPrevistos.toLocaleString()} / {totalPollets.toLocaleString()}
              </span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: '4px', height: '6px' }}>
              <div style={{ background: polletsPrevistos >= totalPollets ? 'var(--success)' : 'var(--accent)', borderRadius: '4px', height: '6px', width: `${Math.min(100, (polletsPrevistos / totalPollets) * 100)}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* Selector de grup */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                Selecciona lot
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                {grupsOrdenats.map(([key, carros]) => {
                  const primer = carros[0]
                  const dies = diesEstoc(primer.posta, full.carrega)
                  const seleccionat = grupSeleccionat && grupSeleccionat[0].id === carros[0].id
                  return (
                    <button key={key} onClick={() => seleccionarGrup(carros)} style={{
                      padding: '0.6rem 0.75rem', border: '1px solid',
                      borderColor: seleccionat ? 'var(--accent)' : 'var(--border)',
                      borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                      background: seleccionat ? 'rgba(240,180,41,0.1)' : 'var(--bg)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: seleccionat ? 'var(--accent)' : 'var(--text)' }}>
                          {nomCarro(primer)}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', background: 'rgba(240,180,41,0.15)', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                          {carros.length}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginTop: '0.2rem' }}>
                        {primer.posta} · {dies}d estoc · {setmanesReproductores(primer.posta, primer.lots_reproductores.data_naixement)}s
                      </div>
                    </button>
                  )
                })}
                {grupsOrdenats.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem', margin: 0 }}>Sense carros disponibles</p>}
              </div>
            </div>

            {/* Panell assignació */}
            {grupSeleccionat && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Nombre de carros */}
                <div>
                  <label style={labelStyle}>Nombre de carros a assignar</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button type="button" onClick={() => setNombreAssignar(n => Math.max(1, n - 1))}
                      style={{ width: '2.25rem', height: '2.25rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer' }}>−</button>
                    <input type="number" value={nombreAssignar}
                      onChange={e => setNombreAssignar(Math.min(grupSeleccionat.length, Math.max(1, parseInt(e.target.value) || 1)))}
                      min="1" max={grupSeleccionat.length}
                      style={{ ...inputStyle, width: '4rem', textAlign: 'center', fontFamily: 'IBM Plex Mono', fontWeight: 700 }} />
                    <button type="button" onClick={() => setNombreAssignar(n => Math.min(grupSeleccionat.length, n + 1))}
                      style={{ width: '2.25rem', height: '2.25rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--text)', fontSize: '1.2rem', cursor: 'pointer' }}>+</button>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>/ {grupSeleccionat.length} disp.</span>
                  </div>
                </div>

                {/* Incubadora */}
                <div>
                  <label style={labelStyle}>Incubadora</label>
                  <select value={incubadoraId} onChange={e => setIncubadoraId(e.target.value)} style={{ ...inputStyle, width: '100%', appearance: 'none' }}>
                    <option value="">Selecciona...</option>
                    {incubadores.map(i => {
                      const ocupats = ocupacioPerInc[i.numero] || 0
                      const lliures = i.capacitat_carros - ocupats
                      return <option key={i.id} value={i.id} disabled={lliures <= 0}>
                        Inc. {i.numero} — {i.model} ({i.tipus === 'Singlestage' ? 'SS' : 'MS'}) · {ocupats}/{i.capacitat_carros}
                        {lliures <= 0 ? ' PLENA' : ''}
                      </option>
                    })}
                  </select>
                  {incubadoraSeleccionada && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: lliuresIncubadora < nombreAssignar ? 'var(--danger)' : 'var(--success)' }}>
                      {lliuresIncubadora} lloc{lliuresIncubadora !== 1 ? 's' : ''} lliure{lliuresIncubadora !== 1 ? 's' : ''}
                      {lliuresIncubadora < nombreAssignar && ` — necessites ${nombreAssignar} però en tens ${lliuresIncubadora}`}
                    </div>
                  )}
                </div>

                {/* Número inicial (només Singlestage) */}
                {isSinglestage && (
                  <div>
                    <label style={labelStyle}>Nº carro inicial (posició física)</label>
                    <input type="number" value={numCarroInicial} onChange={e => setNumCarroInicial(e.target.value)}
                      placeholder="Automàtic si buit" min="1"
                      style={{ ...inputStyle, width: '100%' }} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={labelStyle}>
                      Previsió %
                      {previsioCalculada && <span style={{ color: 'var(--accent)', marginLeft: '0.3rem' }}>({Math.round(previsioCalculada * 100)}%)</span>}
                    </label>
                    <input type="number" value={previsioManual} onChange={e => setPrevisioManual(e.target.value)}
                      min="0" max="100" step="1" placeholder="75"
                      style={{ ...inputStyle, width: '100%' }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Hora entrada</label>
                    <input type="text" value={horaEntrada} onChange={e => setHoraEntrada(e.target.value)}
                      placeholder="5:00" style={{ ...inputStyle, width: '100%' }} />
                  </div>
                </div>

                {errorMsg && (
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', background: 'rgba(240,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem' }}>
                    {errorMsg}
                  </div>
                )}

                <button onClick={assignar}
                  disabled={!incubadoraId || assignant || lliuresIncubadora < nombreAssignar}
                  style={{
                    padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                    fontFamily: 'IBM Plex Sans', fontSize: '0.9rem', cursor: 'pointer',
                    background: (!incubadoraId || assignant || lliuresIncubadora < nombreAssignar) ? 'var(--border)' : 'var(--accent)',
                    color: (!incubadoraId || assignant || lliuresIncubadora < nombreAssignar) ? 'var(--text-dim)' : '#0f1117',
                  }}>
                  {assignant ? 'Assignant...' : `Assignar ${nombreAssignar} carro${nombreAssignar !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>

          {/* Columna dreta: assignacions actuals */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              Assignats ({full.assignacions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '550px', overflowY: 'auto' }}>
              {full.assignacions.sort((a, b) => a.num_carro_full - b.num_carro_full).map(a => {
                const lot = a.carros_estoc.lots_reproductores
                const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
                return (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'var(--bg)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', color: 'var(--text-dim)', minWidth: '1.75rem' }}>C{a.num_carro_full}</span>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{granja}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                          Inc.{a.incubadores.numero} · {a.carros_estoc.posta}
                          {a.previsio_naixement && ` · ${Math.round(a.previsio_naixement * 100)}%`}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => desassignar(a)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>✕</button>
                  </div>
                )
              })}
              {full.assignacions.length === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem', margin: 0 }}>Sense assignacions</p>}
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}
