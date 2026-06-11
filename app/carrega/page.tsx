import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LlistaCarregues } from './LlistaCarregues'

export const dynamic = 'force-dynamic'

const LLINDAR_DIES = 7

export default async function Carregues() {
  const [fullsRes, candidatsRes] = await Promise.all([
    supabase
      .from('fulls_carrega')
      .select(`
        id,
        num_carrega,
        carrega,
        transferencia,
        estat,
        comandes (
          id,
          tipus,
          quantitat_pollets,
          quantitat_ous_maquila,
          clients (nom)
        )
      `)
      .order('carrega', { ascending: false })
      .limit(20),
    supabase.rpc('fulls_candidats_finalitzar', { p_llindar_dies: LLINDAR_DIES }),
  ])

  const fulls = fullsRes.data ?? []
  const candidats = candidatsRes.data ?? []

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Inici</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Planificació</p>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Càrregues</h1>
            </div>
          </div>
          <Link href="/carrega/nova" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '0.6rem 1rem', background: 'var(--accent)', border: 'none',
              borderRadius: '8px', color: '#0f1117', fontWeight: 700, fontSize: '0.85rem',
              cursor: 'pointer', fontFamily: 'IBM Plex Sans',
            }}>
              + Nova càrrega
            </button>
          </Link>
        </div>

        <LlistaCarregues
          fullsInicial={fulls as any}
          candidatsInicial={candidats}
          llindarDies={LLINDAR_DIES}
        />
      </div>
    </main>
  )
}
