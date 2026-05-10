'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatData, diaSemana, calcularNaixement } from '@/lib/dates'

interface Assignacio {
  id: number
  num_carro_full: number
  hora_entrada: string | null
  previsio_naixement: number | null
  carros_estoc: {
    id: number
    posta: string
    quantitat_ous: number
    lots_reproductores: {
      id: number
      data_naixement: string
      estirp: string | null
      granges_reproductores: { granja: string; nom_informal: string | null }
    }
  }
  incubadores: { id: number; numero: number; model: string; tipus: string }
}

interface Comanda {
  id: number
  tipus: string
  quantitat_pollets: number | null
  quantitat_ous_maquila: number | null
  previsio_naixement: number | null
  sexat: boolean
  clients: { id: number; nom: string }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  estat: string
  comandes: Comanda[]
  assignacions: Assignacio[]
}

export default function DetallCarrega() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuObert, setMenuObert] = useState(false)

  const carregarDades = useCallback(() => {
    if (!params.id) return
    fetch(`/api/carrega/${params.id}`)
      .then(r => r.json())
      .then(data => { setFull(data); setLoading(false) })
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  if (loading) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  if (!full) return null

  const naixement = calcularNaixement(full.carrega)
  const totalPollets = full.comandes.filter(c => c.tipus === 'Pollets').reduce((s, c) => s + (c.quantitat_pollets || 0), 0)
  const totalMaquila = full.comandes.filter(c => c.tipus === 'Maquila').reduce((s, c) => s + (c.quantitat_ous_maquila || 0), 0)

  // Calcular pollets previstos per les assignacions
  const totalOusAssignats = full.assignacions.reduce((s, a) => s + a.carros_estoc.quantitat_ous, 0)
  const totalPolletsPrevistos = full.assignacions.reduce((s, a) => {
    const prev = a.previsio_naixement || 0
    return s + Math.round(a.carros_estoc.quantitat_ous * prev)
  }, 0)

  // Agrupar assignacions per incubadora
  const perIncubadora: Record<number, Assignacio[]> = {}
  full.assignacions.forEach(a => {
    const num = a.incubadores.numero
    if (!perIncubadora[num]) perIncubadora[num] = []
    perIncubadora[num].push(a)
  })

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/carrega" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrregues</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Càrrega</p>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>#{full.num_carrega}</h1>
            </div>
          </div>
         <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuObert(!menuObert)}
              style={{
                padding: '0.6rem 1.1rem',
                background: 'var(--accent)',
                border: 'none', borderRadius: '8px',
                color: '#0f1117', fontWeight: 700, fontSize: '0.9rem',
                cursor: 'pointer', fontFamily: 'IBM Plex Sans',
              }}
            >
              Accions ▾
            </button>
            {menuObert && (
              <>
                <div
                  onClick={() => setMenuObert(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                />
                <div style={{
                  position: 'absolute', right: 0, top: '110%',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '10px', overflow: 'hidden', zIndex: 100,
                  minWidth: '200px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}>
                  {[
                    { href: `/carrega/${full.id}/imprimir`, label: '🖨️ Imprimir', target: '_blank' },
                    { href: `/carrega/${full.id}/assignacions`, label: '+ Assignar carros' },
                    { href: `/carrega/${full.id}/vacunes`, label: 'Pla vacunal' },
                    { href: `/carrega/${full.id}/transferencia`, label: 'Transferència' },
                    { href: `/carrega/${full.id}/naixement`, label: 'Naixement' },
                    { href: `/carrega/${full.id}/expedicions`, label: 'Expedicions' },
                    { href: `/carrega/${full.id}/estadistiques`, label: '📊 Estadístiques' },
                  ].map((item, i, arr) => (
                    <Link
                      key={i}
                      href={item.href}
                      target={item.target as '_blank' | undefined}
                      style={{ textDecoration: 'none' }}
                      onClick={() => setMenuObert(false)}
                    >
                      <div style={{
                        padding: '0.85rem 1rem',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        fontFamily: 'IBM Plex Sans',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        background: 'transparent',
                      }}>
                        {item.label}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info dates */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Càrrega</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatData(full.carrega)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{diaSemana(full.carrega)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Transferència</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{full.transferencia ? formatData(full.transferencia) : '—'}</div>
            {full.transferencia && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{diaSemana(full.transferencia)}</div>}
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Naixement</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatData(naixement)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{diaSemana(naixement)}</div>
          </div>
        </div>

        {/* Resum pollets */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Resum</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--accent)' }}>{full.assignacions.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>carros</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--text)' }}>{totalOusAssignats.toLocaleString()}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>ous</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: totalPolletsPrevistos >= totalPollets ? 'var(--success)' : 'var(--danger)' }}>
                {totalPolletsPrevistos.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>pollets prev.</div>
            </div>
          </div>
          {totalPollets > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', fontFamily: 'IBM Plex Mono' }}>
              Objectiu: {totalPollets.toLocaleString()} pollets{totalMaquila > 0 ? ` + ${totalMaquila.toLocaleString()} ous maq.` : ''}
            </div>
          )}
        </div>

        {/* Comandes */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Comandes</div>
          {full.comandes.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>Sense comandes</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {full.comandes.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: 'var(--bg)', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.clients.nom}</span>
                    {c.sexat && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--accent)', fontFamily: 'IBM Plex Mono' }}>SEXAT</span>}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                    {c.tipus === 'Pollets' ? `${(c.quantitat_pollets || 0).toLocaleString()} pollets` : `${(c.quantitat_ous_maquila || 0).toLocaleString()} ous maq.`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assignacions per incubadora */}
        {full.assignacions.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Assignacions ({full.assignacions.length} carros)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(perIncubadora).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([num, assigs]) => (
                <div key={num}>
                  <div style={{ fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', marginBottom: '0.4rem' }}>
                    Incubadora {num} — {assigs[0].incubadores.model} ({assigs[0].incubadores.tipus === 'Singlestage' ? 'SS' : 'MS'})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {assigs.sort((a, b) => a.num_carro_full - b.num_carro_full).map(a => {
                      const lot = a.carros_estoc.lots_reproductores
                      const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
                      return (
                        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.75rem', background: 'var(--bg)', borderRadius: '6px', fontSize: '0.8rem' }}>
                          <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', minWidth: '2rem' }}>C{a.num_carro_full}</span>
                          <span style={{ flex: 1, marginLeft: '0.5rem' }}>{granja} {lot.estirp}</span>
                          <span style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem' }}>
                            {a.carros_estoc.posta}
                          </span>
                          {a.previsio_naixement && (
                            <span style={{ marginLeft: '0.75rem', color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem' }}>
                              {Math.round(a.previsio_naixement * 100)}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
