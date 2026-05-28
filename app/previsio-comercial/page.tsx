'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Cell {
  quantitat: number
  origen: 'real' | 'preliminar' | 'recurrent'
  comanda_id?: number
}

interface Fila {
  data: string
  data_carrega: string
  dia_setmana: string
  cells: Record<string, Cell>
  total_pollets: number
  total_maquila: number
  total_carros: number
}

interface Columna {
  key: string
  client_id: number
  nom_client: string
  tipus: 'Pollets' | 'Maquila'
}

interface Resposta {
  rang: { inici: string; fi: string }
  pollets_per_carro: number
  n_naixements_mitjana: number
  columnes: Columna[]
  files: Fila[]
}

function fmtData(s: string) {
  const d = new Date(s + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function inputBgColor(origen: 'real' | 'preliminar' | 'recurrent' | null) {
  if (origen === 'real') return 'rgba(34, 197, 94, 0.12)'         // verd
  if (origen === 'preliminar') return 'rgba(245, 158, 11, 0.12)'  // groc
  if (origen === 'recurrent') return 'rgba(148, 163, 184, 0.1)'   // gris
  return 'transparent'
}

function inputTextColor(origen: 'real' | 'preliminar' | 'recurrent' | null) {
  if (origen === 'recurrent') return 'var(--text-dim)'
  return 'var(--text)'
}

interface ClientOpcio {
  id: number
  nom: string
}

export default function PrevisioComercial() {
  const [data, setData] = useState<Resposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [inici, setInici] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1) // dilluns de la setmana actual
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [setmanes, setSetmanes] = useState(8)

  // Valors editats localment (no guardats encara)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [guardant, setGuardant] = useState<string | null>(null)

  // Formulari "Nova comanda"
  const [mostrarForm, setMostrarForm] = useState(false)
  const [clients, setClients] = useState<ClientOpcio[]>([])
  const [novaClientId, setNovaClientId] = useState('')
  const [novaData, setNovaData] = useState('')
  const [novaTipus, setNovaTipus] = useState<'Pollets' | 'Maquila'>('Pollets')
  const [novaQuantitat, setNovaQuantitat] = useState('')
  const [novaSexat, setNovaSexat] = useState(false)
  const [creant, setCreant] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/previsio-comercial?inici=${inici}&setmanes=${setmanes}`, { cache: 'no-store' })
    const d: Resposta = await res.json()
    setData(d)
    setEdits({})
    setLoading(false)
  }, [inici, setmanes])

  useEffect(() => { carregar() }, [carregar])

  // Carregar llista de clients per al formulari nova comanda
  useEffect(() => {
    fetch('/api/clients-list').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
  }, [])

  async function crearNovaComanda() {
    if (!novaClientId || !novaData || !novaQuantitat) {
      alert('Cal omplir client, data i quantitat')
      return
    }
    setCreant(true)
    try {
      const q = parseInt(novaQuantitat) || 0
      const res = await fetch('/api/comandes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: parseInt(novaClientId),
          tipus: novaTipus,
          quantitat_pollets: novaTipus === 'Pollets' ? q : null,
          quantitat_ous_maquila: novaTipus === 'Maquila' ? q : null,
          sexat: novaSexat,
          data_prevista_naixement: novaData,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`Error: ${err.error || 'desconegut'}`)
        return
      }
      // Reset form i recarregar
      setNovaClientId(''); setNovaData(''); setNovaQuantitat(''); setNovaSexat(false)
      setMostrarForm(false)
      await carregar()
    } finally {
      setCreant(false)
    }
  }

  async function guardarCell(filaData: string, col: Columna, valor: string) {
    const cellKey = `${filaData}_${col.key}`
    setGuardant(cellKey)
    const q = parseInt(valor) || 0
    try {
      const res = await fetch('/api/previsio-comercial/cell', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: filaData, client_id: col.client_id, tipus: col.tipus, quantitat: q }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`No s'ha pogut guardar: ${err.error || 'error desconegut'}`)
        return
      }
      // Esborrar l'edit local i recarregar
      setEdits(prev => {
        const cp = { ...prev }
        delete cp[cellKey]
        return cp
      })
      await carregar()
    } finally {
      setGuardant(null)
    }
  }

  function navegar(deltaSetmanes: number) {
    const d = new Date(inici + 'T00:00:00')
    d.setDate(d.getDate() + deltaSetmanes * 7)
    setInici(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  if (loading || !data) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  const totalGlobalPollets = data.files.reduce((s, f) => s + f.total_pollets, 0)
  const totalGlobalCarros = Math.round(data.files.reduce((s, f) => s + f.total_carros, 0) * 10) / 10
  const totalGlobalMaquila = data.files.reduce((s, f) => s + f.total_maquila, 0)

  // Separar columnes per tipus
  const colsPollets = data.columnes.filter(c => c.tipus === 'Pollets')
  const colsMaquila = data.columnes.filter(c => c.tipus === 'Maquila')

  const thStyle: React.CSSProperties = { padding: '0.4rem 0.5rem', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textAlign: 'center', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', background: 'var(--surface)', position: 'sticky', top: 0 }
  const tdStyle: React.CSSProperties = { padding: '0.25rem 0.4rem', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', textAlign: 'center', borderBottom: '1px solid var(--border)' }

  function renderCell(fila: Fila, col: Columna) {
    const cellKey = `${fila.data}_${col.key}`
    const cell = fila.cells[col.key]
    const editValue = edits[cellKey]
    const origen = cell?.origen || null
    const isReal = origen === 'real'
    const value = editValue !== undefined ? editValue : (cell ? String(cell.quantitat) : '')

    return (
      <td key={col.key} style={{ ...tdStyle, padding: '0.15rem 0.2rem' }}>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          disabled={isReal || guardant === cellKey}
          onChange={ev => setEdits(prev => ({ ...prev, [cellKey]: ev.target.value }))}
          onBlur={() => {
            if (editValue !== undefined && editValue !== (cell ? String(cell.quantitat) : '')) {
              guardarCell(fila.data, col, editValue)
            }
          }}
          onKeyDown={ev => {
            if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur()
            if (ev.key === 'Escape') {
              setEdits(prev => {
                const cp = { ...prev }
                delete cp[cellKey]
                return cp
              })
              ;(ev.target as HTMLInputElement).blur()
            }
          }}
          placeholder=""
          style={{
            width: '5rem',
            padding: '0.3rem 0.4rem',
            background: inputBgColor(origen),
            border: '1px solid var(--border)',
            borderRadius: '4px',
            color: inputTextColor(origen),
            fontSize: '0.8rem',
            fontFamily: 'IBM Plex Mono',
            textAlign: 'right',
            outline: 'none',
            cursor: isReal ? 'not-allowed' : 'text',
          }}
          title={
            origen === 'real' ? 'Comanda confirmada (no editable des d\'aquí)' :
            origen === 'preliminar' ? 'Comanda preliminar — edita lliurement' :
            origen === 'recurrent' ? 'Projecció de regla recurrent — escriu un valor per fixar-lo' :
            ''
          }
        />
      </td>
    )
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1rem' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Inici</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Planificació</p>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Previsió comercial</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              style={{
                padding: '0.5rem 1rem', background: mostrarForm ? 'var(--bg)' : 'var(--accent)',
                border: '1px solid', borderColor: mostrarForm ? 'var(--border)' : 'var(--accent)',
                borderRadius: '8px', color: mostrarForm ? 'var(--text)' : '#0f1117',
                fontFamily: 'IBM Plex Sans', fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {mostrarForm ? 'Cancel·lar' : '+ Nova comanda'}
            </button>
            <Link href="/previsio-comercial/regles" style={{
              padding: '0.5rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text)', fontFamily: 'IBM Plex Sans',
              fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600,
            }}>
              ⚙ Regles
            </Link>
          </div>
        </div>

        {/* Formulari nova comanda manual */}
        {mostrarForm && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '10px',
            padding: '1rem', marginBottom: '1rem',
          }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
              Afegir comanda puntual
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr 1fr 1fr auto auto', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={novaClientId}
                onChange={e => setNovaClientId(e.target.value)}
                style={{ padding: '0.5rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'IBM Plex Sans', fontSize: '0.85rem' }}
              >
                <option value="">— Client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <input
                type="date"
                value={novaData}
                onChange={e => setNovaData(e.target.value)}
                style={{ padding: '0.5rem 0.6rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem' }}
              />
              <select
                value={novaTipus}
                onChange={e => setNovaTipus(e.target.value as any)}
                style={{ padding: '0.5rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'IBM Plex Sans', fontSize: '0.85rem' }}
              >
                <option value="Pollets">Pollets</option>
                <option value="Maquila">Maquila</option>
              </select>
              <input
                type="number"
                value={novaQuantitat}
                onChange={e => setNovaQuantitat(e.target.value)}
                placeholder="Quantitat"
                style={{ padding: '0.5rem 0.6rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'right' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={novaSexat} onChange={e => setNovaSexat(e.target.checked)} />
                Sexat
              </label>
              <button
                onClick={crearNovaComanda}
                disabled={creant}
                style={{
                  padding: '0.55rem 0.9rem', background: 'var(--accent)', color: '#0f1117',
                  border: 'none', borderRadius: '6px', fontFamily: 'IBM Plex Sans',
                  fontWeight: 700, fontSize: '0.85rem', cursor: creant ? 'wait' : 'pointer',
                }}
              >
                {creant ? '...' : 'Afegir'}
              </button>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', margin: '0.6rem 0 0 0' }}>
              La data és la data prevista de naixement. La comanda apareixerà al calendari encara que el client estigui amagat.
            </p>
          </div>
        )}

        {/* Navegació + totals */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button onClick={() => navegar(-4)} style={btnNav}>« 4 set</button>
            <button onClick={() => navegar(-1)} style={btnNav}>« 1 set</button>
            <input
              type="date"
              value={inici}
              onChange={e => setInici(e.target.value)}
              style={{ padding: '0.4rem 0.6rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem' }}
            />
            <button onClick={() => navegar(1)} style={btnNav}>1 set »</button>
            <button onClick={() => navegar(4)} style={btnNav}>4 set »</button>
            <select value={setmanes} onChange={e => setSetmanes(parseInt(e.target.value))} style={{ marginLeft: '0.5rem', padding: '0.4rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem' }}>
              <option value="4">4 setmanes</option>
              <option value="8">8 setmanes</option>
              <option value="12">12 setmanes</option>
              <option value="20">20 setmanes</option>
            </select>
          </div>
          <div style={{ fontSize: '0.78rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textAlign: 'right' }}>
            <div>Pollets/carro mitjana: <strong style={{ color: 'var(--text)' }}>{data.pollets_per_carro.toLocaleString()}</strong> <span style={{ color: 'var(--text-dim)' }}>(n={data.n_naixements_mitjana})</span></div>
            <div style={{ marginTop: '0.2rem' }}>
              Total: <strong style={{ color: 'var(--text)' }}>{totalGlobalPollets.toLocaleString()}</strong> pollets ·
              <strong style={{ color: 'var(--accent)', marginLeft: '0.4rem' }}>{totalGlobalCarros}</strong> carros MA
              {totalGlobalMaquila > 0 && (
                <> · <strong style={{ color: 'var(--text)' }}>{totalGlobalMaquila.toLocaleString()}</strong> maquila</>
              )}
            </div>
          </div>
        </div>

        {/* Llegenda */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.72rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
          <span><span style={{ display: 'inline-block', width: '0.8rem', height: '0.8rem', background: inputBgColor('real'), border: '1px solid var(--border)', borderRadius: '2px', verticalAlign: 'middle', marginRight: '0.3rem' }} />Real (comanda confirmada)</span>
          <span><span style={{ display: 'inline-block', width: '0.8rem', height: '0.8rem', background: inputBgColor('preliminar'), border: '1px solid var(--border)', borderRadius: '2px', verticalAlign: 'middle', marginRight: '0.3rem' }} />Preliminar (editada)</span>
          <span><span style={{ display: 'inline-block', width: '0.8rem', height: '0.8rem', background: inputBgColor('recurrent'), border: '1px solid var(--border)', borderRadius: '2px', verticalAlign: 'middle', marginRight: '0.3rem' }} />Recurrent (projecció)</span>
        </div>

        {/* Taula */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: '5rem' }}>Dia</th>
                <th style={thStyle}>Càrrega</th>
                <th style={thStyle}>Naixement</th>
                {colsPollets.map(c => (
                  <th key={c.key} style={thStyle} title={c.nom_client}>{c.nom_client}</th>
                ))}
                {colsMaquila.length > 0 && colsMaquila.map(c => (
                  <th key={c.key} style={{ ...thStyle, color: 'var(--accent)' }} title={`${c.nom_client} (Maquila)`}>{c.nom_client} (M)</th>
                ))}
                <th style={{ ...thStyle, background: 'rgba(245,158,11,0.08)' }}>Total pollets</th>
                <th style={{ ...thStyle, background: 'rgba(245,158,11,0.08)' }}>Carros MA</th>
                {colsMaquila.length > 0 && <th style={thStyle}>Maquila</th>}
              </tr>
            </thead>
            <tbody>
              {data.files.map((fila, i) => {
                const esDilluns = fila.dia_setmana === 'Dilluns'
                return (
                  <tr key={fila.data} style={{ background: i % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent', borderTop: esDilluns && i > 0 ? '2px solid var(--border)' : undefined }}>
                    <td style={{ ...tdStyle, textAlign: 'left', color: esDilluns ? 'var(--accent)' : 'var(--text-dim)', fontWeight: esDilluns ? 700 : 400 }}>{fila.dia_setmana}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-dim)' }}>{fmtData(fila.data_carrega)}</td>
                    <td style={tdStyle}>{fmtData(fila.data)}</td>
                    {colsPollets.map(c => renderCell(fila, c))}
                    {colsMaquila.map(c => renderCell(fila, c))}
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{fila.total_pollets ? fila.total_pollets.toLocaleString() : '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--accent)' }}>{fila.total_carros || '—'}</td>
                    {colsMaquila.length > 0 && (
                      <td style={tdStyle}>{fila.total_maquila ? fila.total_maquila.toLocaleString() : '—'}</td>
                    )}
                  </tr>
                )
              })}
              {data.files.length === 0 && (
                <tr>
                  <td colSpan={3 + colsPollets.length + colsMaquila.length + 2 + (colsMaquila.length > 0 ? 1 : 0)} style={{ ...tdStyle, padding: '1rem', color: 'var(--text-dim)' }}>
                    Cap dia dins del rang seleccionat. Configura regles recurrents o crea comandes per veure-hi alguna cosa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

const btnNav: React.CSSProperties = {
  padding: '0.4rem 0.6rem', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: '6px', color: 'var(--text)', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem', cursor: 'pointer',
}
