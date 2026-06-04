import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { YearSelector } from './YearSelector'

export const dynamic = 'force-dynamic'

// Resum anual per cohort (data de càrrega).
const MESOS = ['Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des']

const fmt = (n: number) => (n ?? 0).toLocaleString('ca-ES')
const pct = (num: number, den: number): number | null => (den ? Math.round((num / den) * 1000) / 10 : null)
const fmtPct = (v: number | null) => (v == null ? '—' : v.toFixed(1) + '%')

interface MesAcum { ous: number; pollets: number }
interface LotAcum {
  nom: string
  ous: number
  pollets: number
  ousComplet: number      // ous de càrregues amb naixement registrat (per als %)
  fertilsComplet: number
  perMes: MesAcum[]
}
interface MaquinaAcum {
  numero: number
  model: string | null
  ous: number
  pollets: number
  ousComplet: number
  fertilsComplet: number
}

async function fetchAllAssignacions(fullIds: number[]) {
  const PAGE = 1000
  const all: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('assignacions')
      .select(`
        full_carrega_id,
        carros_estoc ( quantitat_ous,
          lots_reproductores ( id, estirp,
            granges_reproductores ( granja, nom_informal )
          )
        ),
        incubadores ( numero, model ),
        transferencies ( ous_fertils_vacunats, resultats_naix ( pollets_nascuts ) )
      `)
      .in('full_carrega_id', fullIds)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}

async function getAnysDisponibles(): Promise<number[]> {
  const [{ data: min }, { data: max }] = await Promise.all([
    supabase.from('fulls_carrega').select('carrega').not('carrega', 'is', null).order('carrega', { ascending: true }).limit(1),
    supabase.from('fulls_carrega').select('carrega').not('carrega', 'is', null).order('carrega', { ascending: false }).limit(1),
  ])
  const minY = min?.[0]?.carrega ? Number(min[0].carrega.slice(0, 4)) : null
  const maxY = max?.[0]?.carrega ? Number(max[0].carrega.slice(0, 4)) : null
  if (minY == null || maxY == null) return []
  const anys: number[] = []
  for (let y = maxY; y >= minY; y--) anys.push(y)
  return anys
}

async function getDadesAnual(any: number) {
  const { data: fulls } = await supabase
    .from('fulls_carrega')
    .select('id, carrega')
    .gte('carrega', `${any}-01-01`)
    .lte('carrega', `${any}-12-31`)

  const fullsList = fulls ?? []
  const mesPerFull = new Map<number, number>(
    fullsList.filter(f => f.carrega).map(f => [f.id, Number(f.carrega.slice(5, 7))])
  )
  const fullIds = fullsList.map(f => f.id)

  const buidaMes = (): MesAcum[] => Array.from({ length: 12 }, () => ({ ous: 0, pollets: 0 }))

  const perMes = buidaMes()
  const perLot: Record<number, LotAcum> = {}
  const perMaquina: Record<number, MaquinaAcum> = {}
  let gOus = 0, gPollets = 0, gOusComplet = 0, gFertilsComplet = 0

  if (fullIds.length > 0) {
    const assignacions = await fetchAllAssignacions(fullIds)

    for (const a of assignacions) {
      const carro = a.carros_estoc
      if (!carro) continue
      const lot = carro.lots_reproductores
      const inc = a.incubadores
      const t = a.transferencies?.[0]
      const resultat = t?.resultats_naix?.[0]
      const teResultat = resultat != null

      const ous = carro.quantitat_ous || 0
      const fertils = t?.ous_fertils_vacunats || 0
      const pollets = resultat?.pollets_nascuts || 0
      const mes = mesPerFull.get(a.full_carrega_id) // 1-12

      gOus += ous; gPollets += pollets
      if (teResultat) { gOusComplet += ous; gFertilsComplet += fertils }
      if (mes) { perMes[mes - 1].ous += ous; perMes[mes - 1].pollets += pollets }

      if (lot) {
        const granja = lot.granges_reproductores?.nom_informal || lot.granges_reproductores?.granja || 'Sense granja'
        const nom = `${granja}${lot.estirp ? ' ' + lot.estirp : ''}`
        if (!perLot[lot.id]) perLot[lot.id] = { nom, ous: 0, pollets: 0, ousComplet: 0, fertilsComplet: 0, perMes: buidaMes() }
        const L = perLot[lot.id]
        L.ous += ous; L.pollets += pollets
        if (teResultat) { L.ousComplet += ous; L.fertilsComplet += fertils }
        if (mes) { L.perMes[mes - 1].ous += ous; L.perMes[mes - 1].pollets += pollets }
      }

      if (inc?.numero != null) {
        if (!perMaquina[inc.numero]) perMaquina[inc.numero] = { numero: inc.numero, model: inc.model ?? null, ous: 0, pollets: 0, ousComplet: 0, fertilsComplet: 0 }
        const M = perMaquina[inc.numero]
        M.ous += ous; M.pollets += pollets
        if (teResultat) { M.ousComplet += ous; M.fertilsComplet += fertils }
      }
    }
  }

  return {
    numCarregues: fullIds.length,
    resum: {
      ous: gOus,
      pollets: gPollets,
      fertilitat: pct(gFertilsComplet, gOusComplet),
      naixement: pct(gPollets, gOusComplet),
    },
    perMes,
    perMaquina: Object.values(perMaquina).sort((a, b) => a.numero - b.numero),
    perLot: Object.values(perLot).sort((a, b) => a.nom.localeCompare(b.nom)),
  }
}

