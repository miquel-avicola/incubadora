'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Assignacio {
  num_carro_full: number
  carros_estoc: {
    posta: string
    lots_reproductores: {
      estirp: string | null
      granges_reproductores: { granja: string; nom_informal: string | null }
    }
  }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  assignacions: Assignacio[]
}

export default function Etiquetes() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [loading, setLoading] = useState(true)
  const [generant, setGenerant] = useState(false)

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const res = await fetch(`/api/carrega/${params.id}`)
    const data = await res.json()
    setFull(data)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  async function descarregarEtiquetes() {
    if (!full) return
    setGenerant(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { EtiquetesCàrregaPDF } = await import('@/app/components/EtiquetesCàrregaPDF')
      const blob = await pdf(<EtiquetesCàrregaPDF full={full} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `etiquetes-carrega-${full.num_carrega}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerant(false)
    }
  }

  if (loading || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href={`/carrega/${full.id}`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrrega #{full.num_carrega}</Link>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏷️</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
            Etiquetes càrrega #{full.num_carrega}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono', marginBottom: '1.5rem' }}>
            {full.assignacions.length} etiquetes · 90 × 90 mm
          </div>
          <button
            onClick={descarregarEtiquetes}
            disabled={generant}
            style={{
              width: '100%', padding: '1rem',
              background: generant ? 'var(--border)' : 'var(--accent)',
              color: generant ? 'var(--text-dim)' : '#0f1117',
              border: 'none', borderRadius: '10px',
              fontSize: '1rem', fontWeight: 700,
              cursor: generant ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Sans',
            }}
          >
            {generant ? 'Generant PDF...' : `⬇ Descarregar ${full.assignacions.length} etiquetes`}
          </button>
        </div>

      </div>
    </main>
  )
}