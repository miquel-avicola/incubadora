'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

// ───────────────────────────────────────────────────────────────────
// Tipus
// ───────────────────────────────────────────────────────────────────

type ZonaMS = 'central' | 'paret' | 'pulsator'

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

// Subconjunt del JSON de /api/instalacions
interface CarroAInstalacio {
  assignacio_id: number
  num_carro_full: number
  posicio: number | null
  zona: ZonaMS | null
  estirp: string | null
}
interface IncAInstalacio {
  id: number
  tipus: string
  carros: CarroAInstalacio[]
}
interface EstatInstalacions {
  incubadores: IncAInstalacio[]
}

// Layout físic SS — mateixa estructura que /instal·lacions
const SS_LAYOUT: Array<{ posicio: number; col: number; row: number }> = [
  { posicio: 1, col: 1, row: 1 }, { posicio: 2, col: 1, row: 2 }, { posicio: 3, col: 1, row: 3 }, { posicio: 4, col: 1, row: 4 },
  { posicio: 9, col: 2, row: 1 }, { posicio: 10, col: 2, row: 2 }, { posicio: 11, col: 2, row: 3 }, { posicio: 12, col: 2, row: 4 },
  { posicio: 17, col: 3, row: 1 }, { posicio: 18, col: 3, row: 2 }, { posicio: 19, col: 3, row: 3 }, { posicio: 20, col: 3, row: 4 },
  { posicio: 21, col: 4, row: 1 }, { posicio: 22, col: 4, row: 2 }, { posicio: 23, col: 4, row: 3 }, { posicio: 24, col: 4, row: 4 },
  { posicio: 13, col: 5, row: 1 }, { posicio: 14, col: 5, row: 2 }, { posicio: 15, col: 5, row: 3 }, { posicio: 16, col: 5, row: 4 },
  { posicio: 5, col: 6, row: 1 }, { posicio: 6, col: 6, row: 2 }, { posicio: 7, col: 6, row: 3 }, { posicio: 8, col: 6, row: 4 },
]

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────

