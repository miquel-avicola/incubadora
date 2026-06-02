'use client'

import { useEffect, useMemo, useState } from 'react'

interface EstadSetmana {
  setmana: string
  isoyear: number
  isoweek: number
  data_dilluns: string | null
  data_dijous: string | null
  ous_nostres_dl: number; ous_nostres_dj: number; ous_nostres_set: number
  ous_maquila_dl: number; ous_maquila_dj: number; ous_maquila_set: number
  servits_dl: number; servits_dj: number; servits_set: number
  sexats_dl: number; sexats_dj: number; sexats_set: number
}

const fmt = (n: number) => (n ?? 0).toLocaleString('ca-ES')
const fmtData = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' }) : '—'

export function EstadistiquesSetmanalClient({ initialData }: { initialData: EstadSetmana[] }) {
  const [setmanaSel, setSetmanaSel] = useState<string>('')
  const [impresDia, setImpresDia] = useState<string>('')

  // Data d'impressió: es calcula al client per evitar desajustos d'hidratació.
  useEffect(() => { setImpresDia(new Date().toLocaleDateString('ca-ES')) }, [])

  // Les dades ja venen ordenades de l'RPC (any/setmana DESC), però ho assegurem.
  const dades = useMemo(
    () =>
      [...(initialData ?? [])].sort(
        (a, b) => b.isoyear - a.isoyear || b.isoweek - a.isoweek
      ),
    [initialData]
  )

  const selected = setmanaSel || dades[0]?.setmana || ''
  const fila = dades.find(d => d.setmana === selected)

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }
  const labelStyle = { fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

  const th: React.CSSProperties = { textAlign: 'right', padding: '0.6rem 0.9rem', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }
  const thLeft: React.CSSProperties = { ...th, textAlign: 'left' }
  const td: React.CSSProperties = { textAlign: 'right', padding: '0.7rem 0.9rem', fontFamily: 'IBM Plex Mono', fontSize: '0.95rem', borderBottom: '1px solid var(--border)' }
  const tdLeft: React.CSSProperties = { ...td, textAlign: 'left', fontFamily: 'IBM Plex Sans', color: 'var(--text)' }

  const Row = ({ label, dl, dj, set, strong = false, accent }: { label: string; dl: number; dj: number; set: number; strong?: boolean; accent?: string }) => (
    <tr>
      <td style={{ ...tdLeft, fontWeight: strong ? 700 : 400 }}>{label}</td>
      <td style={{ ...td, color: 'var(--text-dim)' }}>{fmt(dl)}</td>
      <td style={{ ...td, color: 'var(--text-dim)' }}>{fmt(dj)}</td>
      <td style={{ ...td, fontWeight: 700, color: accent ?? 'var(--text)' }}>{fmt(set)}</td>
    </tr>
  )

  return (
    <main className="estad-setmanal" style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Estadística setmanal Jordi</h1>
            <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Per setmana de naixement · dilluns + dijous</p>
            <p className="print-only" style={{ fontSize: '0.8rem', margin: '0.35rem 0 0' }}>Miquel Avícola{impresDia ? ` · Imprès ${impresDia}` : ''}</p>
          </div>
          <div className="no-print" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <select
              value={selected}
              onChange={e => setSetmanaSel(e.target.value)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'IBM Plex Sans', outline: 'none' }}
            >
              {dades.map(d => (
                <option key={d.setmana} value={d.setmana}>
                  Setmana {d.isoweek} · {d.isoyear}
                </option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              disabled={!fila}
              style={{ padding: '0.5rem 1rem', background: 'var(--accent)', color: '#0f1117', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: fila ? 'pointer' : 'not-allowed', fontFamily: 'IBM Plex Sans', whiteSpace: 'nowrap' }}
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {!fila ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>No hi ha dades suficients.</div>
        ) : (
          <div className="estad-setmanal-card" style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thLeft}>Setmana {fila.isoweek} · {fila.isoyear}</th>
                  <th style={th}>
                    Dilluns
                    <div style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-dim)' }}>{fmtData(fila.data_dilluns)}</div>
                  </th>
                  <th style={th}>
                    Dijous
                    <div style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-dim)' }}>{fmtData(fila.data_dijous)}</div>
                  </th>
                  <th style={th}>Setmana</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Ous entrats nostres" dl={fila.ous_nostres_dl} dj={fila.ous_nostres_dj} set={fila.ous_nostres_set} />
                <Row label="Ous entrats maquila" dl={fila.ous_maquila_dl} dj={fila.ous_maquila_dj} set={fila.ous_maquila_set} />
                <Row
                  label="Total ous entrats"
                  dl={fila.ous_nostres_dl + fila.ous_maquila_dl}
                  dj={fila.ous_nostres_dj + fila.ous_maquila_dj}
                  set={fila.ous_nostres_set + fila.ous_maquila_set}
                  strong
                />
                <tr><td colSpan={4} style={{ height: '0.6rem' }} /></tr>
                <Row label="Pollets servits" dl={fila.servits_dl} dj={fila.servits_dj} set={fila.servits_set} strong accent="var(--accent)" />
                <Row label="Pollets sexats" dl={fila.sexats_dl} dj={fila.sexats_dj} set={fila.sexats_set} strong accent="var(--success)" />
              </tbody>
            </table>
          </div>
        )}

        <p style={{ ...labelStyle, marginTop: '1rem', textTransform: 'none', letterSpacing: 0, lineHeight: 1.4 }}>
          Ous separats entre producció pròpia i maquila. Pollets servits i sexats segons el real d&apos;expedició (sexats = expedicions amb sexe assignat). Una setmana mostra el dijous quan el seu full ja ha nascut.
        </p>
      </div>
    </main>
  )
}
