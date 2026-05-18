import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySession(token) : null
  const role = session?.role ?? 'admin'

  const showLots = role === 'admin'
  const showCarrega = role === 'carregues' || role === 'admin'

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        <div style={{ marginBottom: '3rem' }}>
          <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Miquel Avícola
          </p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Sala d&apos;incubació
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <Link href="/estoc" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--accent)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f1117', marginBottom: '0.25rem' }}>Estoc de carros</div>
              <div style={{ fontSize: '0.85rem', color: '#3a2e00' }}>Consultar carros disponibles i registrar recepcions</div>
            </div>
          </Link>

          {showLots && (
            <Link href="/lots" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🐔</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.25rem' }}>Lots de reproductores</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Gestionar lots i granges</div>
              </div>
            </Link>
          )}

          {showCarrega && (
            <Link href="/carrega" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🗓️</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.25rem' }}>Càrregues</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Gestionar fulls de càrrega i assignacions</div>
              </div>
            </Link>
          )}

          {role === 'admin' && (
            <Link href="/previsio-comercial" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📅</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.25rem' }}>Previsió comercial</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Planificar pollets per client i estimar carros necessaris</div>
              </div>
            </Link>
          )}

          {showCarrega && (
            <Link href="/instalacions" style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🏭</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)', marginBottom: '0.25rem' }}>Instal·lacions</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Veure carros a cada incubadora i naixedora en temps real</div>
              </div>
            </Link>
          )}

        </div>
      </div>
    </main>
  )
}