export default function Assignacions() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [carrosDisponibles, setCarrosDisponibles] = useState<CarroEstoc[]>([])
  const [incubadores, setIncubadores] = useState<Incubadora[]>([])
  const [estatInstalacions, setEstatInstalacions] = useState<EstatInstalacions | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignant, setAssignant] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [grupSeleccionat, setGrupSeleccionat] = useState<CarroEstoc[] | null>(null)
  const [nombreAssignar, setNombreAssignar] = useState(1)
  const [incubadoraId, setIncubadoraId] = useState('')
  const [previsioManual, setPrevisioManual] = useState('')
  const [previsioCalculada, setPrevisioCalculada] = useState<number | null>(null)
  const [horaEntrada, setHoraEntrada] = useState('')
  const [posicionsSeleccionades, setPosicionsSeleccionades] = useState<number[]>([])
  const [zonaSeleccionada, setZonaSeleccionada] = useState<ZonaMS>('central')

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [fullRes, carrosRes, incRes, instRes] = await Promise.all([
      fetch(`/api/carrega/${params.id}`).then(r => r.json()),
      fetch('/api/carros').then(r => r.json()),
      fetch('/api/incubadores').then(r => r.json()),
      fetch('/api/instalacions').then(r => r.json()),
    ])
    setFull(fullRes)
    setCarrosDisponibles(carrosRes)
    setIncubadores(incRes)
    setEstatInstalacions(instRes)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  // Cascada de previsió
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

  // Helpers d'ocupació
  function ocupacioSS(incId: number): Map<number, number> {
    const map = new Map<number, number>()
    if (!estatInstalacions) return map
    const inc = estatInstalacions.incubadores.find(i => i.id === incId)
    if (!inc) return map
    for (const c of inc.carros) {
      if (c.posicio !== null) map.set(c.posicio, c.num_carro_full)
    }
    return map
  }

  function ocupacioMSZones(incId: number): { central: number; paret: number; pulsator: number } {
    const r = { central: 0, paret: 0, pulsator: 0 }
    if (!estatInstalacions) return r
    const inc = estatInstalacions.incubadores.find(i => i.id === incId)
    if (!inc) return r
    for (const c of inc.carros) {
      if (c.zona) r[c.zona]++
    }
    return r
  }

  // Pre-selecció de posicions quan canvia la incubadora seleccionada
  useEffect(() => {
    setPosicionsSeleccionades([])
    setZonaSeleccionada('central')
    if (!incubadoraId) return
    const inc = incubadores.find(i => i.id === parseInt(incubadoraId))
    if (!inc) return
    if (inc.tipus !== 'Singlestage') return
    const ocupades = ocupacioSS(inc.id)
    const lliures: number[] = []
    for (let p = 1; p <= inc.capacitat_carros; p++) {
      if (!ocupades.has(p)) lliures.push(p)
      if (lliures.length === nombreAssignar) break
    }
    setPosicionsSeleccionades(lliures)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incubadoraId])

  // Retallar selecció si baixa el nombreAssignar
  useEffect(() => {
    setPosicionsSeleccionades(prev => prev.slice(0, nombreAssignar))
  }, [nombreAssignar])

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

  function clicarPosicio(p: number, ocupades: Map<number, number>) {
    if (ocupades.has(p)) return
    setPosicionsSeleccionades(prev => {
      if (prev.includes(p)) return prev.filter(x => x !== p)
      if (prev.length >= nombreAssignar) {
        return [...prev.slice(1), p]
      }
      return [...prev, p]
    })
  }

  async function assignar() {
    if (!grupSeleccionat || !incubadoraId || !full) return
    setAssignant(true)
    setErrorMsg('')
    const previsio = parseFloat(previsioManual) / 100
    const carrosAassignar = grupSeleccionat.slice(0, nombreAssignar).map(c => c.id)
    const inc = incubadores.find(i => i.id === parseInt(incubadoraId))
    const isSS = inc?.tipus === 'Singlestage'

    const body: Record<string, unknown> = {
      carro_ids: carrosAassignar,
      incubadora_id: parseInt(incubadoraId),
      hora_entrada: horaEntrada || null,
      previsio_naixement: isNaN(previsio) ? null : previsio,
    }
    if (isSS) body.posicions = posicionsSeleccionades
    else body.zona = zonaSeleccionada

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
      setPosicionsSeleccionades([])
      setZonaSeleccionada('central')
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

  const ocupacioPerInc: Record<number, number> = {}
  full.assignacions.forEach(a => {
    ocupacioPerInc[a.incubadores.numero] = (ocupacioPerInc[a.incubadores.numero] || 0) + 1
  })

  const incubadoraSeleccionada = incubadores.find(i => i.id === parseInt(incubadoraId))
  const ocupacioActual = incubadoraSeleccionada ? (ocupacioPerInc[incubadoraSeleccionada.numero] || 0) : 0
  const lliuresIncubadora = incubadoraSeleccionada ? incubadoraSeleccionada.capacitat_carros - ocupacioActual : 99
  const isSinglestage = incubadoraSeleccionada?.tipus === 'Singlestage'

  // Per a la mini-graella SS i el selector MS
  const ocupadesSS = incubadoraSeleccionada && isSinglestage ? ocupacioSS(incubadoraSeleccionada.id) : new Map<number, number>()
  const ocupacioZones = incubadoraSeleccionada && !isSinglestage ? ocupacioMSZones(incubadoraSeleccionada.id) : { central: 0, paret: 0, pulsator: 0 }

  // Validació per al botó "Assignar"
  const posicionsOK = !incubadoraSeleccionada
    ? false
    : isSinglestage
      ? posicionsSeleccionades.length === nombreAssignar
      : !!zonaSeleccionada
  const potAssignar = !!incubadoraId && !assignant && lliuresIncubadora >= nombreAssignar && posicionsOK

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

                {/* Selector de posició (només SS) */}
                {incubadoraSeleccionada && isSinglestage && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Posicions a la SS</label>
                      <span style={{ fontSize: '0.72rem', fontFamily: 'IBM Plex Mono', color: posicionsSeleccionades.length === nombreAssignar ? 'var(--success)' : 'var(--accent)' }}>
                        {posicionsSeleccionades.length} / {nombreAssignar}
                      </span>
                    </div>
                    {/* Mini-graella 6×4 en U */}
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                        {[1, 2, 3, 4].map(row => (
                          <Fragment key={row}>
                            {[1, 2, 3].map(col => {
                              const cell = SS_LAYOUT.find(c => c.col === col && c.row === row)
                              if (!cell) return null
                              const p = cell.posicio
                              const num = ocupadesSS.get(p)
                              const ocupada = num !== undefined
                              const seleccionada = posicionsSeleccionades.includes(p)
                              return (
                                <button key={`l-${row}-${col}`} type="button"
                                  onClick={() => clicarPosicio(p, ocupadesSS)}
                                  disabled={ocupada}
                                  style={{
                                    aspectRatio: '1', padding: 0,
                                    border: '1px solid',
                                    borderColor: seleccionada ? 'var(--accent)' : ocupada ? 'var(--border)' : 'var(--border)',
                                    borderRadius: '4px',
                                    background: seleccionada ? 'var(--accent)' : ocupada ? 'rgba(120,120,120,0.15)' : 'var(--surface)',
                                    color: seleccionada ? '#0f1117' : ocupada ? 'var(--text-dim)' : 'var(--text)',
                                    fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', fontWeight: 700,
                                    cursor: ocupada ? 'not-allowed' : 'pointer',
                                  }}>
                                  {ocupada ? `C${num}` : p}
                                </button>
                              )
                            })}
                            {/* Banda central (pulsator) */}
                            {row === 1 && (
                              <div key={`puls-${row}`} style={{
                                gridRow: '1 / span 4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'rgba(80,80,80,0.2)', borderRadius: '4px',
                                fontFamily: 'IBM Plex Mono', fontSize: '0.6rem', color: 'var(--text-dim)',
                                writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.15em',
                              }}>
                                PULSATOR
                              </div>
                            )}
                            {[4, 5, 6].map(col => {
                              const cell = SS_LAYOUT.find(c => c.col === col && c.row === row)
                              if (!cell) return null
                              const p = cell.posicio
                              const num = ocupadesSS.get(p)
                              const ocupada = num !== undefined
                              const seleccionada = posicionsSeleccionades.includes(p)
                              return (
                                <button key={`r-${row}-${col}`} type="button"
                                  onClick={() => clicarPosicio(p, ocupadesSS)}
                                  disabled={ocupada}
                                  style={{
                                    aspectRatio: '1', padding: 0,
                                    border: '1px solid',
                                    borderColor: seleccionada ? 'var(--accent)' : ocupada ? 'var(--border)' : 'var(--border)',
                                    borderRadius: '4px',
                                    background: seleccionada ? 'var(--accent)' : ocupada ? 'rgba(120,120,120,0.15)' : 'var(--surface)',
                                    color: seleccionada ? '#0f1117' : ocupada ? 'var(--text-dim)' : 'var(--text)',
                                    fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', fontWeight: 700,
                                    cursor: ocupada ? 'not-allowed' : 'pointer',
                                  }}>
                                  {ocupada ? `C${num}` : p}
                                </button>
                              )
                            })}
                          </Fragment>
                        ))}
                      </div>
                      <div style={{ marginTop: '0.4rem', fontSize: '0.65rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textAlign: 'center' }}>
                        Paret · Central · Pulsator esq │ Pulsator dre · Central · Paret
                      </div>
                    </div>
                  </div>
                )}

                {/* Selector de zona (només MS) */}
                {incubadoraSeleccionada && !isSinglestage && (
                  <div>
                    <label style={labelStyle}>Zona dins de la incubadora</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                      {(['central', 'paret', 'pulsator'] as ZonaMS[]).map(z => {
                        const sel = z === zonaSeleccionada
                        return (
                          <button key={z} type="button"
                            onClick={() => setZonaSeleccionada(z)}
                            style={{
                              padding: '0.7rem 0.4rem', border: '1px solid',
                              borderColor: sel ? 'var(--accent)' : 'var(--border)',
                              borderRadius: '8px',
                              background: sel ? 'rgba(240,180,41,0.12)' : 'var(--bg)',
                              color: sel ? 'var(--accent)' : 'var(--text)',
                              cursor: 'pointer', textAlign: 'center',
                            }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {z}
                            </div>
                            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                              {ocupacioZones[z]} carro{ocupacioZones[z] !== 1 ? 's' : ''}
                            </div>
                          </button>
                        )
                      })}
                    </div>
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
                  disabled={!potAssignar}
                  style={{
                    padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                    fontFamily: 'IBM Plex Sans', fontSize: '0.9rem', cursor: 'pointer',
                    background: !potAssignar ? 'var(--border)' : 'var(--accent)',
                    color: !potAssignar ? 'var(--text-dim)' : '#0f1117',
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
