'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import Link from 'next/link'

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(v: number | null) { return v === null ? '—' : `${v}%` }
function fmtOus(v: number) { return v === 0 ? '—' : v.toLocaleString('ca') }

function semafar(v: number | null, tipus: 'f' | 'e' | 'p'): string {
  if (v === null) return 'var(--text-dim)'
  if (tipus === 'p') return v < 5 ? 'var(--success)' : v < 12 ? '#f59e0b' : 'var(--danger)'
  return v >= 82 ? 'var(--success)' : v >= 72 ? '#f59e0b' : 'var(--danger)'
}

function fmtData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ─── Tipus ──────────────────────────────────────────────────────────────────

interface SubStats {
  carros: number
  ous: number
  fertils: number
  explosius: number
  pollets_previstos: number
  pollets_nascuts: number
  fertilitat: number | null
  taxa_eclosio: number | null
  taxa_naixement: number | null
}

interface LotStats extends SubStats {
  lot_id: number
  nom: string
  propera_naix: string | null
  per_incubadora: (SubStats & { numero: number; model: string })[]
  per_naixedora: (SubStats & { numero: number })[]
}

interface IncStats extends SubStats {
  numero: number
  model: string
  lots: (SubStats & { lot_id: number; nom: string })[]
}

interface NaixStats extends SubStats {
  numero: number
  lots: (SubStats & { lot_id: number; nom: string })[]
}

interface StatsData {
  resum: SubStats & { pollets_total: number }
  per_lot: LotStats[]
  per_incubadora: IncStats[]
  per_naixedora: NaixStats[]
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem',
  fontSize: '0.7rem',
  fontFamily: 'IBM Plex Mono, monospace',
  color: 'var(--text-dim)',
  textAlign: 'center',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem',
  fontSize: '0.82rem',
  fontFamily: 'IBM Plex Mono, monospace',
  textAlign: 'center',
  borderBottom: '1px solid var(--border)',
}

function Pollets({ prev, reals }: { prev: number; reals: number }) {
  if (prev === 0 && reals === 0) return <span style={{ color: 'var(--text-dim)' }}>—</span>
  if (reals > 0 && prev === 0) {
    return <span style={{ color: 'var(--success)' }}>{reals.toLocaleString('ca')}</span>
  }
  if (prev > 0 && reals === 0) {
    return <span style={{ color: '#f59e0b' }}>~{prev.toLocaleString('ca')}</span>
  }
  return (
    <span>
      <span style={{ color: 'var(--success)' }}>{reals.toLocaleString('ca')}</span>
      {' + '}
      <span style={{ color: '#f59e0b' }}>~{prev.toLocaleString('ca')}</span>
    </span>
  )
}

// ─── Pàgina principal ────────────────────────────────────────────────────────

