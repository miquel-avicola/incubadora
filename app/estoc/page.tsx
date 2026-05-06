'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Carro {
  id: number
  posta: string
  quantitat_ous: number
  estat: string
  recepcio: string
  lots_reproductores: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: {
      granja: string
      nom_informal: string | null
    }
  }
}

interface Grup {
  lot_id: number
  posta: string
  quantitat_ous: number
  nom: string
  recepcio: string
  carros: Carro[]
}

function nomCarro(carro: Carro) {
  const lot = carro.lots_reproductores
  if (!lot) return `Carro #${carro.id}`
  const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
  const estirp = lot.estirp ? ` ${lot.estirp}` : ''
  return `${granja}${estirp}`
}

export default function Estoc() {
  const [carros, setCarros] = useState<Carro[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmant, setConfirmant] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState<string | null>(null)

  const carregarCarros = useCallback(() => {
    setLoading(true)
    fetch('/api/carros')
      .then(r => r.json())
      .then(data => { setCarros(data); setLoading(false) })
  }, [])

  useEffect(() => { carregarCarros() }, [carregarCarros])

  const grups: Grup[] = Object.values(
    carros.reduce((acc, carro) => {
      const key = `${carro.lots_reproductores?.id}-${carro.posta}-${carro.quantitat_ous}`
      if (!acc[key]) {
        acc[key] = {
          lot_id: carro.lots_reproductores?.id,
          posta: carro.posta,
          quantitat_ous: carro.quantitat_ous,
          nom: nomCarro(carro),
          recepcio: carro.recepcio,
          carros: [],
        }
      }
      acc[key].carros.push(carro)
      return acc
    }, {} as Record<string, Grup>)
  )

  async function eliminarUn(grup: Grup) {
    const key = `${grup.lot_id}-${grup.posta}`
    setEliminant(key)
    try {
      const res = await fetch('/api/carros', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: grup.lot_id, posta: grup.posta, quantitat_ous: grup.quantitat_ous }),
      })
      if (res.ok) carregarCarros()
    } finally {
      setEliminant(null)
      setConfirmant(null)
    }
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '1.25rem' }}>←</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Estoc</p>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Carros disponibles</h1>
          </div>
        </div>

        {loading && <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Carregant...</p>}
        {!loading && carros.length === 0 && <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No hi ha carros disponibles</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {grups.map(grup => {
            const key = `${grup.lot_id}-${grup.posta}`
            const estaConfirmant = confirmant === key
            const estaEliminant = eliminant === key

            return (
              <div key={key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{grup.nom}</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', marginTop: '0.2rem' }}>
                      posta {grup.posta} · {grup.quantitat_ous} ous/carro
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', marginTop: '0.15rem' }}>
                      rebut {grup.recepcio}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {!estaConfirmant ? (
                      <button
                        onClick={() => setConfirmant(key)}
                        style={{ width: '2.25rem', height: '2.25rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'IBM Plex Mono' }}
                      >
                        −1
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => setConfirmant(null)}
                          style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}
                        >
                          Cancel·lar
                        </button>
                        <button
                          onClick={() => eliminarUn(grup)}
                          disabled={!!estaEliminant}
                          style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--danger)', borderRadius: '6px', background: 'rgba(240,68,68,0.1)', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}
                        >
                          {estaEliminant ? '...' : 'Eliminar'}
                        </button>
                      </div>
                    )}
                    <div style={{ background: 'rgba(240,180,41,0.15)', border: '1px solid var(--accent)', borderRadius: '20px', padding: '0.35rem 0.875rem', color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '1rem', fontWeight: 700, minWidth: '2.5rem', textAlign: 'center' }}>
                      {grup.carros.length}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!loading && carros.length > 0 && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>Total disponibles</span>
            <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)' }}>{carros.length} carros</span>
          </div>
        )}

      </div>
    </main>
  )
}
