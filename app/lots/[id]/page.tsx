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
  tipus_incubadora: string | null
}

interface LotData {
  lot: {
    id: number
    data_naixement: string
    estirp: string | null
    actiu: boolean
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
  data_naix: string
  setmana: number
  fertilitat_ss: number | null
  fertilitat_ms: number | null
  eclosio_ss: number | null
  eclosio_ms: number | null
  naixement_ss: number | null
  naixement_ms: number | null
}

function GraficLinies({ punts }: { punts: PuntGrafic[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: PuntGrafic } | null>(null)

  if (punts.length === 0) return null

  const W = 680, H = 280
  const pL = 46, pR = 16, pT = 16, pB = 36
  const plotW = W - pL - pR
  const plotH = H - pT - pB

  const datesMs = punts.map(p => new Date(p.data_naix).getTime())
  const tMin = Math.min(...datesMs)
  const tMax = Math.max(...datesMs)
  const rangT = tMax - tMin || 1

  const xS = (t: number) => pL + ((t - tMin) / rangT) * plotW
  const yS = (pct: number) => pT + plotH - (pct / 100) * plotH

  function linia(key: keyof PuntGrafic, color: string, dasharray?: string) {
    const segments: string[] = []
    let move = true
    for (const p of punts) {
      const v = p[key] as number | null
      if (v === null) { move = true; continue }
      const tx = new Date(p.data_naix).getTime()
      segments.push(`${move ? 'M' : 'L'} ${xS(tx).toFixed(1)} ${yS(v).toFixed(1)}`)
      move = false
    }
    return <path key={key} d={segments.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeDasharray={dasharray} strokeLinejoin="round" />
  }

  function cercles(key: keyof PuntGrafic, color: string, fillInner?: string) {
    return punts.map(p => {
      const v = p[key] as number | null
      if (v === null) return null
      const tx = new Date(p.data_naix).getTime()
      return (
        <circle
          key={`${key}-${tx}`}
          cx={xS(tx)} cy={yS(v)} r={4}
          fill={fillInner || color} stroke={color} strokeWidth="1.5"
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) => setTooltip({ x: xS(tx), y: yS(v), data: p })}
          onMouseLeave={() => setTooltip(null)}
        />
      )
    })
  }

  const gridPcts = [0, 20, 40, 60, 80, 100]

  // Generar etiquetes de setmana (només el primer punt de cada setmana)
  const labels: { text: string; x: number; s: number }[] = []
  const weeksSeen = new Set<number>()
  for (const p of punts) {
    if (!weeksSeen.has(p.setmana)) {
      weeksSeen.add(p.setmana)
      labels.push({ text: `S${p.setmana}`, x: xS(new Date(p.data_naix).getTime()), s: p.setmana })
    }
  }

  // Filtrar etiquetes per no saturar (passem cada N si hi ha moltes setmanes)
  const nWeeks = labels.length
  const step = nWeeks <= 10 ? 1 : nWeeks <= 20 ? 2 : 4
  const labelsLabel = labels.filter((_, i) => i % step === 0)

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`
  }

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
        {labelsLabel.map(lbl => (
          <text key={lbl.s} x={lbl.x} y={H - pB + 16} textAnchor="middle" fontSize="10" fill="#666">{lbl.text}</text>
        ))}
        <line x1={pL} y1={pT + plotH} x2={pL + plotW} y2={pT + plotH} stroke="#2a2d3a" strokeWidth="1" />

        {/* Línies MS (solides) */}
        {linia('fertilitat_ms', '#22c55e')}
        {linia('eclosio_ms', '#3b82f6')}
        {linia('naixement_ms', '#f0b429')}

        {/* Línies SS (discontinues) */}
        {linia('fertilitat_ss', '#22c55e', '4 4')}
        {linia('eclosio_ss', '#3b82f6', '4 4')}
        {linia('naixement_ss', '#f0b429', '4 4')}

        {/* Cercles MS (farcits) */}
        {cercles('fertilitat_ms', '#22c55e')}
        {cercles('eclosio_ms', '#3b82f6')}
        {cercles('naixement_ms', '#f0b429')}

        {/* Cercles SS (buits) */}
        {cercles('fertilitat_ss', '#22c55e', '#1a1d27')}
        {cercles('eclosio_ss', '#3b82f6', '#1a1d27')}
        {cercles('naixement_ss', '#f0b429', '#1a1d27')}

        {/* Tooltip */}
        {tooltip && (() => {
          const tx = tooltip.x
          const ty = Math.min(tooltip.y, pT + plotH - 95)
          const flip = tx > W * 0.7
          const p = tooltip.data
          return (
            <g>
              <rect
                x={flip ? tx - 128 : tx + 8} y={ty - 10}
                width="120" height="98" rx="6"
                fill="#1a1d27" stroke="#2a2d3a" strokeWidth="1"
              />
              <text x={flip ? tx - 68 : tx + 68} y={ty + 6} textAnchor="middle" fontSize="10" fill="#aaa">S{p.setmana} · {fmtDate(p.data_naix)}</text>
              <text x={flip ? tx - 122 : tx + 14} y={ty + 22} fontSize="10" fill="#22c55e">Fert MS: {p.fertilitat_ms?.toFixed(1) ?? '—'}%</text>
              <text x={flip ? tx - 122 : tx + 14} y={ty + 35} fontSize="10" fill="#3b82f6">Eclo MS: {p.eclosio_ms?.toFixed(1) ?? '—'}%</text>
              <text x={flip ? tx - 122 : tx + 14} y={ty + 48} fontSize="10" fill="#f0b429">Naix MS: {p.naixement_ms?.toFixed(1) ?? '—'}%</text>
              <text x={flip ? tx - 122 : tx + 14} y={ty + 63} fontSize="10" fill="#22c55e">Fert SS: {p.fertilitat_ss?.toFixed(1) ?? '—'}%</text>
              <text x={flip ? tx - 122 : tx + 14} y={ty + 76} fontSize="10" fill="#3b82f6">Eclo SS: {p.eclosio_ss?.toFixed(1) ?? '—'}%</text>
              <text x={flip ? tx - 122 : tx + 14} y={ty + 89} fontSize="10" fill="#f0b429">Naix SS: {p.naixement_ss?.toFixed(1) ?? '—'}%</text>
            </g>
          )
        })()}
      </svg>

      {/* Llegenda */}
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontFamily: 'IBM Plex Mono', color: '#aaa' }}>
          <div style={{ width: 15, height: 2.5, background: '#888', borderRadius: 2 }} /> MS (Línia sòlida)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontFamily: 'IBM Plex Mono', color: '#aaa' }}>
          <div style={{ width: 15, height: 2.5, background: 'repeating-linear-gradient(90deg, #888, #888 3px, transparent 3px, transparent 6px)', borderRadius: 2 }} /> SS (Línia discontínua)
        </div>
        {[
          { color: '#22c55e', label: 'Fertilitat' },
          { color: '#3b82f6', label: 'Eclosió' },
          { color: '#f0b429', label: 'Naixement' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontFamily: 'IBM Plex Mono', color: '#aaa', marginLeft: '0.5rem' }}>
            <div style={{ width: 12, height: 12, background: color, borderRadius: 2 }} />
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

  async function toggleLotActiu() {
    if (!confirm(lot.actiu ? "Segur que vols tancar aquest lot? Ja no apareixerà a les llistes per defecte." : "Vols reobrir aquest lot?")) return
    const res = await fetch(`/api/lots/${lot.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actiu: !lot.actiu })
    })
    if (res.ok) {
      setData({ ...data!, lot: { ...lot, actiu: !lot.actiu } })
    } else {
      alert("Error en actualitzar l'estat")
    }
  }

  // Estadístiques globals
  const resultatsNets = resultats.filter(r => r.setmana_vida > 0)
  const ambDades = resultatsNets.filter(r => r.fertilitat !== null)
  const avgFert = ambDades.length ? ambDades.reduce((s, r) => s + (r.fertilitat ?? 0), 0) / ambDades.length : null
  const avgEclo = ambDades.filter(r => r.eclosio !== null).length
    ? ambDades.filter(r => r.eclosio !== null).reduce((s, r) => s + (r.eclosio ?? 0), 0) / ambDades.filter(r => r.eclosio !== null).length
    : null
  const avgNaix = ambDades.filter(r => r.naixement !== null).length
    ? ambDades.filter(r => r.naixement !== null).reduce((s, r) => s + (r.naixement ?? 0), 0) / ambDades.filter(r => r.naixement !== null).length
    : null

  const totalOus = resultatsNets.reduce((s, r) => s + r.quantitat_ous, 0)
  const totalPollets = resultatsNets.reduce((s, r) => s + (r.pollets_nascuts ?? 0), 0)

  // Punts del gràfic (agrupats per data_naixement_pollets)
  const perData = new Map<string, { setmana: number, ferts_ss: number[], eclos_ss: number[], naix_ss: number[], ferts_ms: number[], eclos_ms: number[], naix_ms: number[] }>()
  
  for (const r of resultatsNets) {
    if (!r.data_naixement_pollets) continue
    const dateStr = r.data_naixement_pollets
    if (!perData.has(dateStr)) {
      perData.set(dateStr, { setmana: r.setmana_vida, ferts_ss: [], eclos_ss: [], naix_ss: [], ferts_ms: [], eclos_ms: [], naix_ms: [] })
    }
    const grup = perData.get(dateStr)!
    const isSS = r.tipus_incubadora === 'Singlestage'
    if (r.fertilitat !== null) { isSS ? grup.ferts_ss.push(r.fertilitat) : grup.ferts_ms.push(r.fertilitat) }
    if (r.eclosio !== null) { isSS ? grup.eclos_ss.push(r.eclosio) : grup.eclos_ms.push(r.eclosio) }
    if (r.naixement !== null) { isSS ? grup.naix_ss.push(r.naixement) : grup.naix_ms.push(r.naixement) }
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null

  const puntsGrafic: PuntGrafic[] = Array.from(perData.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([data_naix, g]) => ({
      data_naix,
      setmana: g.setmana,
      fertilitat_ss: avg(g.ferts_ss),
      fertilitat_ms: avg(g.ferts_ms),
      eclosio_ss: avg(g.eclos_ss),
      eclosio_ms: avg(g.eclos_ms),
      naixement_ss: avg(g.naix_ss),
      naixement_ms: avg(g.naix_ms),
    }))

  const maxSetm = puntsGrafic.length > 0 ? puntsGrafic[puntsGrafic.length - 1].setmana : 0
  const puntsGraficFiltrats = puntsGrafic.filter(p => p.setmana >= Math.max(0, maxSetm - 40))

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
      <div className="print-container" style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Capçalera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link className="no-print" href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Inici</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
                Historial del lot
              </p>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
                {nomLot}
                {lot.actiu === false && <span style={{ color: '#ef4444', fontSize: '1rem', marginLeft: '0.8rem', verticalAlign: 'middle' }}>[TANCAT]</span>}
              </h1>
              <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', margin: '0.2rem 0 0' }}>
                Nascut: {lot.data_naixement} · {resultats.length} registre{resultats.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={toggleLotActiu}
              style={{
                padding: '0.6rem 1.1rem', background: lot.actiu ? 'var(--surface)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${lot.actiu ? 'var(--border)' : '#ef4444'}`, borderRadius: '8px',
                color: lot.actiu ? 'var(--text)' : '#ef4444', fontWeight: 600, fontSize: '0.85rem',
                cursor: 'pointer', fontFamily: 'IBM Plex Sans',
              }}
            >
              {lot.actiu ? 'Tancar lot' : 'Reobrir lot'}
            </button>
            <button
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
              Evolució (Últimes 40 setmanes)
            </div>
            <GraficLinies punts={puntsGraficFiltrats} />
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
                  {resultatsNets.map((r, i) => (
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