export default function Estadistiques() {
  const [filtre, setFiltre] = useState<string>('365')
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedLots, setExpandedLots] = useState<Set<number>>(new Set())
  const [expandedIncs, setExpandedIncs] = useState<Set<number>>(new Set())
  const [expandedNaix, setExpandedNaix] = useState<Set<number>>(new Set())

  const carregarDades = useCallback(async () => {
    setLoading(true)
    const params = filtre !== 'tot' ? `?dies=${filtre}` : ''
    const res = await fetch(`/api/estadistiques${params}`)
    const data = await res.json()
    setStats(data)
    setLoading(false)
  }, [filtre])

  useEffect(() => { carregarDades() }, [carregarDades])

  function toggleLot(id: number) {
    setExpandedLots(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleInc(num: number) {
    setExpandedIncs(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }
  function toggleNaix(num: number) {
    setExpandedNaix(prev => {
      const next = new Set(prev)
      next.has(num) ? next.delete(num) : next.add(num)
      return next
    })
  }

  const card = (label: string, value: string, color = 'var(--text)', sub?: string) => (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
      padding: '1rem', textAlign: 'center', flex: 1, minWidth: 110,
    }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', marginTop: '0.1rem' }}>{sub}</div>}
      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )

  const seccioLabel = (text: string) => (
    <div style={{
      fontSize: '0.68rem', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-dim)',
      textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.65rem',
    }}>{text}</div>
  )

  if (loading || !stats) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '3rem' }}>
        Carregant estadístiques...
      </p>
    </main>
  )

  const r = stats.resum

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.82rem', fontFamily: 'IBM Plex Mono' }}>← Inici</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Admin</p>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Estadístiques globals</h1>
            </div>
          </div>

          {/* Filtre temporal */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { val: '90', label: '3 mesos' },
              { val: '180', label: '6 mesos' },
              { val: '365', label: '1 any' },
              { val: 'tot', label: 'Tot' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setFiltre(val)}
                style={{
                  padding: '0.4rem 0.85rem',
                  background: filtre === val ? 'var(--accent)' : 'var(--surface)',
                  color: filtre === val ? '#0f1117' : 'var(--text)',
                  border: `1px solid ${filtre === val ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontWeight: filtre === val ? 700 : 400,
                  cursor: 'pointer',
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Llegenda pollets */}
        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem', fontSize: '0.72rem', fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-dim)' }}>
          <span><span style={{ color: 'var(--success)' }}>■</span> Pollets nascuts (real)</span>
          <span><span style={{ color: '#f59e0b' }}>■</span> Pollets previstos (~estimació)</span>
        </div>

        {/* Cards resum */}
        {seccioLabel('Resum global')}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
          {card('Fertilitat', fmt(r.fertilitat), semafar(r.fertilitat, 'f'))}
          {card('Taxa eclosió', fmt(r.taxa_eclosio), semafar(r.taxa_eclosio, 'e'))}
          {card('Taxa naixement', fmt(r.taxa_naixement), semafar(r.taxa_naixement, 'e'))}
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          {card('Ous carregats', r.ous.toLocaleString('ca'))}
          {card('Ous fèrtils', r.fertils.toLocaleString('ca'))}
          {card('Explosius', r.explosius > 0 ? r.explosius.toLocaleString('ca') : '—', r.explosius > 0 ? 'var(--danger)' : 'var(--text)')}
          {card(
            'Pollets (prev + reals)',
            r.pollets_nascuts > 0 ? r.pollets_nascuts.toLocaleString('ca') : '—',
            'var(--success)',
            r.pollets_previstos > 0 ? `+ ~${r.pollets_previstos.toLocaleString('ca')} prev.` : undefined,
          )}
        </div>

        {/* ── Per lot ───────────────────────────────────────────────────────── */}
        {stats.per_lot.length > 0 && (
          <>
            {seccioLabel('Per lot de reproductores')}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '2rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr>
                    {[
                      ['Lot', 'left', 160],
                      ['Carros', 'center', 60],
                      ['Ous', 'center', 80],
                      ['Fèrtils', 'center', 80],
                      ['Expl.', 'center', 65],
                      ['Pollets reals', 'center', 100],
                      ['Pollets prev.', 'center', 100],
                      ['% Fert.', 'center', 65],
                      ['% Naix.', 'center', 65],
                      ['Propera naix.', 'center', 95],
                      ['', 'center', 36],
                    ].map(([h, align, w]) => (
                      <th key={h as string} style={{ ...thStyle, textAlign: align as 'left' | 'center', width: w as number }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.per_lot.map((l, i) => (
                    <Fragment key={`lot-${l.lot_id}`}>
                      {/* Fila principal lot */}
                      <tr style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>{l.nom}</td>
                        <td style={tdStyle}>{l.carros}</td>
                        <td style={tdStyle}>{fmtOus(l.ous)}</td>
                        <td style={tdStyle}>{fmtOus(l.fertils)}</td>
                        <td style={{ ...tdStyle, color: l.explosius > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                          {l.explosius > 0 ? l.explosius : '—'}
                        </td>
                        <td style={tdStyle}>
                          {l.pollets_nascuts > 0
                            ? <span style={{ color: 'var(--success)' }}>{l.pollets_nascuts.toLocaleString('ca')}</span>
                            : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {l.pollets_previstos > 0
                            ? <span style={{ color: '#f59e0b' }}>~{l.pollets_previstos.toLocaleString('ca')}</span>
                            : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, color: semafar(l.fertilitat, 'f') }}>{fmt(l.fertilitat)}</td>
                        <td style={{ ...tdStyle, color: semafar(l.taxa_naixement, 'e') }}>{fmt(l.taxa_naixement)}</td>
                        <td style={{ ...tdStyle, color: l.propera_naix ? 'var(--success)' : 'var(--text-dim)' }}>
                          {fmtData(l.propera_naix)}
                        </td>
                        <td style={{ ...tdStyle, padding: '0.3rem' }}>
                          {(l.per_incubadora.length > 0 || l.per_naixedora.length > 0) && (
                            <button
                              onClick={() => toggleLot(l.lot_id)}
                              style={{
                                background: 'transparent', border: '1px solid var(--border)',
                                borderRadius: '4px', color: 'var(--text-dim)', cursor: 'pointer',
                                fontSize: '0.75rem', padding: '0.2rem 0.45rem', fontFamily: 'IBM Plex Mono',
                              }}
                            >{expandedLots.has(l.lot_id) ? '▲' : '▼'}</button>
                          )}
                        </td>
                      </tr>

                      {/* Sub-files expandides */}
                      {expandedLots.has(l.lot_id) && (
                        <tr>
                          <td colSpan={11} style={{ padding: '0.5rem 1rem 1rem', background: 'rgba(255,255,255,0.015)' }}>
                            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>

                              {/* Per incubadora */}
                              {l.per_incubadora.length > 0 && (
                                <div style={{ flex: 1, minWidth: 300 }}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                                    Incubadores
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr>
                                        {['Inc.', 'Model', 'Ous', 'Fèrtils', 'Pollets', '% Fert.', '% Naix.'].map(h => (
                                          <th key={h} style={{ ...thStyle, fontSize: '0.65rem', padding: '0.3rem 0.5rem' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {l.per_incubadora.map(inc => (
                                        <tr key={`li-${inc.numero}`}>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>{inc.numero}</td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem', textAlign: 'left' }}>{inc.model}</td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>{fmtOus(inc.ous)}</td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>{fmtOus(inc.fertils)}</td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>
                                            <Pollets prev={inc.pollets_previstos} reals={inc.pollets_nascuts} />
                                          </td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem', color: semafar(inc.fertilitat, 'f') }}>{fmt(inc.fertilitat)}</td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem', color: semafar(inc.taxa_naixement, 'e') }}>{fmt(inc.taxa_naixement)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Per naixedora */}
                              {l.per_naixedora.length > 0 && (
                                <div style={{ flex: 1, minWidth: 280 }}>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                                    Naixedores
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr>
                                        {['N.', 'Ous', 'Fèrtils', 'Pollets', '% Eclosió'].map(h => (
                                          <th key={h} style={{ ...thStyle, fontSize: '0.65rem', padding: '0.3rem 0.5rem' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {l.per_naixedora.map(n => (
                                        <tr key={`ln-${n.numero}`}>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>N{n.numero}</td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>{fmtOus(n.ous)}</td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>{fmtOus(n.fertils)}</td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>
                                            <Pollets prev={n.pollets_previstos} reals={n.pollets_nascuts} />
                                          </td>
                                          <td style={{ ...tdStyle, fontSize: '0.78rem', color: semafar(n.taxa_eclosio, 'e') }}>{fmt(n.taxa_eclosio)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Per incubadora ────────────────────────────────────────────────── */}
        {stats.per_incubadora.length > 0 && (
          <>
            {seccioLabel('Per incubadora')}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '2rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    {[
                      ['Inc.', 'center', 50],
                      ['Model', 'left', 130],
                      ['Carros', 'center', 65],
                      ['Ous', 'center', 80],
                      ['Fèrtils', 'center', 80],
                      ['Pollets reals', 'center', 100],
                      ['Pollets prev.', 'center', 100],
                      ['% Fert.', 'center', 65],
                      ['% Naix.', 'center', 65],
                      ['', 'center', 36],
                    ].map(([h, align, w]) => (
                      <th key={h as string} style={{ ...thStyle, textAlign: align as 'left' | 'center', width: w as number }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.per_incubadora.map((inc, i) => (
                    <Fragment key={`inc-${inc.numero}`}>
                      <tr style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent', fontWeight: 600 }}>
                        <td style={tdStyle}>{inc.numero}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{inc.model}</td>
                        <td style={tdStyle}>{inc.carros}</td>
                        <td style={tdStyle}>{fmtOus(inc.ous)}</td>
                        <td style={tdStyle}>{fmtOus(inc.fertils)}</td>
                        <td style={tdStyle}>
                          {inc.pollets_nascuts > 0
                            ? <span style={{ color: 'var(--success)' }}>{inc.pollets_nascuts.toLocaleString('ca')}</span>
                            : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {inc.pollets_previstos > 0
                            ? <span style={{ color: '#f59e0b' }}>~{inc.pollets_previstos.toLocaleString('ca')}</span>
                            : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, color: semafar(inc.fertilitat, 'f') }}>{fmt(inc.fertilitat)}</td>
                        <td style={{ ...tdStyle, color: semafar(inc.taxa_naixement, 'e') }}>{fmt(inc.taxa_naixement)}</td>
                        <td style={{ ...tdStyle, padding: '0.3rem' }}>
                          {inc.lots.length > 0 && (
                            <button
                              onClick={() => toggleInc(inc.numero)}
                              style={{
                                background: 'transparent', border: '1px solid var(--border)',
                                borderRadius: '4px', color: 'var(--text-dim)', cursor: 'pointer',
                                fontSize: '0.75rem', padding: '0.2rem 0.45rem', fontFamily: 'IBM Plex Mono',
                              }}
                            >{expandedIncs.has(inc.numero) ? '▲' : '▼'}</button>
                          )}
                        </td>
                      </tr>
                      {expandedIncs.has(inc.numero) && inc.lots.map(l => (
                        <tr key={`inc-${inc.numero}-l-${l.lot_id}`} style={{ background: 'rgba(255,255,255,0.035)', fontSize: '0.78rem' }}>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)' }}></td>
                          <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: '1.5rem', color: 'var(--text-dim)', fontWeight: 400 }}>└ {l.nom}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)', fontSize: '0.78rem' }}>{l.carros}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)', fontSize: '0.78rem' }}>{fmtOus(l.ous)}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)', fontSize: '0.78rem' }}>{fmtOus(l.fertils)}</td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>
                            {l.pollets_nascuts > 0
                              ? <span style={{ color: 'var(--success)' }}>{l.pollets_nascuts.toLocaleString('ca')}</span>
                              : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>
                            {l.pollets_previstos > 0
                              ? <span style={{ color: '#f59e0b' }}>~{l.pollets_previstos.toLocaleString('ca')}</span>
                              : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem', color: semafar(l.fertilitat, 'f') }}>{fmt(l.fertilitat)}</td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem', color: semafar(l.taxa_naixement, 'e') }}>{fmt(l.taxa_naixement)}</td>
                          <td></td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Per naixedora ─────────────────────────────────────────────────── */}
        {stats.per_naixedora.length > 0 && (
          <>
            {seccioLabel('Per naixedora')}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '2rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                <thead>
                  <tr>
                    {[
                      ['N.', 'center', 50],
                      ['Carros', 'center', 65],
                      ['Ous', 'center', 80],
                      ['Fèrtils', 'center', 80],
                      ['Pollets reals', 'center', 100],
                      ['Pollets prev.', 'center', 100],
                      ['% Eclosió', 'center', 80],
                      ['% Naix.', 'center', 65],
                      ['', 'center', 36],
                    ].map(([h, align, w]) => (
                      <th key={h as string} style={{ ...thStyle, textAlign: align as 'left' | 'center', width: w as number }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.per_naixedora.map((n, i) => (
                    <Fragment key={`naix-${n.numero}`}>
                      <tr style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent', fontWeight: 600 }}>
                        <td style={tdStyle}>N{n.numero}</td>
                        <td style={tdStyle}>{n.carros}</td>
                        <td style={tdStyle}>{fmtOus(n.ous)}</td>
                        <td style={tdStyle}>{fmtOus(n.fertils)}</td>
                        <td style={tdStyle}>
                          {n.pollets_nascuts > 0
                            ? <span style={{ color: 'var(--success)' }}>{n.pollets_nascuts.toLocaleString('ca')}</span>
                            : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {n.pollets_previstos > 0
                            ? <span style={{ color: '#f59e0b' }}>~{n.pollets_previstos.toLocaleString('ca')}</span>
                            : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, color: semafar(n.taxa_eclosio, 'e') }}>{fmt(n.taxa_eclosio)}</td>
                        <td style={{ ...tdStyle, color: semafar(n.taxa_naixement, 'e') }}>{fmt(n.taxa_naixement)}</td>
                        <td style={{ ...tdStyle, padding: '0.3rem' }}>
                          {n.lots.length > 0 && (
                            <button
                              onClick={() => toggleNaix(n.numero)}
                              style={{
                                background: 'transparent', border: '1px solid var(--border)',
                                borderRadius: '4px', color: 'var(--text-dim)', cursor: 'pointer',
                                fontSize: '0.75rem', padding: '0.2rem 0.45rem', fontFamily: 'IBM Plex Mono',
                              }}
                            >{expandedNaix.has(n.numero) ? '▲' : '▼'}</button>
                          )}
                        </td>
                      </tr>
                      {expandedNaix.has(n.numero) && n.lots.map(l => (
                        <tr key={`naix-${n.numero}-l-${l.lot_id}`} style={{ background: 'rgba(255,255,255,0.035)' }}>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)', fontSize: '0.78rem' }}></td>
                          <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: '1.5rem', color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 400 }}>└ {l.nom}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)', fontSize: '0.78rem' }}>{l.carros}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)', fontSize: '0.78rem' }}>{fmtOus(l.ous)}</td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>
                            {l.pollets_nascuts > 0
                              ? <span style={{ color: 'var(--success)' }}>{l.pollets_nascuts.toLocaleString('ca')}</span>
                              : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem' }}>
                            {l.pollets_previstos > 0
                              ? <span style={{ color: '#f59e0b' }}>~{l.pollets_previstos.toLocaleString('ca')}</span>
                              : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem', color: semafar(l.taxa_eclosio, 'e') }}>{fmt(l.taxa_eclosio)}</td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem', color: semafar(l.taxa_naixement, 'e') }}>{fmt(l.taxa_naixement)}</td>
                          <td></td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {stats.per_lot.length === 0 && stats.per_incubadora.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', padding: '3rem', fontSize: '0.85rem' }}>
            No hi ha dades per al període seleccionat.
          </div>
        )}

      </div>
    </main>
  )
}
