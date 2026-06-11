'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatData, calcularNaixement } from '@/lib/dates'

interface Comanda {
  id: number
  tipus: string
  quantitat_pollets: number | null
  clients: { nom: string }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  estat: string
  comandes: Comanda[]
}

export default function ImpressionsHub() {
  const [carregues, setCarregues] = useState<Full[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/carrega')
      .then(r => r.json())
      .then(data => {
        setCarregues(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const selectedCarrega = carregues.find(c => c.id === selectedId)

  // Calculem alguns totals de la càrrega seleccionada per mostrar info útil
  const totalPollets = selectedCarrega?.comandes
    .filter(c => c.tipus === 'Pollets')
    .reduce((acc, c) => acc + (c.quantitat_pollets || 0), 0) || 0

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '2rem 1.5rem', fontFamily: 'IBM Plex Sans' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono', display: 'inline-block', marginBottom: '1rem' }}>← Inici</Link>
          <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem', margin: 0 }}>Documents</p>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Documents
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
            Selecciona una càrrega per generar i imprimir la documentació corresponent.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            {/* Càrrega Selector */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
            Número de Càrrega
          </label>
          {loading ? (
            <div style={{ padding: '0.75rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>Carregant càrregues...</div>
          ) : (
            <select 
              value={selectedId || ''} 
              onChange={e => setSelectedId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-3 text-base font-sans bg-surface border border-accent rounded-lg text-text outline-none cursor-pointer"
            >
              <option value="">— Selecciona una càrrega —</option>
              {carregues.map(c => (
                <option key={c.id} value={c.id}>
                  Càrrega #{c.num_carrega} — Càr. {formatData(c.carrega)} · Trans. {c.transferencia ? formatData(c.transferencia) : '—'} · Naix. {formatData(calcularNaixement(c.carrega))} {c.estat === 'Finalitzat' ? '(Finalitzada)' : ''}
                </option>
              ))}
            </select>
          )}

          {/* Info Summary about selected load */}
          {selectedCarrega && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--bg)', borderRadius: '8px', border: '1px dashed var(--border)', display: 'flex', flexWrap: 'wrap', gap: '1rem 2rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Data Càrrega</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>{formatData(selectedCarrega.carrega)}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Transferència</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>{selectedCarrega.transferencia ? formatData(selectedCarrega.transferencia) : '—'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Naixement</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>{formatData(calcularNaixement(selectedCarrega.carrega))}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Objectiu Pollets</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text)' }}>{totalPollets.toLocaleString()}</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Estat</span>
                <strong style={{ fontSize: '1rem', color: selectedCarrega.estat === 'Finalitzat' ? 'var(--success)' : 'var(--accent)' }}>{selectedCarrega.estat}</strong>
              </div>
            </div>
          )}
            </div>
          </div>

          {/* Opcions d'Impressió */}
          <div className="lg:col-span-7" style={{ opacity: selectedId ? 1 : 0.5, transition: 'opacity 0.3s ease', pointerEvents: selectedId ? 'auto' : 'none' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.25rem' }}>
            Documents disponibles
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            
            {/* 1: Fulla de càrrega (abans "Full de treball") */}
            <PrintCard
              href={`/carrega/${selectedId}/imprimir`}
              icon="📋"
              title="Fulla de càrrega"
              description="Document principal amb assignacions, carros de la granja i previsions per la incubadora."
            />

            {/* 2: Full granges (full Yolima) */}
            <PrintCard
              href={`/carrega/${selectedId}/expedicions/imprimir-granges`}
              icon="🏡"
              title="Full granges"
              description="Llistat per client i granja amb naus, pollets, codi REGA i telèfon. (Full Yolima)"
            />

            {/* 3: Full repartiment de Pollets (matriu lots × destins) */}
            <PrintCard
              href={`/carrega/${selectedId}/expedicions/naixement?print=true`}
              icon="🚚"
              title="Full repartiment de Pollets"
              description="Graella de repartiment: quants pollets de cada lot van a cada destí, amb totals i sobrants."
            />

            {/* 4: Etiquetes de càrrega */}
            <PrintCard
              href={`/carrega/${selectedId}/etiquetes`}
              icon="🏷️"
              title="Etiquetes càrrega"
              description="Etiquetes 90×70 mm per enganxar als carros amb el lot, edat i incubadora de destí."
            />

            {/* 5: Etiquetes de pollets / destí */}
            <PrintCard
              href={`/carrega/${selectedId}/expedicions/etiquetes-pollets`}
              icon="🐣"
              title="Etiquetes pollets/destí"
              description="Etiquetes 90×70 mm per a les caixes de pollets, per destí i client."
            />

          </div>
        </div>
      </div>
    </div>
  </main>
  )
}

function PrintCard({ href, icon, title, description }: { href: string, icon: string, title: string, description: string }) {
  return (
    <Link href={href} target="_blank" style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.5rem',
        height: '100%',
        boxSizing: 'border-box',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(240, 180, 41, 0.15)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', lineHeight: 1 }}>{icon}</div>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--text)', fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.4, flexGrow: 1 }}>
          {description}
        </p>
        <div style={{ marginTop: '1rem', color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'IBM Plex Sans' }}>
          Obrir i Imprimir →
        </div>
      </div>
    </Link>
  )
}
