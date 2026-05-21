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

interface PrevLot {
  lot_id: number; nom: string
  setmanes_vida: number; tipus_incubadora: string; eclosio_esperada: number; eclosio_font: string
  etapa1: { carros: number; ous: number; pollets_previstos: number; pct_eclosio: number }
  etapa2: { carros_transferits: number; ous_fertils: number; ous_explosius: number; pollets_previstos: number; pct_fertilitat: number | null; pct_eclosio: number }
  etapa3: { carros_completats: number; pollets_nascuts: number; pollets_descartats: number; pct_eclosio_real: number | null; pct_taxa_naix: number | null; delta_vs_inicial: number | null; delta_vs_transf: number | null }
}
interface PrevisionsData {
  resum: { ous: number; pollets_previstos_inicial: number; ous_fertils: number; ous_explosius: number; pollets_previstos_transf: number; pollets_nascuts: number; pct_fertilitat: number | null; pct_eclosio_prevista: number | null; pct_eclosio_real: number | null; delta_final: number | null }
  per_lot: PrevLot[]
}

export default function Estadistiques() {
  const params = useParams()
  const [full, setFull] = useState<FullInfo | null>(null)
  const [stats, setStats] = useState<EstadistiquesData | null>(null)
  const [previsions, setPrevisions] = useState<PrevisionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generantPDF, setGenerantPDF] = useState(false)

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [resFull, resStats, resPrev] = await Promise.all([
      fetch(`/api/carrega/${params.id}`),
      fetch(`/api/carrega/${params.id}/estadistiques`),
      fetch(`/api/carrega/${params.id}/previsions-comparativa`),
    ])
    const [dataFull, dataStats, dataPrev] = await Promise.all([resFull.json(), resStats.json(), resPrev.json()])
    setFull(dataFull)
    setStats(dataStats)
    setPrevisions(dataPrev.error ? null : dataPrev)
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

        {/* ═══ EVOLUCIÓ DE LA PREVISIÓ ═══════════════════════════════════════ */}
        {previsions && (
          <>
            <div style={{ height: '2rem' }} />
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              Evolució de la previsió
            </div>

            {/* Cards resum pipeline */}
            {(() => {
              const rv = previsions.resum
              const fmtN = (n: number) => n > 0 ? n.toLocaleString('ca') : '—'
              const fmtDelta = (d: number | null) => {
                if (d === null) return null
                const color = d >= 0 ? 'var(--success)' : 'var(--danger)'
                return <span style={{ color, fontSize: '0.7rem', fontFamily: 'IBM Plex Mono' }}>{d >= 0 ? '+' : ''}{d}%</span>
              }
              return (
                <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                  {/* Etapa 1 */}
                  <div style={{ flex: 1, padding: '1rem', borderRight: '1px solid var(--border)', background: 'rgba(100,120,255,0.06)' }}>
                    <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: '#8899ff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>1 · Assignació</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{fmtN(rv.ous)} ous</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', marginTop: '0.2rem' }}>~{fmtN(rv.pollets_previstos_inicial)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>pollets previstos</div>
                  </div>
                  {/* Fletxa */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', color: 'var(--text-dim)', fontSize: '1rem' }}>→</div>
                  {/* Etapa 2 */}
                  <div style={{ flex: 1, padding: '1rem', borderRight: '1px solid var(--border)', background: 'rgba(240,180,41,0.06)' }}>
                    <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>2 · Transferència</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{fmtN(rv.ous_fertils)} fèrtils ({fmt(rv.pct_fertilitat)})</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', marginTop: '0.2rem' }}>~{fmtN(rv.pollets_previstos_transf)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>pollets previstos ({fmt(rv.pct_eclosio_prevista)} ecl.)</div>
                  </div>
                  {/* Fletxa */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', color: 'var(--text-dim)', fontSize: '1rem' }}>→</div>
                  {/* Etapa 3 */}
                  <div style={{ flex: 1, padding: '1rem', background: 'rgba(62,207,142,0.06)' }}>
                    <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>3 · Naixement</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>ecl. real: {fmt(rv.pct_eclosio_real)}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--success)', marginTop: '0.2rem' }}>
                      {rv.pollets_nascuts > 0 ? rv.pollets_nascuts.toLocaleString('ca') : '—'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                      pollets nascuts {rv.delta_final !== null && fmtDelta(rv.delta_final)}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Taula per lot */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  {/* Capçaleres de grup */}
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left', width: 160, background: 'transparent' }} rowSpan={2}>Lot</th>
                    <th colSpan={2} style={{ ...thStyle, background: 'rgba(100,120,255,0.1)', color: '#8899ff', borderBottom: '1px solid var(--border)' }}>1 · Assignació</th>
                    <th colSpan={3} style={{ ...thStyle, background: 'rgba(240,180,41,0.1)', color: 'var(--accent)', borderBottom: '1px solid var(--border)' }}>2 · Transferència</th>
                    <th colSpan={3} style={{ ...thStyle, background: 'rgba(62,207,142,0.1)', color: 'var(--success)', borderBottom: '1px solid var(--border)' }}>3 · Naixement</th>
                  </tr>
                  <tr>
                    <th style={{ ...thStyle, background: 'rgba(100,120,255,0.05)' }}>Ous</th>
                    <th style={{ ...thStyle, background: 'rgba(100,120,255,0.05)' }}>~Pollets</th>
                    <th style={{ ...thStyle, background: 'rgba(240,180,41,0.05)' }}>Fèrtils</th>
                    <th style={{ ...thStyle, background: 'rgba(240,180,41,0.05)' }}>Expl.</th>
                    <th style={{ ...thStyle, background: 'rgba(240,180,41,0.05)' }}>~Pollets</th>
                    <th style={{ ...thStyle, background: 'rgba(62,207,142,0.05)' }}>Pollets</th>
                    <th style={{ ...thStyle, background: 'rgba(62,207,142,0.05)' }}>% Ecl.</th>
                    <th style={{ ...thStyle, background: 'rgba(62,207,142,0.05)' }}>Δ inicial</th>
                  </tr>
                </thead>
                <tbody>
                  {previsions.per_lot.map((l, i) => (
                    <tr key={l.lot_id} style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600 }}>
                        <div>{l.nom}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                          {l.setmanes_vida}s · {l.tipus_incubadora.slice(0,2)} · ecl. {l.eclosio_esperada}%
                        </div>
                      </td>
                      {/* Etapa 1 */}
                      <td style={{ ...tdStyle, background: 'rgba(100,120,255,0.03)' }}>{l.etapa1.ous.toLocaleString('ca')}</td>
                      <td style={{ ...tdStyle, background: 'rgba(100,120,255,0.03)', color: '#8899ff' }}>~{l.etapa1.pollets_previstos.toLocaleString('ca')}</td>
                      {/* Etapa 2 */}
                      <td style={{ ...tdStyle, background: 'rgba(240,180,41,0.03)' }}>
                        {l.etapa2.carros_transferits < l.etapa1.carros
                          ? <span>{l.etapa2.ous_fertils.toLocaleString('ca')} <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>({l.etapa2.carros_transferits}/{l.etapa1.carros})</span></span>
                          : l.etapa2.ous_fertils > 0 ? l.etapa2.ous_fertils.toLocaleString('ca') : <span style={{ color: 'var(--text-dim)' }}>—</span>
                        }
                      </td>
                      <td style={{ ...tdStyle, background: 'rgba(240,180,41,0.03)', color: l.etapa2.ous_explosius > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                        {l.etapa2.ous_explosius > 0 ? l.etapa2.ous_explosius : '—'}
                      </td>
                      <td style={{ ...tdStyle, background: 'rgba(240,180,41,0.03)', color: 'var(--accent)' }}>
                        {l.etapa2.ous_fertils > 0 ? `~${l.etapa2.pollets_previstos.toLocaleString('ca')}` : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </td>
                      {/* Etapa 3 */}
                      <td style={{ ...tdStyle, background: 'rgba(62,207,142,0.03)', color: l.etapa3.pollets_nascuts > 0 ? 'var(--success)' : 'var(--text-dim)' }}>
                        {l.etapa3.pollets_nascuts > 0
                          ? l.etapa3.carros_completats < l.etapa2.carros_transferits
                            ? <span>{l.etapa3.pollets_nascuts.toLocaleString('ca')} <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>({l.etapa3.carros_completats}/{l.etapa2.carros_transferits})</span></span>
                            : l.etapa3.pollets_nascuts.toLocaleString('ca')
                          : '—'}
                      </td>
                      <td style={{ ...tdStyle, background: 'rgba(62,207,142,0.03)', color: semafar(l.etapa3.pct_eclosio_real, 'e') }}>
                        {fmt(l.etapa3.pct_eclosio_real)}
                      </td>
                      <td style={{ ...tdStyle, background: 'rgba(62,207,142,0.03)' }}>
                        {l.etapa3.delta_vs_inicial !== null
                          ? <span style={{ color: l.etapa3.delta_vs_inicial >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              {l.etapa3.delta_vs_inicial >= 0 ? '+' : ''}{l.etapa3.delta_vs_inicial}%
                            </span>
                          : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </td>
                    </tr>
                  ))}

                  {/* Fila total */}
                  {(() => {
                    const rv = previsions.resum
                    return (
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                        <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--accent)' }}>TOTAL</td>
                        <td style={{ ...tdStyle, background: 'rgba(100,120,255,0.03)' }}>{rv.ous.toLocaleString('ca')}</td>
                        <td style={{ ...tdStyle, background: 'rgba(100,120,255,0.03)', color: '#8899ff' }}>~{rv.pollets_previstos_inicial.toLocaleString('ca')}</td>
                        <td style={{ ...tdStyle, background: 'rgba(240,180,41,0.03)' }}>{rv.ous_fertils > 0 ? rv.ous_fertils.toLocaleString('ca') : '—'}</td>
                        <td style={{ ...tdStyle, background: 'rgba(240,180,41,0.03)', color: rv.ous_explosius > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>{rv.ous_explosius > 0 ? rv.ous_explosius : '—'}</td>
                        <td style={{ ...tdStyle, background: 'rgba(240,180,41,0.03)', color: 'var(--accent)' }}>{rv.pollets_previstos_transf > 0 ? `~${rv.pollets_previstos_transf.toLocaleString('ca')}` : '—'}</td>
                        <td style={{ ...tdStyle, background: 'rgba(62,207,142,0.03)', color: 'var(--success)' }}>{rv.pollets_nascuts > 0 ? rv.pollets_nascuts.toLocaleString('ca') : '—'}</td>
                        <td style={{ ...tdStyle, background: 'rgba(62,207,142,0.03)', color: semafar(rv.pct_eclosio_real, 'e') }}>{fmt(rv.pct_eclosio_real)}</td>
                        <td style={{ ...tdStyle, background: 'rgba(62,207,142,0.03)' }}>
                          {rv.delta_final !== null
                            ? <span style={{ color: rv.delta_final >= 0 ? 'var(--success)' : 'var(--danger)' }}>{rv.delta_final >= 0 ? '+' : ''}{rv.delta_final}%</span>
                            : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </main>
  )
}