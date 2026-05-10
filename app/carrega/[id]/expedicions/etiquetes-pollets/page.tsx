'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import { EtiquetesPolletsPDF } from '@/app/components/EtiquetesPolletsPDF'

interface ExpedicioLot {
  id: number
  pollets: number
  lots_reproductores: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: { granja: string; nom_informal: string | null }
  }
}

interface Expedicio {
  id: number
  ordre: number | null
  pollets_comanda: number | null
  comandes: { id: number; clients: { id: number; nom: string } }
  destinacions: { nom_granja: string; nau: string | null }
  expedicio_lots: ExpedicioLot[]
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
}

export default function EtiquetesPolletsPage() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [expedicions, setExpedicions] = useState<Expedicio[]>([])
  const [loading, setLoading] = useState(true)
  const [generant, setGenerant] = useState(false)

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [fullRes, expRes] = await Promise.all([
      fetch(`/api/carrega/${params.id}`).then(r => r.json()),
      fetch(`/api/carrega/${params.id}/expedicions`).then(r => r.json()),
    ])

    setFull(fullRes)
    setExpedicions(expRes)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  async function descarregarEtiquetes() {
    if (!full || expedicions.length === 0) return
    setGenerant(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const blob = await pdf(<EtiquetesPolletsPDF full={{ ...full, expedicions }} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `etiquetes-pollets-carrega-${full.num_carrega}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerant(false)
    }
  }

  if (loading) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  if (!full) return null

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <Link href={`/carrega/${full.id}/expedicions`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Expedicions</Link>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.75rem 0 0' }}>Etiquetes pollets de càrrega #{full.num_carrega}</h1>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏷️</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            {expedicions.length} etiquetes generades
          </div>
          <button
            onClick={descarregarEtiquetes}
            disabled={generant || expedicions.length === 0}
            style={{
              width: '100%', padding: '1rem',
              background: generant || expedicions.length === 0 ? 'var(--border)' : 'var(--accent)',
              color: generant || expedicions.length === 0 ? 'var(--text-dim)' : '#0f1117',
              border: 'none', borderRadius: '10px',
              fontSize: '1rem', fontWeight: 700,
              cursor: generant || expedicions.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'IBM Plex Sans',
            }}
          >
            {generant ? 'Generant PDF...' : `⬇ Descarregar ${expedicions.length} etiquetes`}
          </button>
          {expedicions.length === 0 && (
            <p style={{ marginTop: '1rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem' }}>
              No hi ha expedicions per generar etiquetes.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
