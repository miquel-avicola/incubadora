'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Destinacio {
  id: number
  nom_granja: string
  nau: string | null
  poblacio: string | null
  client_id: number | null
}

interface Transportista {
  id: number
  nom: string
}

interface Comanda {
  id: number
  clients: { id: number; nom: string }
  quantitat_pollets: number | null
  tipus: string
}

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
  comanda_id: number
  ordre: number | null
  pollets_comanda: number | null
  pollets_servits: number | null
  matricula: string | null
  hora_prevista_naixement: string | null
  observacions: string | null
  comandes: { id: number; clients: { id: number; nom: string } }
  destinacions: { id: number; nom_granja: string; nau: string | null; poblacio: string | null }
  transportistes: { id: number; nom: string } | null
  expedicio_lots: ExpedicioLot[]
  expedicio_vacunes: { vacuna_id: number; vacunes: { id: number; nom: string; via: string } }[]
}

interface Vacuna {
  id: number
  nom: string
  via: string
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  comandes: Comanda[]
}

function nomDestinacio(d: { nom_granja: string; nau: string | null }) {
  return d.nau ? `${d.nom_granja} ${d.nau}` : d.nom_granja
}

export default function Expedicions() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [expedicions, setExpedicions] = useState<Expedicio[]>([])
  const [destinacions, setDestinacions] = useState<Destinacio[]>([])
  const [transportistes, setTransportistes] = useState<Transportista[]>([])
  const [loading, setLoading] = useState(true)
  const [vacunes, setVacunes] = useState<Vacuna[]>([])

  // Formulari nova expedició
  const [mostrarForm, setMostrarForm] = useState(false)
  const [comandaId, setComandaId] = useState('')
  const [destinacioId, setDestinacioId] = useState('')
  const [transportistaId, setTransportistaId] = useState('')
  const [matricula, setMatricula] = useState('')
  const [horaPrevist, setHoraPrevist] = useState('')
  const [polletsComanda, setPolletsComanda] = useState('')
  const [cercaDestinacio, setCercaDestinacio] = useState('')
  const [creant, setCreant] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

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
    fetch('/api/transportistes').then(r => r.json()).then(setTransportistes)
    fetch('/api/vacunes').then(r => r.json()).then(setVacunes)
  }, [])

  // Carregar destinacions filtrades per client quan es selecciona comanda
  useEffect(() => {
    if (!comandaId || !full) return
    const comanda = full.comandes.find(c => c.id === parseInt(comandaId))
    if (!comanda) return
    fetch(`/api/destinacions?client_id=${comanda.clients.id}`)
      .then(r => r.json())
      .then(setDestinacions)
  }, [comandaId, full])

  async function crearExpedicio() {
    if (!comandaId || !destinacioId) return
    setCreant(true)
    setErrorMsg('')

    const res = await fetch(`/api/carrega/${params.id}/expedicions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comanda_id: parseInt(comandaId),
        destinacio_id: parseInt(destinacioId),
        transportista_id: transportistaId ? parseInt(transportistaId) : null,
        matricula: matricula || null,
        hora_prevista_naixement: horaPrevist || null,
        pollets_comanda: polletsComanda ? parseInt(polletsComanda) : null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error || 'Error desconegut')
    } else {
      setMostrarForm(false)
      setComandaId('')
      setDestinacioId('')
      setTransportistaId('')
      setMatricula('')
      setHoraPrevist('')
      setPolletsComanda('')
      setCercaDestinacio('')
      carregarDades()
    }
    setCreant(false)
  }

  async function toggleVacunaExpedicio(expedicioId: number, vacunaId: number, teVacuna: boolean) {
    if (teVacuna) {
      await fetch(`/api/expedicions/${expedicioId}/vacunes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacuna_id: vacunaId }),
      })
    } else {
      await fetch(`/api/expedicions/${expedicioId}/vacunes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacuna_id: vacunaId }),
      })
    }
    carregarDades()
  }

  async function eliminarExpedicio(id: number) {
    await fetch(`/api/carrega/${params.id}/expedicions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expedicio_id: id }),
    })
    carregarDades()
  }

  if (loading || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  const destinacionsFiltrades = destinacions.filter(d =>
    nomDestinacio(d).toLowerCase().includes(cercaDestinacio.toLowerCase()) ||
    (d.poblacio || '').toLowerCase().includes(cercaDestinacio.toLowerCase())
  )

  // Pollets totals per comanda vs assignats a expedicions
  const polletsPerComanda: Record<number, { objectiu: number; assignats: number }> = {}
  full.comandes.filter(c => c.tipus === 'Pollets').forEach(c => {
    polletsPerComanda[c.id] = { objectiu: c.quantitat_pollets || 0, assignats: 0 }
  })
  expedicions.forEach(e => {
    const cid = e.comandes?.id
    if (cid && polletsPerComanda[cid]) {
      polletsPerComanda[cid].assignats += e.pollets_comanda || 0
    }
  })

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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href={`/carrega/${full.id}`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrrega #{full.num_carrega}</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Expedicions</p>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Repartiment de pollets</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
  <Link href={`/carrega/${params.id}/expedicions/naixement`} style={{ textDecoration: 'none' }}>
    <button style={{
      padding: '0.6rem 1rem', background: 'var(--bg)',
      border: '1px solid var(--border)', borderRadius: '8px',
      color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem',
      cursor: 'pointer', fontFamily: 'IBM Plex Sans',
    }}>
      Dia del naixement
    </button>
  </Link>
  <button onClick={() => setMostrarForm(!mostrarForm)} style={{
    padding: '0.6rem 1rem', background: 'var(--accent)', border: 'none',
    borderRadius: '8px', color: '#0f1117', fontWeight: 700, fontSize: '0.85rem',
    cursor: 'pointer', fontFamily: 'IBM Plex Sans',
  }}>
    + Nova expedició
  </button>
</div>
          </div>

        {/* Resum per comanda */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
            Resum comandes
          </div>
          {full.comandes.filter(c => c.tipus === 'Pollets').map(c => {
            const { objectiu, assignats } = polletsPerComanda[c.id] || { objectiu: 0, assignats: 0 }
            const diff = objectiu - assignats
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>{c.clients.nom}</span>
                <div style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem' }}>
                  <span style={{ color: assignats === objectiu ? 'var(--success)' : 'var(--accent)' }}>
                    {assignats.toLocaleString()} / {objectiu.toLocaleString()}
                  </span>
                  {diff !== 0 && (
                    <span style={{ marginLeft: '0.5rem', color: diff > 0 ? 'var(--danger)' : 'var(--text-dim)', fontSize: '0.75rem' }}>
                      {diff > 0 ? `−${diff.toLocaleString()} pendent` : `+${Math.abs(diff).toLocaleString()} excés`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Formulari nova expedició */}
        {mostrarForm && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Nova expedició</div>

            <div>
              <label style={labelStyle}>Comanda (client)</label>
              <select value={comandaId} onChange={e => { setComandaId(e.target.value); setDestinacioId(''); setCercaDestinacio('') }} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Selecciona client...</option>
                {full.comandes.filter(c => c.tipus === 'Pollets').map(c => (
                  <option key={c.id} value={c.id}>{c.clients.nom} — {(c.quantitat_pollets || 0).toLocaleString()} pollets</option>
                ))}
              </select>
            </div>

            {comandaId && (
              <div>
                <label style={labelStyle}>Destinació</label>
                <input
                  type="text"
                  placeholder="Cerca granja..."
                  value={cercaDestinacio}
                  onChange={e => setCercaDestinacio(e.target.value)}
                  style={{ ...inputStyle, marginBottom: '0.4rem' }}
                />
                <select value={destinacioId} onChange={e => setDestinacioId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }} size={5}>
                  <option value="">Selecciona destinació...</option>
                  {destinacionsFiltrades.map(d => (
                    <option key={d.id} value={d.id}>
                      {nomDestinacio(d)}{d.poblacio ? ` — ${d.poblacio}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Pollets previstos</label>
                <input type="number" value={polletsComanda} onChange={e => setPolletsComanda(e.target.value)} placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Hora prevista</label>
                <input type="text" value={horaPrevist} onChange={e => setHoraPrevist(e.target.value)} placeholder="8:00" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Transportista</label>
                <select value={transportistaId} onChange={e => setTransportistaId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Cap / per definir</option>
                  {transportistes.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Matrícula</label>
                <input type="text" value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="0000 AAA" style={inputStyle} />
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: '0.6rem', borderRadius: '6px', background: 'rgba(240,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setMostrarForm(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                Cancel·lar
              </button>
              <button onClick={crearExpedicio} disabled={!comandaId || !destinacioId || creant} style={{
                flex: 2, padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                fontFamily: 'IBM Plex Sans', fontSize: '0.9rem', cursor: 'pointer',
                background: (!comandaId || !destinacioId || creant) ? 'var(--border)' : 'var(--accent)',
                color: (!comandaId || !destinacioId || creant) ? 'var(--text-dim)' : '#0f1117',
              }}>
                {creant ? 'Creant...' : 'Crear expedició'}
              </button>
            </div>
          </div>
        )}

        {/* Llista d'expedicions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {expedicions.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem', fontFamily: 'IBM Plex Mono' }}>
              Sense expedicions
            </p>
          )}
          {expedicions.map(e => (
            <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    {e.ordre && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', color: 'var(--text-dim)', minWidth: '1.5rem' }}>#{e.ordre}</span>}
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{nomDestinacio(e.destinacions)}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{e.comandes?.clients?.nom}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                    {e.pollets_comanda ? `${e.pollets_comanda.toLocaleString()} pollets previstos` : 'sense quantitat'}
                    {e.hora_prevista_naixement && ` · ${e.hora_prevista_naixement}`}
                    {e.transportistes && ` · ${e.transportistes.nom}`}
                    {e.matricula && ` · ${e.matricula}`}
                  </div>
                  {e.expedicio_lots.length > 0 && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--success)' }}>
                      {e.expedicio_lots.map(el => {
                        const granja = el.lots_reproductores.granges_reproductores.nom_informal || el.lots_reproductores.granges_reproductores.granja
                        return `${el.pollets.toLocaleString()} de ${granja}${el.lots_reproductores.estirp ? ` ${el.lots_reproductores.estirp}` : ''}`
                      }).join(' + ')}
                    </div>
                  )}
                  {vacunes.length > 0 && (
                    <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.65rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                        Vacunes nasciment
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {vacunes.map(v => {
                        const activa = e.expedicio_vacunes.some(ev => ev.vacuna_id === v.id)
                        return (
                          <button key={v.id} onClick={() => toggleVacunaExpedicio(e.id, v.id, activa)} style={{
                            padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono',
                            borderRadius: '4px', cursor: 'pointer', border: '1px solid',
                            borderColor: activa ? 'var(--success)' : 'var(--border)',
                            background: activa ? 'rgba(34,197,94,0.1)' : 'transparent',
                            color: activa ? 'var(--success)' : 'var(--text-dim)',
                          }}>
                            {activa ? '✓ ' : ''}{v.nom}
                          </button>
                        )
                      })}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => eliminarExpedicio(e.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem', marginLeft: '0.5rem' }}>✕</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
