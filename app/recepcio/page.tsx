'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Lot {
  id: number
  data_naixement: string
  estirp: string | null
  granges_reproductores: {
    granja: string
    nom_informal: string | null
  }
}

function nomLot(lot: Lot) {
  const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
  const estirp = lot.estirp ? ` ${lot.estirp}` : ''
  const data = lot.data_naixement
  return `${granja}${estirp} — nascut ${data}`
}

export default function Recepcio() {
  const [lots, setLots] = useState<Lot[]>([])
  const [lotId, setLotId] = useState('')
  const [posta, setPosta] = useState('')
  const [quantitat, setQuantitat] = useState('4800')
  const [nombreCarros, setNombreCarros] = useState('1')
  const [loading, setLoading] = useState(false)
  const [resultat, setResultat] = useState<{ ok: boolean; missatge: string } | null>(null)

  useEffect(() => {
    fetch('/api/lots')
      .then(r => r.json())
      .then(setLots)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResultat(null)

    try {
      const res = await fetch('/api/carros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: lotId, posta, quantitat_ous: quantitat, nombre_carros: nombreCarros }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResultat({ ok: false, missatge: data.error || 'Error desconegut' })
      } else {
        setResultat({ ok: true, missatge: `✓ ${data.created} carro${data.created > 1 ? 's' : ''} registrat${data.created > 1 ? 's' : ''} correctament` })
        setLotId('')
        setPosta('')
        setQuantitat('4800')
        setNombreCarros('1')
      }
    } catch {
      setResultat({ ok: false, missatge: 'Error de connexió' })
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.875rem 1rem',
    color: 'var(--text)',
    fontSize: '1rem',
    outline: 'none',
    fontFamily: 'IBM Plex Sans',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontFamily: 'IBM Plex Mono',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-dim)',
    marginBottom: '0.5rem',
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link href="/estoc" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
              Recepció
            </p>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Carros d&apos;ous</h1>
          </div>
        </div>

        {/* Formulari */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Lot */}
          <div>
            <label style={labelStyle}>Lot de reproductores</label>
            <select
              value={lotId}
              onChange={e => setLotId(e.target.value)}
              required
              style={{ ...inputStyle, background: 'var(--surface)' }}
            >
              <option value="">Selecciona un lot...</option>
              {lots.map(lot => (
                <option key={lot.id} value={lot.id}>{nomLot(lot)}</option>
              ))}
            </select>
          </div>

          {/* Data de posta */}
          <div>
            <label style={labelStyle}>Data de posta</label>
            <input
              type="date"
              value={posta}
              onChange={e => setPosta(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {/* Quantitat d'ous */}
          <div>
            <label style={labelStyle}>Ous per carro</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {['4800', '2400'].map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantitat(q)}
                  style={{
                    flex: 1,
                    padding: '0.875rem',
                    border: '1px solid',
                    borderColor: quantitat === q ? 'var(--accent)' : 'var(--border)',
                    borderRadius: '8px',
                    background: quantitat === q ? 'rgba(240,180,41,0.1)' : 'var(--bg)',
                    color: quantitat === q ? 'var(--accent)' : 'var(--text-dim)',
                    fontFamily: 'IBM Plex Mono',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre de carros */}
          <div>
            <label style={labelStyle}>Nombre de carros</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => setNombreCarros(n => String(Math.max(1, parseInt(n) - 1)))}
                style={{
                  width: '3rem', height: '3rem',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >−</button>
              <input
                type="number"
                value={nombreCarros}
                onChange={e => setNombreCarros(e.target.value)}
                min="1"
                max="20"
                required
                style={{ ...inputStyle, textAlign: 'center', fontFamily: 'IBM Plex Mono', fontSize: '1.5rem', fontWeight: 700 }}
              />
              <button
                type="button"
                onClick={() => setNombreCarros(n => String(Math.min(20, parseInt(n) + 1)))}
                style={{
                  width: '3rem', height: '3rem',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >+</button>
            </div>
          </div>

          {/* Resultat */}
          {resultat && (
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              background: resultat.ok ? 'rgba(62,207,142,0.1)' : 'rgba(240,68,68,0.1)',
              border: `1px solid ${resultat.ok ? 'var(--success)' : 'var(--danger)'}`,
              color: resultat.ok ? 'var(--success)' : 'var(--danger)',
              fontFamily: 'IBM Plex Mono',
              fontSize: '0.9rem',
            }}>
              {resultat.missatge}
            </div>
          )}

          {/* Botó enviar */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading ? 'var(--border)' : 'var(--accent)',
              color: loading ? 'var(--text-dim)' : '#0f1117',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Sans',
              marginTop: '0.5rem',
            }}
          >
            {loading ? 'Registrant...' : `Registrar ${nombreCarros} carro${parseInt(nombreCarros) > 1 ? 's' : ''}`}
          </button>

        </form>
      </div>
    </main>
  )
}
