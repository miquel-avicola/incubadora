'use client'

import { useMemo, useState } from 'react'

interface EstadMes {
  mes: string
  ous_entrats: number
  pollets_nascuts: number
  servits: number
  servits_cat: number
  servits_fora: number
}

const fmt = (n: number) => (n ?? 0).toLocaleString('ca-ES')

export function EstadistiquesClient({ initialData }: { initialData: EstadMes[] }) {
  const [mesSeleccionat, setMesSeleccionat] = useState<string>('')

  const dades = useMemo(
    () => [...(initialData ?? [])].sort((a, b) => b.mes.localeCompare(a.mes)),
    [initialData]
  )

  const mesosOrdenats = dades.map(d => d.mes)
  const selectedMesStr = mesSeleccionat || mesosOrdenats[0] || ''
  const fila = dades.find(d => d.mes === selectedMesStr)

  const ousEntrats = fila?.ous_entrats ?? 0
  const polletsNascuts = fila?.pollets_nascuts ?? 0
  const servits = fila?.servits ?? 0
  const servitsCat = fila?.servits_cat ?? 0
  const servitsFora = fila?.servits_fora ?? 0

  const totalDest = servitsCat + servitsFora
  const pctCat = totalDest > 0 ? servitsCat / totalDest : 0
  const pctFora = totalDest > 0 ? servitsFora / totalDest : 0
  const formatPct = (v: number) => (v * 100).toFixed(1) + '%'

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }
  const labelStyle = { fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
  const subStyle = { fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.4rem', lineHeight: 1.3 }
  const bigVal = { fontSize: '2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono' }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Estadístiques</h1>
            <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Ous entrats, naixements i distribució per mes</p>
          </div>
          <select
            value={selectedMesStr}
            onChange={e => setMesSeleccionat(e.target.value)}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'IBM Plex Sans', outline: 'none' }}
          >
            {mesosOrdenats.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {mesosOrdenats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>No hi ha dades suficients.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>

            <div style={cardStyle}>
              <div style={labelStyle}>Ous entrats a incubadora</div>
              <div style={{ ...bigVal, color: 'var(--text)' }}>{fmt(ousEntrats)}</div>
              <div style={subStyle}>Ous que han entrat a incubar durant aquest mes. Naixeran d&apos;aquí ~3 setmanes.</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Pollets nascuts</div>
              <div style={{ ...bigVal, color: 'var(--success)' }}>{fmt(polletsNascuts)}</div>
              <div style={subStyle}>Pollets nascuts durant aquest mes, d&apos;ous que van entrar fa ~3 setmanes.</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Pollets servits</div>
              <div style={{ ...bigVal, color: 'var(--accent)' }}>{fmt(servits)}</div>
              <div style={subStyle}>Pollets expedits a granges durant aquest mes (mateix període que els naixements).</div>
            </div>

            <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
              <div style={{ ...labelStyle, marginBottom: '1rem' }}>Destinació dels pollets servits (Catalunya vs Fora)</div>
              <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ width: formatPct(pctCat), background: 'var(--accent)', transition: 'width 0.3s' }}></div>
                <div style={{ width: formatPct(pctFora), background: 'var(--border)', transition: 'width 0.3s' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Catalunya</span> {formatPct(pctCat)} ({fmt(servitsCat)})
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>Fora</span> {formatPct(pctFora)} ({fmt(servitsFora)})
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  )
}
