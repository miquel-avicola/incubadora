'use client'

import { useMemo, useState } from 'react'

interface ResultatNaix {
  pollets_nascuts: number | null
  pollets_descartats: number | null
}

interface Transferencia {
  ous_fertils_vacunats: number | null
  resultats_naix: ResultatNaix[]
}

interface Assignacio {
  carros_estoc: { quantitat_ous: number } | null
  transferencies: Transferencia[]
}

interface Expedicio {
  pollets_servits: number | null
  pollets_comanda: number | null
  destinacions: { codi_rega: string | null } | null
}

interface Comanda {
  tipus: string
  expedicions: Expedicio[]
}

interface FullCarrega {
  carrega: string
  assignacions: Assignacio[]
  comandes: Comanda[]
}

export function EstadistiquesClient({ initialData }: { initialData: FullCarrega[] }) {
  const [mesSeleccionat, setMesSeleccionat] = useState<string>('')

  // Agrupar per mes (YYYY-MM)
  const dataPerMes = useMemo(() => {
    const map = new Map<string, FullCarrega[]>()
    initialData.forEach(full => {
      const mes = full.carrega.substring(0, 7) // "YYYY-MM"
      if (!map.has(mes)) map.set(mes, [])
      map.get(mes)!.push(full)
    })
    return map
  }, [initialData])

  const mesosOrdenats = Array.from(dataPerMes.keys()).sort((a, b) => b.localeCompare(a))
  const selectedMesStr = mesSeleccionat || mesosOrdenats[0] || ''
  const fulls = selectedMesStr ? dataPerMes.get(selectedMesStr) || [] : []

  // Calcular mètriques del mes
  let ousEntrats = 0
  let fertilitatSum = 0
  let eclosioSum = 0
  let naixementSum = 0
  let countFert = 0
  let countEclo = 0
  let countNaix = 0

  let ousClars = 0
  let polletsDescartats = 0
  let polletsNascuts = 0
  let polletsServits = 0
  let polletsCat = 0
  let polletsFora = 0

  fulls.forEach(f => {
    f.assignacions.forEach(a => {
      if (a.carros_estoc) {
        const ous = a.carros_estoc.quantitat_ous
        ousEntrats += ous

        let fertilsDelCarro = 0
        let nascutsDelCarro = 0
        let teFertilitat = false
        let teNascuts = false

        a.transferencies.forEach(t => {
          if (t.ous_fertils_vacunats !== null) {
            fertilsDelCarro += t.ous_fertils_vacunats
            ousClars += Math.max(0, ous - t.ous_fertils_vacunats)
            teFertilitat = true
          }
          t.resultats_naix.forEach(r => {
            if (r.pollets_nascuts !== null) {
              nascutsDelCarro += r.pollets_nascuts
              polletsNascuts += r.pollets_nascuts
              teNascuts = true
            }
            if (r.pollets_descartats !== null) {
              polletsDescartats += r.pollets_descartats
            }
          })
        })

        if (teFertilitat && ous > 0) {
          fertilitatSum += fertilsDelCarro / ous
          countFert++
        }
        if (teNascuts && teFertilitat && fertilsDelCarro > 0) {
          eclosioSum += nascutsDelCarro / fertilsDelCarro
          countEclo++
        }
        if (teNascuts && ous > 0) {
          naixementSum += nascutsDelCarro / ous
          countNaix++
        }
      }
    })

    f.comandes.filter(c => c.tipus === 'Pollets').forEach(c => {
      c.expedicions.forEach(e => {
        const servits = e.pollets_servits ?? e.pollets_comanda ?? 0
        polletsServits += servits
        const rega = e.destinacions?.codi_rega || ''
        const isCat = rega.startsWith('ES08') || rega.startsWith('ES17') || rega.startsWith('ES25') || rega.startsWith('ES43')
        if (isCat) {
          polletsCat += servits
        } else {
          polletsFora += servits
        }
      })
    })
  })

  const avgFert = countFert > 0 ? fertilitatSum / countFert : 0
  const avgEclo = countEclo > 0 ? eclosioSum / countEclo : 0
  const avgNaix = countNaix > 0 ? naixementSum / countNaix : 0

  const totalCatFora = polletsCat + polletsFora
  const pctCat = totalCatFora > 0 ? polletsCat / totalCatFora : 0
  const pctFora = totalCatFora > 0 ? polletsFora / totalCatFora : 0
  const sobrants = polletsNascuts - polletsServits

  const formatPct = (val: number) => (val * 100).toFixed(1) + '%'
  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }
  const valStyle = { fontSize: '1.5rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--text)' }
  const labelStyle = { fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Estadístiques</h1>
            <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Rendiment d'incubació i comercialització</p>
          </div>
          <select 
            value={selectedMesStr} 
            onChange={e => setMesSeleccionat(e.target.value)}
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'IBM Plex Sans', outline: 'none' }}
          >
            {mesosOrdenats.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {mesosOrdenats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>No hi ha dades suficients.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            
            <div style={cardStyle}>
              <div style={labelStyle}>Ous Entrats</div>
              <div style={valStyle}>{ousEntrats.toLocaleString()}</div>
            </div>
            
            <div style={cardStyle}>
              <div style={labelStyle}>Fertilitat Mitjana</div>
              <div style={{ ...valStyle, color: 'var(--accent)' }}>{formatPct(avgFert)}</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Eclosió Mitjana</div>
              <div style={{ ...valStyle, color: 'var(--accent)' }}>{formatPct(avgEclo)}</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Naixement Mitjà</div>
              <div style={{ ...valStyle, color: 'var(--success)' }}>{formatPct(avgNaix)}</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Ous Clars</div>
              <div style={valStyle}>{ousClars.toLocaleString()}</div>
            </div>

            <div style={cardStyle}>
              <div style={labelStyle}>Pollets Descartats</div>
              <div style={{ ...valStyle, color: 'var(--danger)' }}>{polletsDescartats.toLocaleString()}</div>
            </div>

            <div style={{ ...cardStyle, gridColumn: '1 / -1', display: 'flex', gap: '2rem' }}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Pollets Nascuts</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--success)' }}>{polletsNascuts.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Pollets Servits</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--text)' }}>{polletsServits.toLocaleString()}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>Sobrants</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: sobrants > 0 ? 'var(--accent)' : sobrants < 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                  {sobrants.toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
              <div style={{ ...labelStyle, marginBottom: '1rem' }}>Destinacions (Catalunya vs Fora)</div>
              <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ width: formatPct(pctCat), background: 'var(--accent)', transition: 'width 0.3s' }}></div>
                <div style={{ width: formatPct(pctFora), background: 'var(--border)', transition: 'width 0.3s' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Catalunya</span> {formatPct(pctCat)} ({polletsCat.toLocaleString()})
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>Fora</span> {formatPct(pctFora)} ({polletsFora.toLocaleString()})
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  )
}
