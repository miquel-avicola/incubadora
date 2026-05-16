'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Vacuna {
  id: number
  nom: string
  via: string
}

interface AssignacioVacuna {
  id: number
  dosi: number
  vacunes: { id: number; nom: string; via: string }
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
}

interface Full {
  id: number
  num_carrega: number
  assignacions: Assignacio[]
}

export default function PlaVacunal() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [vacunesDisponibles, setVacunesDisponibles] = useState<Vacuna[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionats, setSeleccionats] = useState<number[]>([])
  const [vacunaId, setVacunaId] = useState('')
  const [dosi, setDosi] = useState('1')
  const [vacunaId2, setVacunaId2] = useState('')
const [dosi2, setDosi2] = useState('1')
  const [assignant, setAssignant] = useState(false)
  const [buidant, setBuidant] = useState(false)

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [fullRes, vacunesRes] = await Promise.all([
      fetch(`/api/carrega/${params.id}`).then(r => r.json()),
      fetch('/api/vacunes').then(r => r.json()),
    ])
    setFull(fullRes)
    setVacunesDisponibles(vacunesRes)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  function toggleSeleccio(id: number) {
    setSeleccionats(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function seleccionarTots() {
    if (!full) return
    const tots = full.assignacions.map(a => a.id)
    setSeleccionats(tots.length === seleccionats.length ? [] : tots)
  }

 async function assignarVacuna() {
  if (!vacunaId || seleccionats.length === 0) return
  setAssignant(true)
  await Promise.all(seleccionats.flatMap(assignacio_id => {
    const cridades = [
      fetch(`/api/carrega/${params.id}/vacunes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignacio_id, vacuna_id: parseInt(vacunaId), dosi: parseFloat(dosi) }),
      })
    ]
    if (vacunaId2) {
      cridades.push(fetch(`/api/carrega/${params.id}/vacunes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignacio_id, vacuna_id: parseInt(vacunaId2), dosi: parseFloat(dosi2) }),
      }))
    }
    return cridades
  }))
  setSeleccionats([])
  setVacunaId('')
  setDosi('1')
  setVacunaId2('')
  setDosi2('1')
  setAssignant(false)
  carregarDades()
}

  async function eliminarVacuna(assignacio_vacuna_id: number) {
    await fetch(`/api/carrega/${params.id}/vacunes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignacio_vacuna_id }),
    })
    carregarDades()
  }

  async function buidarPlaSeleccionats() {
    if (seleccionats.length < 2) return
    const totalVacunes = (full?.assignacions ?? [])
      .filter(a => seleccionats.includes(a.id))
      .reduce((s, a) => s + a.assignacio_vacunes.length, 0)
    if (totalVacunes === 0) return
    const missatge = `Esborrar ${totalVacunes} vacuna${totalVacunes !== 1 ? 's' : ''} de ${seleccionats.length} carros?\n\nAquesta acció no es pot desfer.`
    if (!window.confirm(missatge)) return
    setBuidant(true)
    await fetch(`/api/carrega/${params.id}/vacunes`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignacio_ids: seleccionats }),
    })
    setSeleccionats([])
    setBuidant(false)
    carregarDades()
  }

  if (loading || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  const assignacionsOrdenades = [...full.assignacions].sort((a, b) => a.num_carro_full - b.num_carro_full)

  const polletsSeleccionats = assignacionsOrdenades
    .filter(a => seleccionats.includes(a.id))
    .reduce((s, a) => s + Math.round(a.carros_estoc.quantitat_ous * (a.previsio_naixement || 0)), 0)

  const inputStyle = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
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
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <Link href={`/carrega/${full.id}`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrrega #{full.num_carrega}</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Pla vacunal</p>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Assignar vacunes in-ovo</h1>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>

          {/* Columna esquerra: llista de carros */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Carros ({assignacionsOrdenades.length})
              </div>
              <button onClick={seleccionarTots} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono' }}>
                {seleccionats.length === assignacionsOrdenades.length ? 'Cap' : 'Tots'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '450px', overflowY: 'auto' }}>
              {assignacionsOrdenades.map(a => {
                const granja = a.carros_estoc.lots_reproductores.granges_reproductores.nom_informal || a.carros_estoc.lots_reproductores.granges_reproductores.granja
                const estirp = a.carros_estoc.lots_reproductores.estirp
                const seleccionat = seleccionats.includes(a.id)
                return (
                  <button key={a.id} onClick={() => toggleSeleccio(a.id)} style={{
                    padding: '0.5rem 0.6rem', border: '1px solid',
                    borderColor: seleccionat ? 'var(--accent)' : 'var(--border)',
                    borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                    background: seleccionat ? 'rgba(240,180,41,0.1)' : 'var(--bg)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', color: 'var(--text-dim)' }}>C{a.num_carro_full} · Inc.{a.incubadores.numero}</span>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: seleccionat ? 'var(--accent)' : 'var(--text)' }}>
                          {granja}{estirp ? ` ${estirp}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {a.assignacio_vacunes.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-end' }}>
                            {a.assignacio_vacunes.map(av => (
                              <span key={av.id} style={{ fontSize: '0.65rem', fontFamily: 'IBM Plex Mono', color: 'var(--success)', background: 'rgba(34,197,94,0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                {av.dosi === 0.5 ? '½' : '1'} {av.vacunes.nom}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Columna dreta: panell assignació */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {seleccionats.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {seleccionats.length} carro{seleccionats.length !== 1 ? 's' : ''} seleccionat{seleccionats.length !== 1 ? 's' : ''}
                </div>

                {polletsSeleccionats > 0 && (
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 700 }}>
                    ~{polletsSeleccionats.toLocaleString()} pollets previstos
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Vacuna</label>
                  <select value={vacunaId} onChange={e => setVacunaId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">Selecciona...</option>
                    {vacunesDisponibles.map(v => (
                      <option key={v.id} value={v.id}>{v.nom}</option>
                    ))}
                  </select>
                </div>

               <div>
                  <label style={labelStyle}>Dosi</label>
                  <select value={dosi} onChange={e => setDosi(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="1">1 dosi</option>
                    <option value="0.5">½ dosi</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Vacuna 2 (opcional)</label>
                  <select value={vacunaId2} onChange={e => setVacunaId2(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                    <option value="">Cap</option>
                    {vacunesDisponibles.map(v => (
                      <option key={v.id} value={v.id}>{v.nom}</option>
                    ))}
                  </select>
                </div>

                {vacunaId2 && (
                  <div>
                    <label style={labelStyle}>Dosi vacuna 2</label>
                    <select value={dosi2} onChange={e => setDosi2(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                      <option value="1">1 dosi</option>
                      <option value="0.5">½ dosi</option>
                    </select>
                  </div>
                )}

                <button onClick={assignarVacuna}
                  disabled={!vacunaId || assignant}
                  style={{
                    padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                    fontFamily: 'IBM Plex Sans', fontSize: '0.9rem', cursor: 'pointer',
                    background: (!vacunaId || assignant) ? 'var(--border)' : 'var(--accent)',
                    color: (!vacunaId || assignant) ? 'var(--text-dim)' : '#0f1117',
                  }}>
                  {assignant ? 'Assignant...' : 'Assignar vacuna'}
                </button>
              </div>
            )}

            {/* Buidar pla vacunal: només per selecció múltiple */}
            {seleccionats.length >= 2 && (() => {
              const totalVacunes = assignacionsOrdenades
                .filter(a => seleccionats.includes(a.id))
                .reduce((s, a) => s + a.assignacio_vacunes.length, 0)
              if (totalVacunes === 0) return null
              return (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Eliminar pla vacunal
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.4 }}>
                    Esborrarà <strong style={{ color: 'var(--text)' }}>{totalVacunes}</strong> vacuna{totalVacunes !== 1 ? 's' : ''} dels <strong style={{ color: 'var(--text)' }}>{seleccionats.length}</strong> carros seleccionats.
                  </p>
                  <button onClick={buidarPlaSeleccionats}
                    disabled={buidant}
                    style={{
                      padding: '0.6rem 0.75rem', border: '1px solid var(--danger)', borderRadius: '8px',
                      fontWeight: 700, fontFamily: 'IBM Plex Sans', fontSize: '0.85rem', cursor: 'pointer',
                      background: buidant ? 'var(--border)' : 'transparent',
                      color: buidant ? 'var(--text-dim)' : 'var(--danger)',
                    }}>
                    {buidant ? 'Esborrant...' : `Buidar pla de ${seleccionats.length} carros`}
                  </button>
                </div>
              )
            })()}

            {/* Resum vacunes del full */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                Resum pla vacunal
              </div>
              {(() => {
                const resum: Record<string, { carros: number; pollets: number; dosi: number }> = {}
                assignacionsOrdenades.forEach(a => {
                  a.assignacio_vacunes.forEach(av => {
                    const clau = `${av.vacunes.nom}__${av.dosi}`
                    if (!resum[clau]) resum[clau] = { carros: 0, pollets: 0, dosi: av.dosi }
                    resum[clau].carros++
                    resum[clau].pollets += Math.round(a.carros_estoc.quantitat_ous * (a.previsio_naixement || 0))
                  })
                })
                const entrades = Object.entries(resum)
                if (entrades.length === 0) return <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: 0 }}>Sense vacunes assignades</p>
                return entrades.map(([clau, v]) => (
                  <div key={clau} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                    <span>{v.dosi === 0.5 ? '½' : '1'} dosi {clau.split('__')[0]}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>{v.carros} carros · ~{v.pollets.toLocaleString()} pollets</span>
                  </div>
                ))
              })()}

              {/* Carros sense vacuna */}
              {(() => {
                const senseVacuna = assignacionsOrdenades.filter(a => a.assignacio_vacunes.length === 0)
                if (senseVacuna.length === 0) return null
                const pollets = senseVacuna.reduce((s, a) => s + Math.round(a.carros_estoc.quantitat_ous * (a.previsio_naixement || 0)), 0)
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Sense vacuna</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>{senseVacuna.length} carros · ~{pollets.toLocaleString()} pollets</span>
                  </div>
                )
              })()}
            </div>

            {/* Eliminar vacunes */}
            {seleccionats.length === 1 && (() => {
              const assignacio = assignacionsOrdenades.find(a => a.id === seleccionats[0])
              if (!assignacio || assignacio.assignacio_vacunes.length === 0) return null
              return (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                    Vacunes del carro C{assignacio.num_carro_full}
                  </div>
                  {assignacio.assignacio_vacunes.map(av => (
                    <div key={av.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0' }}>
                      <span style={{ fontSize: '0.82rem' }}>{av.dosi === 0.5 ? '½' : '1'} dosi {av.vacunes.nom}</span>
                      <button onClick={() => eliminarVacuna(av.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </main>
  )
}
