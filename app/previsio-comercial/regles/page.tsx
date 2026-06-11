'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Regla {
  id: number
  client_id: number
  dia_setmana: number
  tipus: 'Pollets' | 'Maquila'
  quantitat: number
  actiu: boolean
  observacions: string | null
  clients: { nom: string }
}

interface Client {
  id: number
  nom: string
}

const DIES = ['Diumenge', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte']

export default function ReglesRecurrents() {
  const [regles, setRegles] = useState<Regla[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  // Formulari nova regla
  const [nouClientId, setNouClientId] = useState('')
  const [nouDia, setNouDia] = useState('1') // dilluns per defecte
  const [nouTipus, setNouTipus] = useState<'Pollets' | 'Maquila'>('Pollets')
  const [nouaQuantitat, setNouaQuantitat] = useState('')
  const [creant, setCreant] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const [resR, resC] = await Promise.all([
      fetch('/api/previsio-recurrent').then(r => r.json()),
      fetch('/api/clients-list').then(r => r.json()),
    ])
    setRegles(resR || [])
    setClients(resC?.clients || resC || [])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function crear() {
    if (!nouClientId || !nouaQuantitat) {
      alert('Cal triar client i posar quantitat')
      return
    }
    setCreant(true)
    const res = await fetch('/api/previsio-recurrent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: parseInt(nouClientId),
        dia_setmana: parseInt(nouDia),
        tipus: nouTipus,
        quantitat: parseInt(nouaQuantitat),
      }),
    })
    setCreant(false)
    if (!res.ok) {
      const err = await res.json()
      alert(`Error: ${err.error || 'desconegut'}`)
      return
    }
    setNouClientId('')
    setNouaQuantitat('')
    carregar()
  }

  async function toggle(r: Regla) {
    await fetch(`/api/previsio-recurrent/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actiu: !r.actiu }),
    })
    carregar()
  }

  async function eliminar(r: Regla) {
    if (!confirm(`Eliminar la regla de ${r.clients.nom} ${DIES[r.dia_setmana]} ${r.quantitat} ${r.tipus}?`)) return
    await fetch(`/api/previsio-recurrent/${r.id}`, { method: 'DELETE' })
    carregar()
  }

  const inputBase: React.CSSProperties = {
    padding: '0.5rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '6px', color: 'var(--text)', fontFamily: 'IBM Plex Sans', fontSize: '0.85rem', outline: 'none',
  }

  if (loading) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  // Ordenar regles per dia setmana → client → tipus
  const reglesOrd = [...regles].sort((a, b) => {
    if (a.dia_setmana !== b.dia_setmana) return a.dia_setmana - b.dia_setmana
    if (a.clients.nom !== b.clients.nom) return a.clients.nom.localeCompare(b.clients.nom)
    return a.tipus.localeCompare(b.tipus)
  })

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <Link href="/previsio-comercial" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Previsió comercial</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Configuració</p>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Regles recurrents</h1>
          </div>
        </div>

        {/* Formulari nova regla */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Afegir regla
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
            <select value={nouClientId} onChange={e => setNouClientId(e.target.value)} style={inputBase}>
              <option value="">— Client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
            <select value={nouDia} onChange={e => setNouDia(e.target.value)} style={inputBase}>
              {DIES.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <select value={nouTipus} onChange={e => setNouTipus(e.target.value as any)} style={inputBase}>
              <option value="Pollets">Pollets</option>
              <option value="Maquila">Maquila</option>
            </select>
            <input
              type="number"
              placeholder="Quantitat"
              value={nouaQuantitat}
              onChange={e => setNouaQuantitat(e.target.value)}
              style={{ ...inputBase, fontFamily: 'IBM Plex Mono', textAlign: 'right' }}
            />
            <button
              onClick={crear}
              disabled={creant}
              style={{
                padding: '0.55rem 0.9rem', background: 'var(--accent)', color: '#0f1117',
                border: 'none', borderRadius: '6px', fontFamily: 'IBM Plex Sans',
                fontWeight: 700, fontSize: '0.85rem', cursor: creant ? 'wait' : 'pointer',
              }}
            >
              + Afegir
            </button>
          </div>
        </div>

        {/* Llista */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          {reglesOrd.length === 0 && (
            <p style={{ padding: '1rem', color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
              Encara no hi ha cap regla. Afegeix-ne una a sobre.
            </p>
          )}
          {reglesOrd.map(r => (
            <div key={r.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: r.actiu ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                <div style={{ minWidth: '5.5rem', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem', color: 'var(--accent)' }}>
                  {DIES[r.dia_setmana]}
                </div>
                <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: 600 }}>
                  {r.clients.nom}
                  <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
                    {r.tipus}
                  </span>
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
                  {r.quantitat.toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.75rem' }}>
                <button onClick={() => toggle(r)} style={{
                  padding: '0.35rem 0.7rem', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: '6px', color: r.actiu ? 'var(--text)' : 'var(--text-dim)', fontFamily: 'IBM Plex Mono',
                  fontSize: '0.75rem', cursor: 'pointer',
                }}>
                  {r.actiu ? 'Activa' : 'Inactiva'}
                </button>
                <button onClick={() => eliminar(r)} style={{
                  padding: '0.35rem 0.55rem', background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: '6px', color: 'var(--danger)', fontFamily: 'IBM Plex Mono',
                  fontSize: '0.75rem', cursor: 'pointer',
                }}>
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
