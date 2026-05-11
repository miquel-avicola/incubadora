// app/lots/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Resultat {
  carro_id: number
  posta: string
  setmana_vida: number
  num_carrega: number | null
  data_carrega: string | null
  quantitat_ous: number
  ous_fertils: number | null
  pollets_nascuts: number | null
  pollets_descartats: number | null
  data_naixement_pollets: string | null
  fertilitat: number | null
  eclosio: number | null
  naixement: number | null
}

interface LotData {
  lot: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: { granja: string; nom_informal: string | null }
  }
  resultats: Resultat[]
}

// ─── Semàfor de colors ─────────────────────────────────────────────────────
function colorFertilitat(v: number | null) {
  if (v === null) return 'var(--text-dim)'
  return v >= 82 ? '#22c55e' : v >= 72 ? '#f0b429' : '#ef4444'
}
function colorEclosio(v: number | null) {
  if (v === null) return 'var(--text-dim)'
  return v >= 82 ? '#22c55e' : v >= 72 ? '#f0b429' : '#ef4444'
}
function colorNaixement(v: number | null) {
  if (v === null) return 'var(--text-dim)'
  return v >= 75 ? '#22c55e' : v >= 65 ? '#f0b429' : '#ef4444'
}

// ─── Gràfic SVG ─────────────────────────────────────────────────────────────
interface PuntGrafic {
  setmana: number
  fertilitat: number | null
  eclosio: number | null
  naixement: number | null
}