// ---- Estils reutilitzats (coherents amb la pàgina Mensual) ----------------
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' } as const
const label = { fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const bigVal = { fontSize: '2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono' }
const th = { textAlign: 'right' as const, padding: '0.5rem 0.75rem', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }
const thL = { ...th, textAlign: 'left' as const }
const td = { textAlign: 'right' as const, padding: '0.5rem 0.75rem', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }
const tdL = { ...td, textAlign: 'left' as const, fontFamily: 'IBM Plex Sans' }

export default async function EstadistiquesAnualPage({ searchParams }: { searchParams: { any?: string } }) {
  const anysDisponibles = await getAnysDisponibles()
  const anyDefecte = anysDisponibles[0] ?? new Date().getFullYear()
  const any = searchParams.any ? Number(searchParams.any) : anyDefecte

  const dades = await getDadesAnual(any)
  const teDades = dades.numCarregues > 0

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <Link href="/estadistiques" style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Estadístiques
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 0.25rem' }}>
              Estadístiques · Anual
            </p>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Resum {any}</h1>
            <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {dades.numCarregues} càrregues · per data de càrrega · % sobre càrregues amb naixement registrat
            </p>
          </div>
          <YearSelector any={any} anysDisponibles={anysDisponibles} />
        </div>

        {!teDades ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
            No hi ha càrregues registrades l&apos;any {any}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Resum global */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={card}>
                <div style={label}>Ous totals entrats</div>
                <div style={{ ...bigVal, color: 'var(--text)' }}>{fmt(dades.resum.ous)}</div>
              </div>
              <div style={card}>
                <div style={label}>Pollets nascuts</div>
                <div style={{ ...bigVal, color: 'var(--success)' }}>{fmt(dades.resum.pollets)}</div>
              </div>
              <div style={card}>
                <div style={label}>Fertilitat mitjana</div>
                <div style={{ ...bigVal, color: 'var(--accent)' }}>{fmtPct(dades.resum.fertilitat)}</div>
              </div>
              <div style={card}>
                <div style={label}>Naixement mitjà</div>
                <div style={{ ...bigVal, color: 'var(--accent)' }}>{fmtPct(dades.resum.naixement)}</div>
              </div>
            </div>

            {/* Per mes */}
            <section style={card}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem' }}>Per mesos</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th style={thL}>Mes</th><th style={th}>Ous entrats</th><th style={th}>Pollets nascuts</th></tr>
                  </thead>
                  <tbody>
                    {dades.perMes.map((m, i) => (
                      <tr key={i} style={{ opacity: m.ous === 0 && m.pollets === 0 ? 0.4 : 1 }}>
                        <td style={tdL}>{MESOS[i]}</td>
                        <td style={td}>{fmt(m.ous)}</td>
                        <td style={td}>{fmt(m.pollets)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td style={tdL}>Total</td>
                      <td style={td}>{fmt(dades.resum.ous)}</td>
                      <td style={td}>{fmt(dades.resum.pollets)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Per màquina */}
            <section style={card}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem' }}>Per màquina (incubadora)</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={thL}>Màquina</th><th style={th}>Ous</th>
                      <th style={th}>Pollets</th><th style={th}>Fertilitat</th><th style={th}>Naixement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dades.perMaquina.map((m) => (
                      <tr key={m.numero}>
                        <td style={tdL}>#{m.numero}{m.model ? ` · ${m.model}` : ''}</td>
                        <td style={td}>{fmt(m.ous)}</td>
                        <td style={td}>{fmt(m.pollets)}</td>
                        <td style={{ ...td, color: 'var(--accent)' }}>{fmtPct(pct(m.fertilsComplet, m.ousComplet))}</td>
                        <td style={{ ...td, color: 'var(--accent)' }}>{fmtPct(pct(m.pollets, m.ousComplet))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Per lot (total + desglossament mensual) */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Per lot</h2>
              {dades.perLot.map((l, idx) => {
                const mesosAmbDades = l.perMes
                  .map((m, i) => ({ ...m, i }))
                  .filter(m => m.ous > 0 || m.pollets > 0)
                return (
                  <div key={idx} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 700 }}>{l.nom}</div>
                      <div style={{ display: 'flex', gap: '1.25rem', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-dim)' }}>Ous <strong style={{ color: 'var(--text)' }}>{fmt(l.ous)}</strong></span>
                        <span style={{ color: 'var(--text-dim)' }}>Pollets <strong style={{ color: 'var(--success)' }}>{fmt(l.pollets)}</strong></span>
                        <span style={{ color: 'var(--text-dim)' }}>Fert. <strong style={{ color: 'var(--accent)' }}>{fmtPct(pct(l.fertilsComplet, l.ousComplet))}</strong></span>
                        <span style={{ color: 'var(--text-dim)' }}>Naix. <strong style={{ color: 'var(--accent)' }}>{fmtPct(pct(l.pollets, l.ousComplet))}</strong></span>
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr><th style={thL}>Mes</th><th style={th}>Ous</th><th style={th}>Pollets</th></tr>
                        </thead>
                        <tbody>
                          {mesosAmbDades.map((m) => (
                            <tr key={m.i}>
                              <td style={tdL}>{MESOS[m.i]}</td>
                              <td style={td}>{fmt(m.ous)}</td>
                              <td style={td}>{fmt(m.pollets)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </section>

          </div>
        )}
      </div>
    </main>
  )
}
