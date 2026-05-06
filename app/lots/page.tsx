'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Granja {
  id: number
  granja: string
  nom_informal: string | null
  marca_oficial: string | null
}

interface Lot {
  id: number
  data_naixement: string
  estirp: string | null
  granges_reproductores: {
    granja: string
    nom_informal: string | null
  }
}

export default function Lots() {
  const [lots, setLots] = useState<Lot[]>([])
  const [granges, setGranges] = useState<Granja[]>([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarFormGranja, setMostrarFormGranja] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultat, setResultat] = useState<{ ok: boolean; missatge: string } | null>(null)

  // Formulari nou lot
  const [granjaId, setGranjaId] = useState('')
  const [dataNaixement, setDataNaixement] = useState('')
  const [estirp, setEstirp] = useState('')

  // Formulari nova granja
  const [nomGranja, setNomGranja] = useState('')
  const [nomInformal, setNomInformal] = useState('')
  const [marcaOficial, setMarcaOficial] = useState('')
  const [codiRega, setCodiRega] = useState('')

  useEffect(() => {
    fetch('/api/lots').then(r => r.json()).then(setLots)
    fetch('/api/granges').then(r => r.json()).then(setGranges)
  }, [])

  async function crearLot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResultat(null)
    try {
      const res = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granja_reproductora_id: granjaId, data_naixement: dataNaixement, estirp: estirp || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResultat({ ok: false, missatge: data.error })
      } else {
        setResultat({ ok: true, missatge: 'Lot creat correctament' })
        setMostrarForm(false)
        setGranjaId(''); setDataNaixement(''); setEstirp('')
        fetch('/api/lots').then(r => r.json()).then(setLots)
      }
    } catch {
      setResultat({ ok: false, missatge: 'Error de connexió' })
    } finally {
      setLoading(false)
    }
  }

  async function crearGranja(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/granges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granja: nomGranja, nom_informal: nomInformal || null, marca_oficial: marcaOficial || null, codi_rega: codiRega || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResultat({ ok: false, missatge: data.error })
      } else {
        setResultat({ ok: true, missatge: 'Granja creada correctament' })
        setMostrarFormGranja(false)
        setNomGranja(''); setNomInformal(''); setMarcaOficial(''); setCodiRega('')
        fetch('/api/granges').then(r => r.json()).then(setGranges)
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
    padding: '0.75rem 1rem',
    color: 'var(--text)',
    fontSize: '0.95rem',
    outline: 'none',
    fontFamily: 'IBM Plex Sans',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '0.7rem',
    fontFamily: 'IBM Plex Mono',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-dim)',
    marginBottom: '0.4rem',
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>
                Gestió
              </p>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Lots de reproductores</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setMostrarFormGranja(!mostrarFormGranja); setMostrarForm(false) }}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-dim)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontFamily: 'IBM Plex Sans',
              }}
            >
              + Granja
            </button>
            <button
              onClick={() => { setMostrarForm(!mostrarForm); setMostrarFormGranja(false) }}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '8px',
                color: '#0f1117',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'IBM Plex Sans',
              }}
            >
              + Lot
            </button>
          </div>
        </div>

        {/* Resultat */}
        {resultat && (
          <div style={{
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            background: resultat.ok ? 'rgba(62,207,142,0.1)' : 'rgba(240,68,68,0.1)',
            border: `1px solid ${resultat.ok ? 'var(--success)' : 'var(--danger)'}`,
            color: resultat.ok ? 'var(--success)' : 'var(--danger)',
            fontFamily: 'IBM Plex Mono',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}>
            {resultat.missatge}
          </div>
        )}

        {/* Formulari nova granja */}
        {mostrarFormGranja && (
          <form onSubmit={crearGranja} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <p style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>Nova granja reproductora</p>
            <div>
              <label style={labelStyle}>Nom oficial *</label>
              <input value={nomGranja} onChange={e => setNomGranja(e.target.value)} required style={inputStyle} placeholder="Ex: SAMANIEGO BOTARELL" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Nom informal</label>
                <input value={nomInformal} onChange={e => setNomInformal(e.target.value)} style={inputStyle} placeholder="Ex: Botarell" />
              </div>
              <div>
                <label style={labelStyle}>Marca oficial</label>
                <input value={marcaOficial} onChange={e => setMarcaOficial(e.target.value)} style={inputStyle} placeholder="Ex: 1360BU" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Codi REGA</label>
              <input value={codiRega} onChange={e => setCodiRega(e.target.value)} style={inputStyle} placeholder="Ex: ES0001234" />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setMostrarFormGranja(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                Cancel·lar
              </button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: '0.75rem', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#0f1117', fontWeight: 700, cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                Crear granja
              </button>
            </div>
          </form>
        )}

        {/* Formulari nou lot */}
        {mostrarForm && (
          <form onSubmit={crearLot} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <p style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>Nou lot de reproductores</p>
            <div>
              <label style={labelStyle}>Granja reproductora *</label>
              <select value={granjaId} onChange={e => setGranjaId(e.target.value)} required style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Selecciona una granja...</option>
                {granges.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nom_informal ? `${g.nom_informal} (${g.granja})` : g.granja}
                    {g.marca_oficial ? ` — ${g.marca_oficial}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Data de naixement *</label>
                <input type="date" value={dataNaixement} onChange={e => setDataNaixement(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Estirp</label>
                <select value={estirp} onChange={e => setEstirp(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Cap</option>
                  <option value="Ross">Ross</option>
                  <option value="Cobb">Cobb</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={() => setMostrarForm(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                Cancel·lar
              </button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: '0.75rem', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#0f1117', fontWeight: 700, cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                Crear lot
              </button>
            </div>
          </form>
        )}

        {/* Llista de lots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {lots.length === 0 && (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem' }}>
              No hi ha lots registrats
            </p>
          )}
          {lots.map(lot => (
            <div key={lot.id} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja}
                  {lot.estirp && <span style={{ color: 'var(--accent)', marginLeft: '0.5rem', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem' }}>{lot.estirp}</span>}
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', marginTop: '0.2rem' }}>
                  nascut {lot.data_naixement}
                </div>
              </div>
              <div style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem' }}>
                #{lot.id}
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
