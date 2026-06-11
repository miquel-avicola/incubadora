'use client'

import { useState } from 'react'
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

interface Candidat {
  id: number
  num_carrega: number
  carrega: string
  darrer_naixement: string
  dies_sense_activitat: number
  n_carros: number
}

const ESTAT_COLOR: Record<string, string> = {
  'Planificat': 'var(--text-dim)',
  'Finalitzat': 'var(--success)',
}

export function LlistaCarregues({
  fullsInicial,
  candidatsInicial,
  llindarDies,
}: {
  fullsInicial: Full[]
  candidatsInicial: Candidat[]
  llindarDies: number
}) {
  const [mostrarFinalitzats, setMostrarFinalitzats] = useState(false)
  const [candidats, setCandidats] = useState<Candidat[]>(candidatsInicial)
  const [fulls, setFulls] = useState<Full[]>(fullsInicial)
  const [finalitzantId, setFinalitzantId] = useState<number | null>(null)

  const finalitzarCandidat = async (c: Candidat) => {
    if (!confirm('Vols finalitzar el full #' + c.num_carrega + '?')) return
    setFinalitzantId(c.id)
    const res = await fetch('/api/carrega/' + c.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estat: 'Finalitzat' }),
    })
    setFinalitzantId(null)
    if (!res.ok) {
      alert("No s'ha pogut finalitzar el full.")
      return
    }
    setCandidats(prev => prev.filter(x => x.id !== c.id))
    setFulls(prev => prev.map(f => f.id === c.id ? { ...f, estat: 'Finalitzat' } : f))
  }

  const fullsFinalitzats = fulls.filter(f => f.estat === 'Finalitzat')
  const fullsActius = fulls.filter(f => f.estat !== 'Finalitzat')
  const fullsVisibles = mostrarFinalitzats ? fulls : fullsActius

  return (
    <div>
      {candidats.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '10px',
          padding: '0.9rem 1.1rem',
          marginBottom: '1rem',
        }}>
          <div style={{
            fontSize: '0.7rem',
            fontFamily: 'IBM Plex Mono',
            color: '#f59e0b',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '0.6rem',
            fontWeight: 700,
          }}>
            {candidats.length} full{candidats.length !== 1 ? 's' : ''} pendent{candidats.length !== 1 ? 's' : ''} de tancar
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.7rem' }}>
            Tots els carros tenen el naixement registrat i fa {'>='}{llindarDies} dies sense activitat.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
            {candidats.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface)', borderRadius: '6px', padding: '0.5rem 0.75rem',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <Link href={'/carrega/' + c.id} style={{ textDecoration: 'none', color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontWeight: 700, fontSize: '0.9rem' }}>
                    #{c.num_carrega}
                  </Link>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                    Càrrega {formatData(c.carrega)} · darrer naixement fa {c.dies_sense_activitat} dies · {c.n_carros} carros
                  </div>
                </div>
                <button
                  onClick={() => finalitzarCandidat(c)}
                  disabled={finalitzantId === c.id}
                  style={{
                    background: 'var(--success)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#0f1117',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.75rem',
                    fontFamily: 'IBM Plex Sans',
                    fontWeight: 700,
                    cursor: finalitzantId === c.id ? 'wait' : 'pointer',
                    opacity: finalitzantId === c.id ? 0.6 : 1,
                  }}
                >
                  {finalitzantId === c.id ? '...' : '✓ Finalitzar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {fullsFinalitzats.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <button
            onClick={() => setMostrarFinalitzats(!mostrarFinalitzats)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-dim)',
              padding: '0.35rem 0.7rem',
              fontSize: '0.75rem',
              fontFamily: 'IBM Plex Mono',
              cursor: 'pointer',
            }}
          >
            {mostrarFinalitzats ? 'Amagar finalitzats (' + fullsFinalitzats.length + ')' : 'Mostrar finalitzats (' + fullsFinalitzats.length + ')'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '0.75rem' }}>
        {fullsVisibles.map(full => {
          const totalPollets = full.comandes.filter(c => c.tipus === 'Pollets').reduce((s, c) => s + (c.quantitat_pollets || 0), 0)
          const totalMaquila = full.comandes.filter(c => c.tipus === 'Maquila').reduce((s, c) => s + (c.quantitat_ous_maquila || 0), 0)
          return (
            <Link key={full.id} href={'/carrega/' + full.id} style={{ textDecoration: 'none' }}>
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
  )
}
