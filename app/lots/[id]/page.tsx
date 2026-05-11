'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatData } from '@/lib/dates'

function fmt(v: number | null) { return v === null ? '—' : `${v}%` }
function semafar(v: number | null, tipus: 'f' | 'e' | 'p') {
  if (v === null) return 'var(--text-dim)'
  if (tipus === 'p') return v < 5 ? 'var(--success)' : v < 12 ? '#f59e0b' : 'var(--danger)'
  return v >= 82 ? 'var(--success)' : v >= 72 ? '#f59e0b' : 'var(--danger)'
}

interface Carrega {
  full_carrega_id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  ous: number
  ous_fertils: number
  ous_explosius: number
  pollets: number
  setmana_vida: number | null
  fertilitat: number | null
  taxa_eclosio: number | null
  naixement: number | null
}

interface LotData {
  lot: {
    id: number
    nom: string
    data_naixement: string
    estirp: string | null
    granja: { granja: string; nom_informal: string | null }
  }
  resum: {
    total_ous: number
    total_pollets: number
    fertilitat_mitjana: number | null
    eclosio_mitjana: number | null
    naixement_mitjana: number | null
    num_carregues: number
  }
  carregues: Carrega[]
}

interface Tooltip {
  visible: boolean
  x: number
  y: number
  text: string
}

