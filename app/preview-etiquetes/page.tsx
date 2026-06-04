// app/preview-etiquetes/page.tsx
// ⚠️ PÀGINA TEMPORAL DE PROVES — només per validar el disseny/impressió de les
// etiquetes 90×70 mm en local. ESBORRAR aquesta carpeta quan s'hagi validat.
'use client'

import { useEffect, useState } from 'react'
import type { LabelPollet } from '@/app/components/EtiquetesPolletsPDF'

// Dades d'exemple de pollets, cobrint casos límit
const samplePollets: LabelPollet[] = [
  { client: 'Avícola Mas Vell', poblacio: 'Vic', nom_granja: 'Granja Can Soler', nau: '3', sexe: 'F', esPico: false },
  { client: 'Explotacions Ramaderes Puigverd SL', poblacio: 'Sant Pere de Torelló', nom_granja: 'Mas de la Coma de Baix', nau: '12', sexe: 'M', esPico: false },
  { client: 'Granja Rovira', poblacio: 'Manlleu', nom_granja: 'El Pinar', nau: null, sexe: 'F', esPico: true },
  { client: 'Cooperativa Plana de Vic', poblacio: null, nom_granja: 'Santa Eulàlia', nau: null, sexe: null, esPico: false },
]

// Dades d'exemple per a l'etiqueta de càrrega (mateixa forma que l'API real)
const sampleFull = {
  num_carrega: 1247,
  carrega: '2026-06-02',
  transferencia: '2026-06-12',
  assignacions: [
    { num_carro_full: 1, carros_estoc: { posta: '2026-05-30', lots_reproductores: { estirp: 'Ross 308', granges_reproductores: { granja: 'Granja A', nom_informal: 'Can Pinós' } } } },
    { num_carro_full: 2, carros_estoc: { posta: '2026-05-31', lots_reproductores: { estirp: null, granges_reproductores: { granja: 'Granja Bellavista', nom_informal: null } } } },
    { num_carro_full: 3, carros_estoc: { posta: '2026-06-01', lots_reproductores: { estirp: 'Cobb 500', granges_reproductores: { granja: 'Mas Gran', nom_informal: 'El Mas' } } } },
  ],
}

export default function PreviewEtiquetes() {
  const [polletsUrl, setPolletsUrl] = useState<string | null>(null)
  const [carregaUrl, setCarregaUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const urls: string[] = []
    let cancelled = false
    ;(async () => {
      try {
        const { pdf } = await import('@react-pdf/renderer')
        const { default: EtiquetesPolletsPDF } = await import('@/app/components/EtiquetesPolletsPDF')
        const { EtiquetesCàrregaPDF } = await import('@/app/components/EtiquetesCàrregaPDF')

        const blobPollets = await pdf(<EtiquetesPolletsPDF labels={samplePollets} />).toBlob()
        const blobCarrega = await pdf(<EtiquetesCàrregaPDF full={sampleFull} />).toBlob()
        if (cancelled) return

        const u1 = URL.createObjectURL(blobPollets); urls.push(u1); setPolletsUrl(u1)
        const u2 = URL.createObjectURL(blobCarrega); urls.push(u2); setCarregaUrl(u2)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true; urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [])

  return (
    <main style={{ background: '#0f1117', minHeight: '100vh', padding: '1.5rem', color: '#e7e9ee', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>Previsualització etiquetes 90×70 mm</h1>
        <p style={{ color: '#f0b429', fontSize: '0.85rem', marginTop: 0 }}>
          ⚠️ Pàgina temporal de proves. En imprimir: escala 100% / mida real, suport 90×70 mm.
        </p>

        {error && (
          <pre style={{ background: '#2a1414', color: '#ff8a8a', padding: '1rem', borderRadius: 8, whiteSpace: 'pre-wrap' }}>{error}</pre>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
          {/* Pollets */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Pollets ({samplePollets.length} et.)</h2>
              {polletsUrl && <a href={polletsUrl} download="preview-pollets.pdf" style={{ color: '#f0b429', fontSize: '0.85rem' }}>⬇ Descarregar</a>}
            </div>
            {polletsUrl
              ? <iframe src={polletsUrl} title="Etiquetes pollets" style={{ width: '100%', height: 520, border: '1px solid #2a2e3a', borderRadius: 8, background: '#fff' }} />
              : <p style={{ color: '#8b90a0' }}>Generant…</p>}
          </section>

          {/* Càrrega */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Càrrega ({sampleFull.assignacions.length} et.)</h2>
              {carregaUrl && <a href={carregaUrl} download="preview-carrega.pdf" style={{ color: '#f0b429', fontSize: '0.85rem' }}>⬇ Descarregar</a>}
            </div>
            {carregaUrl
              ? <iframe src={carregaUrl} title="Etiquetes càrrega" style={{ width: '100%', height: 520, border: '1px solid #2a2e3a', borderRadius: 8, background: '#fff' }} />
              : <p style={{ color: '#8b90a0' }}>Generant…</p>}
          </section>
        </div>
      </div>
    </main>
  )
}
