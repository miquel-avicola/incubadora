'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatData, calcularNaixement } from '@/lib/dates'
import type { EstadistiquesData } from '@/app/components/EstadistiquesPDF'

function fmt(v: number | null) { return v === null ? '—' : `${v}%` }
function semafar(v: number | null, tipus: 'f' | 'e' | 'p') {
  if (v === null) return 'var(--text-dim)'
  if (tipus === 'p') return v < 5 ? 'var(--success)' : v < 12 ? '#f59e0b' : 'var(--danger)'
  return v >= 82 ? 'var(--success)' : v >= 72 ? '#f59e0b' : 'var(--danger)'
}

interface FullInfo { id: number; num_carrega: number; carrega: string }

export default function Estadistiques() {
  const params = useParams()
  const [full, setFull] = useState<FullInfo | null>(null)
  const [stats, setStats] = useState<EstadistiquesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generantPDF, setGenerantPDF] = useState(false)

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [resFull, resStats] = await Promise.all([
      fetch(`/api/carrega/${params.id}`),
      fetch(`/api/carrega/${params.id}/estadistiques`),
    ])
    const [dataFull, dataStats] = await Promise.all([resFull.json(), resStats.json()])
    setFull(dataFull)
    setStats(dataStats)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  async function descarregarPDF() {
    if (!stats || !full) return
    setGenerantPDF(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { EstadistiquesPDF } = await import('@/app/components/EstadistiquesPDF')
      const naixement = calcularNaixement(full.carrega)
      const blob = await pdf(
        <EstadistiquesPDF
          stats={stats}
          numCarrega={full.num_carrega}
          dataCarrega={formatData(full.carrega)}
          dataNaixement={formatData(naixement)}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estadistiques-carrega-${full.num_carrega}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerantPDF(false)
    }
  }

  if (loading || !stats || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  const r = stats.resum

  const card = (label: string, value: string, color = 'var(--text)') => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )

  const thStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono', textAlign: 'center', borderBottom: '1px solid var(--border)' }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href={`/carrega/${full.id}`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrrega #{full.num_carrega}</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Estadístiques</p>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Càrrega #{full.num_carrega}</h1>
            </div>
          </div>
          <button
            onClick={descarregarPDF}
            disabled={generantPDF}
            style={{ padding: '0.6rem 1.1rem', background: generantPDF ? 'var(--border)' : 'var(--accent)', color: generantPDF ? 'var(--text-dim)' : '#0f1117', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: generantPDF ? 'not-allowed' : 'pointer', fontFamily: 'IBM Plex Sans' }}
          >
            {generantPDF ? 'Generant...' : '⬇ Descarregar PDF'}
          </button>
        </div>

        {/* Indicadors globals */}
        <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Resum global</div>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {card('Fertilitat', fmt(r.fertilitat), semafar(r.fertilitat, 'f'))}
          {card('Taxa eclosió', fmt(r.taxa_eclosio), semafar(r.taxa_eclosio, 'e'))}
          {card('Naixement', fmt(r.naixement), semafar(r.naixement, 'e'))}
          {card('Pèrdua transf.', fmt(r.perdua), semafar(r.perdua, 'p'))}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
          {card('Ous totals', r.total_ous.toLocaleString())}
          {card('Ous fèrtils', r.ous_fertils.toLocaleString())}
          {card('Explosius', r.ous_explosius.toLocaleString(), r.ous_explosius > 0 ? 'var(--danger)' : 'var(--text)')}
          {card('Pollets', r.pollets.toLocaleString(), 'var(--success)')}
        </div>

        {/* Per lot */}
        <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Per lot de reproductores</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Lot', 'Carros', 'Ous', 'Fèrtils', 'Pollets', 'Fertilitat', 'Eclosió', 'Naix.', 'Pèrdua'].map(h => (
                  <th key={h} style={{ ...thStyle, textAlign: h === 'Lot' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.per_lot.map((l, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ ...tdStyle, textAlign: 'left' }}>{l.nom}</td>
                  <td style={tdStyle}>{l.carros}</td>
                  <td style={tdStyle}>{l.ous.toLocaleString()}</td>
                  <td style={tdStyle}>{l.fertils.toLocaleString()}</td>
                  <td style={tdStyle}>{l.pollets.toLocaleString()}</td>
                  <td style={{ ...tdStyle, color: semafar(l.fertilitat, 'f') }}>{fmt(l.fertilitat)}</td>
                  <td style={{ ...tdStyle, color: semafar(l.taxa_eclosio, 'e') }}>{fmt(l.taxa_eclosio)}</td>
                  <td style={{ ...tdStyle, color: semafar(l.naixement, 'e') }}>{fmt(l.naixement)}</td>
                  <td style={{ ...tdStyle, color: semafar(l.perdua, 'p') }}>{fmt(l.perdua)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per incubadora */}
        <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Per incubadora</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Inc.', 'Model', 'Carros', 'Ous', 'Fèrtils', 'Pollets', 'Fertilitat', 'Eclosió', 'Naix.'].map(h => (
                  <th key={h} style={{ ...thStyle, textAlign: h === 'Model' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.per_incubadora.map((inc, i) => (
                <Fragment key={`inc-${inc.numero}`}>
                  <tr style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent', fontWeight: 700 }}>
                    <td style={tdStyle}>{inc.numero}</td>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>{inc.model}</td>
                    <td style={tdStyle}>{inc.carros}</td>
                    <td style={tdStyle}>{inc.ous.toLocaleString()}</td>
                    <td style={tdStyle}>{inc.fertils.toLocaleString()}</td>
                    <td style={tdStyle}>{inc.pollets.toLocaleString()}</td>
                    <td style={{ ...tdStyle, color: semafar(inc.fertilitat, 'f') }}>{fmt(inc.fertilitat)}</td>
                    <td style={{ ...tdStyle, color: semafar(inc.taxa_eclosio, 'e') }}>{fmt(inc.taxa_eclosio)}</td>
                    <td style={{ ...tdStyle, color: semafar(inc.naixement, 'e') }}>{fmt(inc.naixement)}</td>
                  </tr>
                  {inc.lots && inc.lots.map((l) => (
                    <tr key={`inc-${inc.numero}-lot-${l.lot_id}`} style={{ background: 'rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>
                      <td style={{ ...tdStyle, color: 'var(--text-dim)' }}></td>
                      <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: '1.5rem', color: 'var(--text-dim)' }}>└ {l.nom}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{l.carros}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{l.ous.toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{l.fertils.toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{l.pollets.toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: semafar(l.fertilitat, 'f') }}>{fmt(l.fertilitat)}</td>
                      <td style={{ ...tdStyle, color: semafar(l.taxa_eclosio, 'e') }}>{fmt(l.taxa_eclosio)}</td>
                      <td style={{ ...tdStyle, color: semafar(l.naixement, 'e') }}>{fmt(l.naixement)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per naixedora */}
        {stats.per_naixedora.length > 0 && (
          <>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Per naixedora</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['N.', 'Lot', 'Ous', 'Fèrtils', 'Pollets', 'Eclosió', 'Naix.', 'Pèrdua'].map(h => (
                      <th key={h} style={{ ...thStyle, textAlign: h === 'Lot' ? 'left' : 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.per_naixedora.map((n, i) => (
                    <Fragment key={`nax-${n.numero}`}>
                      <tr style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent', fontWeight: 700 }}>
                        <td style={tdStyle}>N{n.numero}</td>
                        <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--text-dim)' }}>—</td>
                        <td style={tdStyle}>{n.ous.toLocaleString()}</td>
                        <td style={tdStyle}>{n.fertils.toLocaleString()}</td>
                        <td style={tdStyle}>{n.pollets.toLocaleString()}</td>
                        <td style={{ ...tdStyle, color: semafar(n.taxa_eclosio, 'e') }}>{fmt(n.taxa_eclosio)}</td>
                        <td style={{ ...tdStyle, color: semafar(n.naixement, 'e') }}>{fmt(n.naixement)}</td>
                        <td style={{ ...tdStyle, color: semafar(n.perdua, 'p') }}>{fmt(n.perdua)}</td>
                      </tr>
                      {n.lots && n.lots.map((l) => (
                        <tr key={`nax-${n.numero}-lot-${l.lot_id}`} style={{ background: 'rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>
                          <td style={tdStyle}></td>
                          <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: '1.5rem', color: 'var(--text-dim)' }}>└ {l.nom}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{l.ous.toLocaleString()}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{l.fertils.toLocaleString()}</td>
                          <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{l.pollets.toLocaleString()}</td>
                          <td style={{ ...tdStyle, color: semafar(l.taxa_eclosio, 'e') }}>{fmt(l.taxa_eclosio)}</td>
                          <td style={{ ...tdStyle, color: semafar(l.naixement, 'e') }}>{fmt(l.naixement)}</td>
                          <td style={{ ...tdStyle, color: semafar(l.perdua, 'p') }}>{fmt(l.perdua)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </main>
  )
}