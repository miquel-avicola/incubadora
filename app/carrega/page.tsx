'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatData, diaSemana } from '@/lib/dates'

interface Comanda {
  id: number
  tipus: string
  quantitat_pollets: number | null
  quantitat_ous_maquila: number | null
  clients: { nom: string }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  estat: string
  comandes: Comanda[]
}

interface ComandaPendent {
  id: number
  tipus: string
  quantitat_pollets: number | null
  quantitat_ous_maquila: number | null
  sexat: boolean
  data_prevista_naixement: string | null
  clients: { id: number; nom: string }
}

interface Client {
  id: number
  nom: string
}

const ESTAT_COLOR: Record<string, string> = {
  'Planificat': 'var(--text-dim)',
  'En curs': 'var(--accent)',
  'Completat': 'var(--success)',
  'Cancel·lat': 'var(--danger)',
}

export default function Carregues() {
  const [fulls, setFulls] = useState<Full[]>([])
  const [loading, setLoading] = useState(true)
  const [pendents, setPendents] = useState<ComandaPendent[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [mostrarFormPendent, setMostrarFormPendent] = useState(false)

  // Form nova comanda pendent
  const [clientId, setClientId] = useState('')
  const [tipus, setTipus] = useState<'Pollets' | 'Maquila'>('Pollets')
  const [quantitat, setQuantitat] = useState('')
  const [sexat, setSexat] = useState(false)
  const [dataNaixement, setDataNaixement] = useState('')
  const [creant, setCreant] = useState(false)

  const carregarDades = () => {
    fetch('/api/carrega')
      .then(r => r.json())
      .then(data => { setFulls(data); setLoading(false) })
    fetch('/api/comandes?pendents=true')
      .then(r => r.json())
      .then(data => setPendents(Array.isArray(data) ? data : []))
    fetch('/api/clients-list')
      .then(r => r.json())
      .then(setClients)
  }

  useEffect(() => { carregarDades() }, [])

  async function crearComandaPendent() {
    if (!clientId || !quantitat) return
    setCreant(true)
    await fetch('/api/comandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: parseInt(clientId),
        tipus,
        quantitat_pollets: tipus === 'Pollets' ? parseInt(quantitat) : null,
        quantitat_ous_maquila: tipus === 'Maquila' ? parseInt(quantitat) : null,
        sexat,
        data_prevista_naixement: dataNaixement || null,
      }),
    })
    setClientId(''); setQuantitat(''); setSexat(false); setDataNaixement('')
    setMostrarFormPendent(false)
    setCreant(false)
    carregarDades()
  }

  async function eliminarComandaPendent(id: number) {
    await fetch(`/api/comandes/${id}`, { method: 'DELETE' })
    carregarDades()
  }

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
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Inici</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Planificació</p>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Càrregues</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setMostrarFormPendent(!mostrarFormPendent)}
              style={{
                padding: '0.6rem 1rem', background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: '8px',
                color: 'var(--text)', fontWeight: 600, fontSize: '0.85rem',
                cursor: 'pointer', fontFamily: 'IBM Plex Sans',
              }}
            >
              + Comanda
            </button>
            <Link href="/carrega/nova" style={{ textDecoration: 'none' }}>
              <button style={{
                padding: '0.6rem 1rem', background: 'var(--accent)', border: 'none',
                borderRadius: '8px', color: '#0f1117', fontWeight: 700, fontSize: '0.85rem',
                cursor: 'pointer', fontFamily: 'IBM Plex Sans',
              }}>
                + Nova càrrega
              </button>
            </Link>
          </div>
        </div>

        {/* Formulari nova comanda pendent */}
        {mostrarFormPendent && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Nova comanda pendent</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Selecciona...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Data prevista de naixement</label>
                <input type="date" value={dataNaixement} onChange={e => setDataNaixement(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Tipus</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {(['Pollets', 'Maquila'] as const).map(t => (
                    <button key={t} onClick={() => setTipus(t)} style={{
                      flex: 1, padding: '0.6rem', border: '1px solid',
                      borderColor: tipus === t ? 'var(--accent)' : 'var(--border)',
                      borderRadius: '8px', cursor: 'pointer', fontFamily: 'IBM Plex Sans',
                      background: tipus === t ? 'rgba(240,180,41,0.1)' : 'var(--bg)',
                      color: tipus === t ? 'var(--accent)' : 'var(--text-dim)', fontSize: '0.85rem',
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>{tipus === 'Pollets' ? 'Pollets' : 'Ous maquila'}</label>
                <input type="number" value={quantitat} onChange={e => setQuantitat(e.target.value)} placeholder="0" style={inputStyle} />
              </div>
            </div>

            {tipus === 'Pollets' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                <input type="checkbox" checked={sexat} onChange={e => setSexat(e.target.checked)} />
                Sexat
              </label>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setMostrarFormPendent(false)} style={{ flex: 1, padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                Cancel·lar
              </button>
              <button onClick={crearComandaPendent} disabled={!clientId || !quantitat || creant} style={{
                flex: 2, padding: '0.7rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                fontFamily: 'IBM Plex Sans', cursor: 'pointer',
                background: (!clientId || !quantitat || creant) ? 'var(--border)' : 'var(--accent)',
                color: (!clientId || !quantitat || creant) ? 'var(--text-dim)' : '#0f1117',
              }}>
                {creant ? 'Guardant...' : 'Guardar comanda'}
              </button>
            </div>
          </div>
        )}

        {/* Comandes pendents */}
        {pendents.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              Comandes pendents sense càrrega ({pendents.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {pendents.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.clients.nom}</span>
                    <span style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem', marginLeft: '0.5rem' }}>
                      {c.tipus === 'Pollets'
                        ? `${(c.quantitat_pollets || 0).toLocaleString()} pollets`
                        : `${(c.quantitat_ous_maquila || 0).toLocaleString()} ous maq.`}
                      {c.sexat && ' · sexat'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {c.data_prevista_naixement && (
                      <span style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem' }}>
                        naix. {formatData(c.data_prevista_naixement)}
                      </span>
                    )}
                    <button onClick={() => eliminarComandaPendent(c.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Carregant...</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {fulls.map(full => {
            const totalPollets = full.comandes.filter(c => c.tipus === 'Pollets').reduce((s, c) => s + (c.quantitat_pollets || 0), 0)
            const totalMaquila = full.comandes.filter(c => c.tipus === 'Maquila').reduce((s, c) => s + (c.quantitat_ous_maquila || 0), 0)
            return (
              <Link key={full.id} href={`/carrega/${full.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>#{full.num_carrega}</span>
                        <span style={{ fontSize: '0.75rem', color: ESTAT_COLOR[full.estat] || 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{full.estat}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                        Càrrega: <strong>{formatData(full.carrega)}</strong> ({diaSemana(full.carrega)})
                      </div>
                      {full.transferencia && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                          Transferència: {formatData(full.transferencia)} · Naixement: {formatData(
                            new Date(new Date(full.carrega).getTime() + 21 * 86400000).toISOString().split('T')[0]
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {totalPollets > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{totalPollets.toLocaleString()} pollets</div>}
                      {totalMaquila > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{totalMaquila.toLocaleString()} ous maq.</div>}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>{full.comandes.length} comanda{full.comandes.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  {full.comandes.length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {full.comandes.map(c => (
                        <span key={c.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                          {c.clients.nom}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}