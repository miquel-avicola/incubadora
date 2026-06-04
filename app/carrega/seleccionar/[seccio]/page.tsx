import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatData, diaSemana } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const SECCIONS: Record<string, { nom: string; href: (id: number) => string }> = {
  assignacions:  { nom: 'Assignacions',       href: id => `/carrega/${id}/assignacions` },
  vacunes:       { nom: 'Pla vacunal',         href: id => `/carrega/${id}/vacunes` },
  transferencia: { nom: 'Transferència',       href: id => `/carrega/${id}/transferencia` },
  naixement:     { nom: 'Naixement',           href: id => `/carrega/${id}/naixement` },
  expedicions:   { nom: 'Expedicions',         href: id => `/carrega/${id}/expedicions` },
  'dia-naixement': { nom: 'Dia de Naixement',  href: id => `/carrega/${id}/expedicions/naixement` },
  estadistiques: { nom: 'Estadístiques',       href: id => `/carrega/${id}/estadistiques` },
  impressions:   { nom: 'Impressions',         href: id => `/carrega/${id}/imprimir` },
}

export default async function SelectorCarrega({ params }: { params: { seccio: string } }) {
  const seccio = SECCIONS[params.seccio]
  if (!seccio) notFound()

  const { data: fulls } = await supabase
    .from('fulls_carrega')
    .select('id, num_carrega, carrega, transferencia, estat')
    .neq('estat', 'Finalitzat')
    .order('carrega', { ascending: false })
    .limit(10)

  const carreguesActives = fulls ?? []

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 0.25rem' }}>
            {seccio.nom}
          </p>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            Tria una càrrega activa
          </h1>
        </div>

        {carreguesActives.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            No hi ha càrregues actives en aquest moment.
            <br />
            <Link href="/carrega" style={{ color: 'var(--accent)', textDecoration: 'none', marginTop: '0.75rem', display: 'inline-block', fontSize: '0.85rem' }}>
              Gestionar càrregues →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {carreguesActives.map(full => (
              <Link
                key={full.id}
                href={seccio.href(full.id)}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                  className="hover:border-accent"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>
                      #{full.num_carrega}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>
                        Càrrega {formatData(full.carrega)} ({diaSemana(full.carrega)})
                      </div>
                      {full.transferencia && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.1rem' }}>
                          Transferència: {formatData(full.transferencia)}
                        </div>
                      )}
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '1.2rem', color: 'var(--text-dim)' }}>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link href="/carrega" style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textDecoration: 'none', fontFamily: 'IBM Plex Mono' }}>
            ← Veure totes les càrregues
          </Link>
        </div>
      </div>
    </main>
  )
}