function GraficLinies({ punts }: { punts: PuntGrafic[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: PuntGrafic } | null>(null)

  if (punts.length === 0) return null

  const W = 680, H = 280
  const pL = 46, pR = 16, pT = 16, pB = 36
  const plotW = W - pL - pR
  const plotH = H - pT - pB

  const setmanes = punts.map(p => p.setmana)
  const sMin = Math.min(...setmanes)
  const sMax = Math.max(...setmanes)
  const rang = sMax - sMin || 1

  const xS = (s: number) => pL + ((s - sMin) / rang) * plotW
  const yS = (pct: number) => pT + plotH - (pct / 100) * plotH

  function linia(key: 'fertilitat' | 'eclosio' | 'naixement', color: string) {
    const segments: string[] = []
    let move = true
    for (const p of punts) {
      const v = p[key]
      if (v === null) { move = true; continue }
      segments.push(`${move ? 'M' : 'L'} ${xS(p.setmana).toFixed(1)} ${yS(v).toFixed(1)}`)
      move = false
    }
    return <path key={key} d={segments.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
  }

  function cercles(key: 'fertilitat' | 'eclosio' | 'naixement', color: string) {
    return punts.map(p => {
      const v = p[key]
      if (v === null) return null
      return (
        <circle
          key={`${key}-${p.setmana}`}
          cx={xS(p.setmana)} cy={yS(v)} r={4}
          fill={color} stroke="#1a1d27" strokeWidth="1.5"
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => {
            const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
            setTooltip({ x: xS(p.setmana), y: yS(v), data: p })
          }}
          onMouseLeave={() => setTooltip(null)}
        />
      )
    })
  }

  const gridPcts = [0, 20, 40, 60, 80, 100]
  // Mostrar etiquetes de setmana cada N setmanes per no saturar
  const step = punts.length <= 10 ? 1 : punts.length <= 20 ? 2 : 4
  const setmanesLabel = setmanes.filter((_, i) => i % step === 0)

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* Grid */}
        {gridPcts.map(pct => (
          <g key={pct}>
            <line x1={pL} y1={yS(pct)} x2={pL + plotW} y2={yS(pct)} stroke="#2a2d3a" strokeWidth={pct === 0 ? 1 : 0.5} />
            <text x={pL - 6} y={yS(pct) + 4} textAnchor="end" fontSize="10" fill="#666">{pct}%</text>
          </g>
        ))}

        {/* Eix X */}
        {setmanesLabel.map(s => (
          <text key={s} x={xS(s)} y={H - pB + 16} textAnchor="middle" fontSize="10" fill="#666">S{s}</text>
        ))}
        <line x1={pL} y1={pT + plotH} x2={pL + plotW} y2={pT + plotH} stroke="#2a2d3a" strokeWidth="1" />

        {/* Línies */}
        {linia('fertilitat', '#22c55e')}
        {linia('eclosio', '#3b82f6')}
        {linia('naixement', '#f0b429')}

        {/* Cercles */}
        {cercles('fertilitat', '#22c55e')}
        {cercles('eclosio', '#3b82f6')}
        {cercles('naixement', '#f0b429')}

        {/* Tooltip */}
        {tooltip && (() => {
          const tx = tooltip.x
          const ty = Math.min(tooltip.y, pT + plotH - 70)
          const flip = tx > W * 0.7
          return (
            <g>
              <rect
                x={flip ? tx - 118 : tx + 8} y={ty - 10}
                width="110" height="68" rx="6"
                fill="#1a1d27" stroke="#2a2d3a" strokeWidth="1"
              />
              <text x={flip ? tx - 63 : tx + 63} y={ty + 6} textAnchor="middle" fontSize="10" fill="#aaa">S{tooltip.data.setmana}</text>
              <text x={flip ? tx - 112 : tx + 14} y={ty + 22} fontSize="10" fill="#22c55e">Fert: {tooltip.data.fertilitat?.toFixed(1) ?? '—'}%</text>
              <text x={flip ? tx - 112 : tx + 14} y={ty + 37} fontSize="10" fill="#3b82f6">Eclo: {tooltip.data.eclosio?.toFixed(1) ?? '—'}%</text>
              <text x={flip ? tx - 112 : tx + 14} y={ty + 52} fontSize="10" fill="#f0b429">Naix: {tooltip.data.naixement?.toFixed(1) ?? '—'}%</text>
            </g>
          )
        })()}
      </svg>

      {/* Llegenda */}
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
        {[
          { color: '#22c55e', label: 'Fertilitat' },
          { color: '#3b82f6', label: 'Eclosió' },
          { color: '#f0b429', label: 'Naixement' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontFamily: 'IBM Plex Mono', color: '#aaa' }}>
            <div style={{ width: 20, height: 2.5, background: color, borderRadius: 2 }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pàgina principal ────────────────────────────────────────────────────────
export default function LotHistoric() {
  const params = useParams()
  const [data, setData] = useState<LotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/lots/${params.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
        setLoading(false)
      })
      .catch(() => { setError('Error de connexió'); setLoading(false) })
  }, [params.id])

  if (loading) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '3rem' }}>Carregant...</p>
    </main>
  )

  if (error || !data) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: '#ef4444', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '3rem' }}>{error ?? 'Lot no trobat'}</p>
    </main>
  )

  const { lot, resultats } = data
  const nomGranja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
  const nomLot = `${nomGranja}${lot.estirp ? ` ${lot.estirp}` : ''}`

  // Estadístiques globals
  const ambDades = resultats.filter(r => r.fertilitat !== null)
  const avgFert = ambDades.length ? ambDades.reduce((s, r) => s + (r.fertilitat ?? 0), 0) / ambDades.length : null
  const avgEclo = ambDades.filter(r => r.eclosio !== null).length
    ? ambDades.filter(r => r.eclosio !== null).reduce((s, r) => s + (r.eclosio ?? 0), 0) / ambDades.filter(r => r.eclosio !== null).length
    : null
  const avgNaix = ambDades.filter(r => r.naixement !== null).length
    ? ambDades.filter(r => r.naixement !== null).reduce((s, r) => s + (r.naixement ?? 0), 0) / ambDades.filter(r => r.naixement !== null).length
    : null

  const totalOus = resultats.reduce((s, r) => s + r.quantitat_ous, 0)
  const totalPollets = resultats.reduce((s, r) => s + (r.pollets_nascuts ?? 0), 0)

  // Punts del gràfic (agrupats per setmana, mitjana si hi ha més d'un carro)
  const perSetmana = new Map<number, { ferts: number[]; eclos: number[]; naix: number[] }>()
  for (const r of resultats) {
    if (!perSetmana.has(r.setmana_vida)) perSetmana.set(r.setmana_vida, { ferts: [], eclos: [], naix: [] })
    const grup = perSetmana.get(r.setmana_vida)!
    if (r.fertilitat !== null) grup.ferts.push(r.fertilitat)
    if (r.eclosio !== null) grup.eclos.push(r.eclosio)
    if (r.naixement !== null) grup.naix.push(r.naixement)
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null

  const puntsGrafic: PuntGrafic[] = Array.from(perSetmana.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([setmana, g]) => ({
      setmana,
      fertilitat: avg(g.ferts),
      eclosio: avg(g.eclos),
      naixement: avg(g.naix),
    }))

  const cardStyle = (color: string): React.CSSProperties => ({
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: '12px', padding: '1rem 1.25rem', textAlign: 'center',
  })

  return (
    <>
    <style>{`
      @media print {
        .no-print { display: none !important; }
        body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        main { padding: 0 !important; background: white !important; }
        .print-container { max-width: 100% !important; }
        .print-card { background: white !important; border: 1px solid #ddd !important; }
        .print-table-wrap { overflow: visible !important; }
        table { font-size: 0.72rem !important; }
        th, td { padding: 0.4rem 0.6rem !important; }
        h1 { font-size: 1.1rem !important; }
        svg text { fill: #333 !important; }
        line[stroke="#2a2d3a"] { stroke: #ddd !important; }
      }
    `}</style>
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1rem' }}>
      <div className="print-container" style={{ maxWidth: 780, margin: '0 auto' }}>

        {/* Capçalera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link className="no-print" href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Inici</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
                Historial del lot
              </p>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>{nomLot}</h1>
              <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', margin: '0.2rem 0 0' }}>
                Nascut: {lot.data_naixement} · {resultats.length} registre{resultats.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            className="no-print"
            onClick={() => window.print()}
            style={{
              padding: '0.6rem 1.1rem', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem',
              cursor: 'pointer', fontFamily: 'IBM Plex Sans',
            }}
          >
            🖨 Imprimir / PDF
          </button>
        </div>

        {/* Targetes resum */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={cardStyle('#22c55e')}>
            <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Total ous</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'IBM Plex Mono' }}>{totalOus.toLocaleString()}</div>
          </div>
          <div style={cardStyle('#22c55e')}>
            <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Total pollets</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'IBM Plex Mono' }}>{totalPollets.toLocaleString()}</div>
          </div>
          <div style={cardStyle('#22c55e')}>
            <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Fert. mitjana</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: colorFertilitat(avgFert) }}>
              {avgFert !== null ? `${avgFert.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div style={cardStyle('#3b82f6')}>
            <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Eclo. mitjana</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: colorEclosio(avgEclo) }}>
              {avgEclo !== null ? `${avgEclo.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div style={cardStyle('#f0b429')}>
            <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Naix. mitjana</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: colorNaixement(avgNaix) }}>
              {avgNaix !== null ? `${avgNaix.toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Gràfic */}
        {puntsGrafic.length > 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
              Evolució per setmana de vida
            </div>
            <GraficLinies punts={puntsGrafic} />
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2rem', marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem' }}>
            Sense dades de naixement registrades encara
          </div>
        )}

        {/* Taula de resultats */}
        {resultats.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Detall per càrrega
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Posta', 'Setm.', 'Càrrega', 'Ous', 'Fèrtils', 'Pollets', 'Fertilitat', 'Eclosió', 'Naixement'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: 'var(--text-dim)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultats.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: 'var(--text-dim)' }}>{r.posta}</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>S{r.setmana_vida}</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: 'var(--text-dim)' }}>
                        {r.num_carrega ? `#${r.num_carrega}` : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>{r.quantitat_ous.toLocaleString()}</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: r.ous_fertils !== null ? 'var(--text)' : 'var(--text-dim)' }}>
                        {r.ous_fertils?.toLocaleString() ?? '—'}
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: r.pollets_nascuts !== null ? 'var(--text)' : 'var(--text-dim)' }}>
                        {r.pollets_nascuts?.toLocaleString() ?? '—'}
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: colorFertilitat(r.fertilitat) }}>
                        {r.fertilitat !== null ? `${r.fertilitat.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: colorEclosio(r.eclosio) }}>
                        {r.eclosio !== null ? `${r.eclosio.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: colorNaixement(r.naixement) }}>
                        {r.naixement !== null ? `${r.naixement.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </main>
    </>
  )
}