export default function LotHistoric() {
  const params = useParams()
  const [data, setData] = useState<LotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<Tooltip>({ visible: false, x: 0, y: 0, text: '' })

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    try {
      const res = await fetch(`/api/lots/${params.id}`)
      const lotData = await res.json()
      if (res.ok) {
        setData(lotData)
      }
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  const chartData = useMemo(() => {
    if (!data) return null
    return data.carregues.filter(c => c.fertilitat !== null || c.taxa_eclosio !== null || c.naixement !== null)
  }, [data])

  const handleMouseMove = (e: React.MouseEvent, text: string) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      text,
    })
  }

  const handleMouseLeave = () => {
    setTooltip({ ...tooltip, visible: false })
  }

  if (loading || !data) {
    return (
      <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
        <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
      </main>
    )
  }

  const r = data.resum

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link href="/lots" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Lots</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Históric</p>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{data.lot.nom}</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', margin: '0.25rem 0 0 0' }}>Naixut: {formatData(data.lot.data_naixement)}</p>
          </div>
        </div>

        {/* Targetes resum */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--text)' }}>{r.total_ous.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Ous totals</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--success)' }}>{r.total_pollets.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Pollets totals</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: semafar(r.fertilitat_mitjana, 'f') }}>{fmt(r.fertilitat_mitjana)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Fertilitat mitj.</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: semafar(r.eclosio_mitjana, 'e') }}>{fmt(r.eclosio_mitjana)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Eclosió mitj.</div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: semafar(r.naixement_mitjana, 'e') }}>{fmt(r.naixement_mitjana)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Naixement mitj.</div>
          </div>
        </div>

        {/* Gràfic SVG */}
        {chartData && chartData.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', position: 'relative' }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Evolució de resultats</div>
            
            <svg width="100%" height="300" viewBox="0 0 800 300" style={{ position: 'relative' }}>
              {/* Grid */}
              {[0, 1, 2, 3, 4].map(i => (
                <line key={i} x1="60" y1={300 - (i * 60)} x2="780" y2={300 - (i * 60)} stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
              ))}
              {[0, 1, 2].map(i => (
                <text key={i} x="15" y={300 - (i * 60) + 4} fontSize="10" fill="var(--text-dim)" textAnchor="end">
                  {20 + i * 20}%
                </text>
              ))}

              {/* Lines */}
              {chartData.map((c, i) => {
                const x = 60 + (i / (chartData.length - 1 || 1)) * 720
                const yFert = 300 - ((c.fertilitat || 0) * 2)
                const yEcloc = 300 - ((c.taxa_eclosio || 0) * 2)
                const yNaix = 300 - ((c.naixement || 0) * 2)

                return (
                  <g key={i}>
                    {i > 0 && (
                      <>
                        <line x1={60 + ((i - 1) / (chartData.length - 1)) * 720} y1={300 - ((chartData[i - 1].fertilitat || 0) * 2)} x2={x} y2={yFert} stroke="var(--accent)" strokeWidth="2" />
                        <line x1={60 + ((i - 1) / (chartData.length - 1)) * 720} y1={300 - ((chartData[i - 1].taxa_eclosio || 0) * 2)} x2={x} y2={yEcloc} stroke="#f59e0b" strokeWidth="2" />
                        <line x1={60 + ((i - 1) / (chartData.length - 1)) * 720} y1={300 - ((chartData[i - 1].naixement || 0) * 2)} x2={x} y2={yNaix} stroke="var(--success)" strokeWidth="2" />
                      </>
                    )}

                    {/* Interactive circles */}
                    <circle
                      cx={x}
                      cy={yFert}
                      r="4"
                      fill="var(--accent)"
                      onMouseMove={(e) => handleMouseMove(e, `Fert: ${c.fertilitat}%`)}
                      onMouseLeave={handleMouseLeave}
                      style={{ cursor: 'pointer' }}
                    />
                    <circle
                      cx={x}
                      cy={yEcloc}
                      r="4"
                      fill="#f59e0b"
                      onMouseMove={(e) => handleMouseMove(e, `Ecl: ${c.taxa_eclosio}%`)}
                      onMouseLeave={handleMouseLeave}
                      style={{ cursor: 'pointer' }}
                    />
                    <circle
                      cx={x}
                      cy={yNaix}
                      r="4"
                      fill="var(--success)"
                      onMouseMove={(e) => handleMouseMove(e, `Naix: ${c.naixement}%`)}
                      onMouseLeave={handleMouseLeave}
                      style={{ cursor: 'pointer' }}
                    />
                  </g>
                )
              })}

              {/* Legend */}
              <text x="70" y="20" fontSize="10" fill="var(--accent)" fontWeight="700">● Fertilitat</text>
              <text x="240" y="20" fontSize="10" fill="#f59e0b" fontWeight="700">● Eclosió</text>
              <text x="380" y="20" fontSize="10" fill="var(--success)" fontWeight="700">● Naixement</text>
            </svg>

            {/* Tooltip */}
            {tooltip.visible && (
              <div
                style={{
                  position: 'absolute',
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y - 30}px`,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.75rem',
                  fontFamily: 'IBM Plex Mono',
                  color: 'var(--text)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                }}
              >
                {tooltip.text}
              </div>
            )}
          </div>
        )}

        {/* Taula carregues */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', overflow: 'auto' }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>Históric de carregues</div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.6rem', textAlign: 'left', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Carrega</th>
                <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Data</th>
                <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Setmana</th>
                <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Ous</th>
                <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Fèrtils</th>
                <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Pollets</th>
                <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Fert.</th>
                <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Ecl.</th>
                <th style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.75rem' }}>Naix.</th>
              </tr>
            </thead>
            <tbody>
              {data.carregues.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '0.6rem', textAlign: 'left' }}>
                    <Link href={`/carrega/${c.full_carrega_id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                      #{c.num_carrega}
                    </Link>
                  </td>
                  <td style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)' }}>{formatData(c.carrega)}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-dim)' }}>{c.setmana_vida !== null ? `Setmana ${c.setmana_vida}` : '—'}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'center' }}>{c.ous.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'center' }}>{c.ous_fertils.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--success)' }}>{c.pollets.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'center', color: semafar(c.fertilitat, 'f') }}>{fmt(c.fertilitat)}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'center', color: semafar(c.taxa_eclosio, 'e') }}>{fmt(c.taxa_eclosio)}</td>
                  <td style={{ padding: '0.6rem', textAlign: 'center', color: semafar(c.naixement, 'e') }}>{fmt(c.naixement)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.carregues.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              No hi ha carregues d'aquest lot
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
