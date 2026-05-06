'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface ResultatNaix {
  id: number
  pollets_nascuts: number
  sexat: boolean
}

interface Transferencia {
  id: number
  ous_fertils_vacunats: number
  naixedores: { numero: number }
  resultats_naix: ResultatNaix[]
}

interface Assignacio {
  id: number
  num_carro_full: number
  carros_estoc: {
    id: number
    quantitat_ous: number
    lots_reproductores: {
      id: number
      estirp: string | null
      granges_reproductores: { granja: string; nom_informal: string | null }
    }
  }
  incubadores: { numero: number }
  transferencies: Transferencia[]
}

interface Full {
  id: number
  num_carrega: number
  assignacions: Assignacio[]
}

export default function Naixement() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [loading, setLoading] = useState(true)
  const [seleccionats, setSeleccionats] = useState<number[]>([])
  const [totalPollets, setTotalPollets] = useState('')
  const [sexat, setSexat] = useState(false)
  const [guardant, setGuardant] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const fullRes = await fetch(`/api/carrega/${params.id}`).then(r => r.json())
    setFull(fullRes)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  function toggleSeleccio(assignacioId: number) {
    setSeleccionats(prev =>
      prev.includes(assignacioId) ? prev.filter(x => x !== assignacioId) : [...prev, assignacioId]
    )
  }

  function seleccionarLot(assignacions: Assignacio[]) {
    const ids = assignacions.map(a => a.id)
    const totesSeleccionades = ids.every(id => seleccionats.includes(id))
    if (totesSeleccionades) {
      setSeleccionats(prev => prev.filter(id => !ids.includes(id)))
    } else {
      setSeleccionats(prev => Array.from(new Set([...prev, ...ids])))
    }
  }

  async function guardarNaixement() {
    if (!full || seleccionats.length === 0 || totalPollets === '') return
    setGuardant(true)
    setErrorMsg('')

    const assignacionsSeleccionades = full.assignacions.filter(a =>
      seleccionats.includes(a.id) && a.transferencies.length > 0
    )

    const carros = assignacionsSeleccionades.map(a => ({
      transferencia_id: a.transferencies[0].id,
      ous_fertils_vacunats: a.transferencies[0].ous_fertils_vacunats,
    }))

    const res = await fetch(`/api/carrega/${params.id}/naixement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carros,
        total_pollets: parseInt(totalPollets),
        sexat,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error || 'Error desconegut')
    } else {
      setSeleccionats([])
      setTotalPollets('')
      setSexat(false)
      carregarDades()
    }
    setGuardant(false)
  }

  async function eliminarNaixement(assignacions: Assignacio[]) {
    const transferencia_ids = assignacions
      .filter(a => a.transferencies.length > 0)
      .map(a => a.transferencies[0].id)

    await fetch(`/api/carrega/${params.id}/naixement`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transferencia_ids }),
    })
    carregarDades()
  }

  if (loading || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  // Agrupar assignacions per lot
  const perLot: Record<number, Assignacio[]> = {}
  full.assignacions.forEach(a => {
    const lotId = a.carros_estoc.lots_reproductores.id
    if (!perLot[lotId]) perLot[lotId] = []
    perLot[lotId].push(a)
  })

  const lotsOrdenats = Object.entries(perLot).map(([lotId, assignacions]) => ({
    lotId: parseInt(lotId),
    assignacions: assignacions.sort((a, b) => a.num_carro_full - b.num_carro_full),
    granja: assignacions[0].carros_estoc.lots_reproductores.granges_reproductores.nom_informal ||
      assignacions[0].carros_estoc.lots_reproductores.granges_reproductores.granja,
    estirp: assignacions[0].carros_estoc.lots_reproductores.estirp,
  }))

  const assignacionsSeleccionades = full.assignacions.filter(a => seleccionats.includes(a.id))
  const totalOusFertilsSeleccionats = assignacionsSeleccionades
    .filter(a => a.transferencies.length > 0)
    .reduce((s, a) => s + a.transferencies[0].ous_fertils_vacunats, 0)

  const registrats = full.assignacions.filter(a =>
    a.transferencies.length > 0 && a.transferencies[0].resultats_naix.length > 0
  ).length
  const transferits = full.assignacions.filter(a => a.transferencies.length > 0).length

  const inputStyle = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '0.6rem 0.75rem', color: 'var(--text)', fontSize: '0.9rem',
    outline: 'none', fontFamily: 'IBM Plex Sans', width: '100%',
  }
  const labelStyle = {
    display: 'block' as const, fontSize: '0.7rem', fontFamily: 'IBM Plex Mono',
    color: 'var(--text-dim)', textTransform: 'uppercase' as const,
    letterSpacing: '0.1em', marginBottom: '0.4rem',
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <Link href={`/carrega/${full.id}`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrrega #{full.num_carrega}</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Naixement</p>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Registrar naixement</h1>
          </div>
        </div>

        {/* Progrés */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text-dim)' }}>Carros registrats</span>
            <span style={{ color: registrats === transferits ? 'var(--success)' : 'var(--accent)' }}>{registrats} / {transferits}</span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: '4px', height: '6px' }}>
            <div style={{ background: registrats === transferits ? 'var(--success)' : 'var(--accent)', borderRadius: '4px', height: '6px', width: `${transferits > 0 ? (registrats / transferits) * 100 : 0}%`, transition: 'width 0.3s' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>

          {/* Columna esquerra: lots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {lotsOrdenats.map(({ lotId, assignacions, granja, estirp }) => {
              const totRegistrats = assignacions.filter(a =>
                a.transferencies.length > 0 && a.transferencies[0].resultats_naix.length > 0
              ).length
              const totTransferits = assignacions.filter(a => a.transferencies.length > 0).length
              const totSeleccionats = assignacions.filter(a => seleccionats.includes(a.id)).length

              return (
                <div key={lotId} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{granja}{estirp ? ` ${estirp}` : ''}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                        {totRegistrats}/{totTransferits} registrats
                      </div>
                    </div>
                    <button onClick={() => seleccionarLot(assignacions.filter(a => a.transferencies.length > 0))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono' }}>
                      {assignacions.filter(a => a.transferencies.length > 0).every(a => seleccionats.includes(a.id)) ? 'Cap' : 'Tots'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {assignacions.map(a => {
                      if (a.transferencies.length === 0) return null
                      const t = a.transferencies[0]
                      const registrat = t.resultats_naix.length > 0
                      const seleccionat = seleccionats.includes(a.id)
                      return (
                        <button key={a.id} onClick={() => !registrat && toggleSeleccio(a.id)} style={{
                          padding: '0.4rem 0.6rem', border: '1px solid',
                          borderColor: seleccionat ? 'var(--accent)' : registrat ? 'var(--success)' : 'var(--border)',
                          borderRadius: '6px', textAlign: 'left', cursor: registrat ? 'default' : 'pointer',
                          background: seleccionat ? 'rgba(240,180,41,0.1)' : registrat ? 'rgba(34,197,94,0.05)' : 'var(--bg)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', color: seleccionat ? 'var(--accent)' : 'var(--text-dim)' }}>
                            C{a.num_carro_full} · Naix.{t.naixedores.numero}
                          </span>
                          {registrat ? (
                            <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontFamily: 'IBM Plex Mono' }}>
                              {t.resultats_naix[0].pollets_nascuts.toLocaleString()} {t.resultats_naix[0].sexat ? '· sexat' : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                              {t.ous_fertils_vacunats.toLocaleString()} fèrtils
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Columna dreta: panell registre */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {seleccionats.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {seleccionats.length} carro{seleccionats.length !== 1 ? 's' : ''} seleccionat{seleccionats.length !== 1 ? 's' : ''}
                </div>

                {totalOusFertilsSeleccionats > 0 && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                    Total ous fèrtils: {totalOusFertilsSeleccionats.toLocaleString()}
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Total pollets nascuts</label>
                  <input type="number" value={totalPollets} onChange={e => setTotalPollets(e.target.value)}
                    min="0" max={totalOusFertilsSeleccionats || undefined} placeholder="35000"
                    style={{ ...inputStyle, borderColor: totalPollets !== '' && parseInt(totalPollets) > totalOusFertilsSeleccionats ? 'var(--danger)' : undefined }} />
                  {totalPollets !== '' && parseInt(totalPollets) > totalOusFertilsSeleccionats && totalOusFertilsSeleccionats > 0 && (
                    <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', fontFamily: 'IBM Plex Mono', color: 'var(--danger)' }}>
                      Màxim: {totalOusFertilsSeleccionats.toLocaleString()} (total ous fèrtils)
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input type="checkbox" id="sexat" checked={sexat} onChange={e => setSexat(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }} />
                  <label htmlFor="sexat" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Sexat</label>
                </div>

                {totalPollets && totalOusFertilsSeleccionats > 0 && (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
                    Previsió per carro:
                    {assignacionsSeleccionades.filter(a => a.transferencies.length > 0).map(a => (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                        <span>C{a.num_carro_full}</span>
                        <span style={{ color: 'var(--text)' }}>
                          {Math.round(parseInt(totalPollets) * (a.transferencies[0].ous_fertils_vacunats / totalOusFertilsSeleccionats)).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {errorMsg && (
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', background: 'rgba(240,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem' }}>
                    {errorMsg}
                  </div>
                )}

                <button onClick={guardarNaixement}
                  disabled={totalPollets === '' || guardant || (totalOusFertilsSeleccionats > 0 && parseInt(totalPollets) > totalOusFertilsSeleccionats)}
                  style={{
                    padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                    fontFamily: 'IBM Plex Sans', fontSize: '0.9rem', cursor: 'pointer',
                    background: (totalPollets === '' || guardant || (totalOusFertilsSeleccionats > 0 && parseInt(totalPollets) > totalOusFertilsSeleccionats)) ? 'var(--border)' : 'var(--accent)',
                    color: (totalPollets === '' || guardant || (totalOusFertilsSeleccionats > 0 && parseInt(totalPollets) > totalOusFertilsSeleccionats)) ? 'var(--text-dim)' : '#0f1117',
                  }}>
                  {guardant ? 'Guardant...' : 'Confirmar naixement'}
                </button>
              </div>
            )}

            {/* Resum per lot */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                Resum naixement
              </div>
              {lotsOrdenats.map(({ lotId, assignacions, granja, estirp }) => {
                const polletsTotals = assignacions
                  .filter(a => a.transferencies.length > 0 && a.transferencies[0].resultats_naix.length > 0)
                  .reduce((s, a) => s + a.transferencies[0].resultats_naix[0].pollets_nascuts, 0)
                const ousTotals = assignacions
  .filter(a => a.transferencies.length > 0)
  .reduce((s, a) => s + a.carros_estoc.quantitat_ous, 0)
const percentatge = ousTotals > 0 ? Math.round((polletsTotals / ousTotals) * 100) : 0

                if (polletsTotals === 0) return null
                return (
                  <div key={lotId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                    <span>{granja}{estirp ? ` ${estirp}` : ''}</span>
                    <div style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono' }}>
                      <div style={{ color: 'var(--text)' }}>{polletsTotals.toLocaleString()} pollets</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{percentatge}% naix.</div>
                    </div>
                  </div>
                )
              })}
              {registrats === 0 && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', margin: 0 }}>Sense registres</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
