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

const ESTAT_COLOR: Record<string, string> = {
  'Planificat': 'var(--text-dim)',
  'En curs': 'var(--accent)',
  'Completat': 'var(--success)',
  'Cancel·lat': 'var(--danger)',
}

export default function Carregues() {
  const [fulls, setFulls] = useState<Full[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/carrega')
      .then(r => r.json())
      .then(data => { setFulls(data); setLoading(false) })
  }, [])

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
