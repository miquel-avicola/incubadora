// app/carrega/[id]/expedicions/etiquetes-pollets/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { DistribucioSaved } from '../page'

interface ExpedicioInfo {
  id: number
  client: string
  sexe: string | null
  nom_granja: string
  nau: string | null
  poblacio: string | null
  carros_sencers: number
  pico_caixes: number
}

export default function EtiquetesPollets() {
  const params = useParams()
  const [expedicions, setExpedicions] = useState<ExpedicioInfo[]>([])
  const [distribucio, setDistribucio] = useState<DistribucioSaved>({})
  const [loading, setLoading] = useState(true)
  const [descarregant, setDescarregant] = useState(false)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/carrega/${params.id}`)
      .then(r => r.json())
      .then((data: { distribucio_carros?: DistribucioSaved | null }) => {
        setDistribucio(data?.distribucio_carros || {})
      })
      .catch(() => { /* ignore */ })
  }, [params.id])

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/carrega/${params.id}/expedicions`)
      .then(r => r.json())
      .then((data: any[]) => {
        const mapped: ExpedicioInfo[] = data.map(e => ({
          id: e.id,
          client: e.comandes?.clients?.nom ?? '',
          sexe: e.sexe ?? null,
          nom_granja: e.destinacions.nom_granja,
          nau: e.destinacions.nau ?? null,
          poblacio: e.destinacions.poblacio ?? null,
          carros_sencers: 0,
          pico_caixes: 0,
        }))
        setExpedicions(mapped)
        setLoading(false)
      })
  }, [params.id])

  // Fusionar distribució
  const expAmbDist: ExpedicioInfo[] = expedicions.map(e => {
    for (const grup of Object.values(distribucio)) {
      const distExp = grup.per_expedicio[String(e.id)]
      if (distExp) {
        return { ...e, carros_sencers: distExp.carros_sencers, pico_caixes: distExp.pico_caixes }
      }
    }
    return e
  }).filter(e => e.carros_sencers > 0 || e.pico_caixes > 0)

  async function descarregarPDF() {
    setDescarregant(true)
    try {
      const labels: Array<{ client: string; sexe: string | null; nom_granja: string; nau: string | null; poblacio: string | null; esPico: boolean }> = []
      for (const e of expAmbDist) {
        // N etiquetes per als carros sencers
        for (let i = 0; i < e.carros_sencers; i++) {
          labels.push({ client: e.client, sexe: e.sexe, nom_granja: e.nom_granja, nau: e.nau, poblacio: e.poblacio, esPico: false })
        }
        // 1 etiqueta per al pico (si n'hi ha)
        if (e.pico_caixes > 0) {
          labels.push({ client: e.client, sexe: e.sexe, nom_granja: e.nom_granja, nau: e.nau, poblacio: e.poblacio, esPico: true })
        }
      }
      const { pdf } = await import('@react-pdf/renderer')
      const { default: EtiquetesPolletsPDF } = await import('@/app/components/EtiquetesPolletsPDF')
      const blob = await pdf(<EtiquetesPolletsPDF labels={labels} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `etiquetes-pollets-carrega-${params.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error generant PDF:', err)
    }
    setDescarregant(false)
  }

  const totalEtiquetes = expAmbDist.reduce(
    (s, e) => s + e.carros_sencers + (e.pico_caixes > 0 ? 1 : 0),
    0
  )

  if (loading) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1rem' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Capçalera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href={`/carrega/${params.id}/expedicions`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>
              ← Expedicions
            </Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Etiquetes 90×70mm</p>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Etiquetes de pollets</h1>
            </div>
          </div>
          <button
            onClick={descarregarPDF}
            disabled={descarregant || totalEtiquetes === 0}
            style={{
              padding: '0.6rem 1rem',
              background: totalEtiquetes > 0 && !descarregant ? 'var(--accent)' : 'var(--border)',
              color: totalEtiquetes > 0 && !descarregant ? '#0f1117' : 'var(--text-dim)',
              border: 'none', borderRadius: '8px', fontWeight: 700,
              fontFamily: 'IBM Plex Sans', fontSize: '0.85rem',
              cursor: totalEtiquetes > 0 && !descarregant ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            {descarregant ? 'Generant...' : `🖨 PDF (${totalEtiquetes} et.)`}
          </button>
        </div>

        {/* Avís sense distribució */}
        {Object.keys(distribucio).length === 0 && (
          <div style={{ padding: '0.875rem 1rem', marginBottom: '1rem', background: 'rgba(240,180,41,0.1)', border: '1px solid var(--accent)', borderRadius: '12px', fontSize: '0.82rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)' }}>
            ⚠ No hi ha distribució guardada. Primer cal calcular i triar una opció de distribució a la pàgina d'expedicions.
          </div>
        )}

        {/* Llista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {expAmbDist.map(e => {
            const numEtiquetes = e.carros_sencers + (e.pico_caixes > 0 ? 1 : 0)
            return (
              <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{e.client}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', marginTop: '0.15rem' }}>
                      {e.nom_granja}{e.poblacio ? ` · ${e.poblacio}` : ''}
                    </div>
                    <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {e.sexe && (
                        <span style={{
                          fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', fontWeight: 700,
                          padding: '0.1rem 0.5rem', borderRadius: '4px',
                          background: e.sexe === 'F' ? 'rgba(236,72,153,0.15)' : 'rgba(59,130,246,0.15)',
                          color: e.sexe === 'F' ? '#ec4899' : '#3b82f6',
                        }}>
                          {e.sexe === 'F' ? '♀ Femelles' : '♂ Mascles'}
                        </span>
                      )}
                      <span style={{ fontSize: '0.72rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
                        {e.carros_sencers} carro{e.carros_sencers !== 1 ? 's' : ''}
                        {e.pico_caixes > 0 && ` + pico (${e.pico_caixes} cx)`}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '1rem' }}>
                    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{numEtiquetes}</div>
                    <div style={{ fontSize: '0.6rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase' }}>etiquetes</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {expAmbDist.length === 0 && Object.keys(distribucio).length > 0 && (
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem', fontFamily: 'IBM Plex Mono' }}>
            Cap expedició amb distribució assignada
          </p>
        )}

      </div>
    </main>
  )
}
