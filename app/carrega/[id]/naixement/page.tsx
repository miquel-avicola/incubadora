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
  incubadores: { numero: number; tipus: string }
  transferencies: Transferencia[]
}

interface Full {
  id: number
  num_carrega: number
  assignacions: Assignacio[]
}

interface Previsio {
  pollets_previstos: number
  pct_naixement_previst: number
  eclosio_esperada: number
  font: string
  n_registres: number
}

export default function Naixement() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [previsions, setPrevisions] = useState<Record<number, Previsio>>({})
  const [loading, setLoading] = useState(true)
  const [seleccionats, setSeleccionats] = useState<number[]>([])
  const [totalPollets, setTotalPollets] = useState('')
  const [sexat, setSexat] = useState(false)
  const [guardant, setGuardant] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const carregarPrevisions = useCallback(async (fullData: Full) => {
    const transferenciaIds: number[] = []
    for (const a of fullData.assignacions) {
      for (const t of a.transferencies) transferenciaIds.push(t.id)
    }
    if (transferenciaIds.length === 0) return

    const resultats = await Promise.all(
      transferenciaIds.map(id =>
        fetch(`/api/previsio-post-transferencia?transferencia_id=${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    )
    const map: Record<number, Previsio> = {}
    transferenciaIds.forEach((id, i) => {
      const r = resultats[i]
      if (r && !r.error) map[id] = r
    })
    setPrevisions(map)
  }, [])

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const fullRes = await fetch(`/api/carrega/${params.id}`).then(r => r.json())
    setFull(fullRes)
    setLoading(false)
    carregarPrevisions(fullRes)
  }, [params.id, carregarPrevisions])

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

  if (loading || !full) return (
    <main className="bg-bg min-h-screen p-6">
      <p className="text-text-dim font-mono text-center p-8">Carregant...</p>
    </main>
  )

  // Agrupar assignacions per lot
  const perLot: Record<number, Assignacio[]> = {}
  full.assignacions.forEach(a => {
    const lotId = a.carros_estoc.lots_reproductores.id
    if (!perLot[lotId]) perLot[lotId] = []
    perLot[lotId].push(a)
  })

  const lotsOrdenats = Object.entries(perLot).map(([lotId, assignacions]) => {
    const assignacionsLot = assignacions.sort((a, b) => a.num_carro_full - b.num_carro_full)
    
    // Càlculs pel Dashboard de cada lot (només considerem carros transferits)
    const transferits = assignacionsLot.filter(a => a.transferencies.length > 0)
    
    let totalOusIncubats = 0
    let totalOusFertils = 0
    let polletsReals = 0
    
    // Agrupar stats per tipus d'incubadora per no barrejar SS i MS
    const statsPerTipus: Record<string, { fertilsRegistrats: number, polletsReals: number }> = {}
    
    let polletsPrevistosPendents = 0
    let previsioInicialBaseTotal = 0

    transferits.forEach(a => {
      totalOusIncubats += a.carros_estoc.quantitat_ous
      const t = a.transferencies[0]
      totalOusFertils += t.ous_fertils_vacunats

      // Previsio línia base de l'algoritme (si encara no està carregada, fem un petit fallback)
      const p = previsions[t.id]
      if (p) previsioInicialBaseTotal += p.pollets_previstos
      else previsioInicialBaseTotal += t.ous_fertils_vacunats

      const tipusIncubadora = a.incubadores?.tipus || 'MS'
      if (!statsPerTipus[tipusIncubadora]) {
        statsPerTipus[tipusIncubadora] = { fertilsRegistrats: 0, polletsReals: 0 }
      }

      if (t.resultats_naix.length > 0) {
        polletsReals += t.resultats_naix[0].pollets_nascuts
        statsPerTipus[tipusIncubadora].polletsReals += t.resultats_naix[0].pollets_nascuts
        statsPerTipus[tipusIncubadora].fertilsRegistrats += t.ous_fertils_vacunats
      }
    })

    transferits.forEach(a => {
      const t = a.transferencies[0]
      if (t.resultats_naix.length === 0) {
        const tipusIncubadora = a.incubadores?.tipus || 'MS'
        const s = statsPerTipus[tipusIncubadora]
        const pctExitReal = s && s.fertilsRegistrats > 0 ? (s.polletsReals / s.fertilsRegistrats) : null

        if (pctExitReal !== null) {
          polletsPrevistosPendents += t.ous_fertils_vacunats * pctExitReal
        } else {
          // Previsio inicial basada en l'API transferència per aquest carro
          const p = previsions[t.id]
          if (p) {
            polletsPrevistosPendents += p.pollets_previstos
          } else {
            // Fallback
            polletsPrevistosPendents += t.ous_fertils_vacunats
          }
        }
      }
    })

    const previsioTotal = polletsReals + polletsPrevistosPendents
    const diferenciaPrevisio = Math.round(previsioTotal - previsioInicialBaseTotal)
    const pctFertilitat = totalOusIncubats > 0 ? (totalOusFertils / totalOusIncubats) * 100 : 0
    const pctPrevisioFinal = totalOusIncubats > 0 ? (previsioTotal / totalOusIncubats) * 100 : 0
    const teRegistrats = transferits.some(a => a.transferencies[0].resultats_naix.length > 0)

    return {
      lotId: parseInt(lotId),
      assignacions: assignacionsLot,
      granja: assignacionsLot[0].carros_estoc.lots_reproductores.granges_reproductores.nom_informal ||
        assignacionsLot[0].carros_estoc.lots_reproductores.granges_reproductores.granja,
      estirp: assignacionsLot[0].carros_estoc.lots_reproductores.estirp,
      stats: {
        totalOusIncubats,
        totalOusFertils,
        pctFertilitat,
        polletsReals,
        previsioTotal,
        pctPrevisioFinal,
        teRegistrats,
        diferenciaPrevisio
      }
    }
  })

  const assignacionsSeleccionades = full.assignacions.filter(a => seleccionats.includes(a.id))
  const totalOusFertilsSeleccionats = assignacionsSeleccionades
    .filter(a => a.transferencies.length > 0)
    .reduce((s, a) => s + a.transferencies[0].ous_fertils_vacunats, 0)

  const registrats = full.assignacions.filter(a =>
    a.transferencies.length > 0 && a.transferencies[0].resultats_naix.length > 0
  ).length
  const transferits = full.assignacions.filter(a => a.transferencies.length > 0).length

  const inputClasses = "bg-bg border border-border rounded-lg px-3 py-2 text-text text-sm outline-none w-full"
  const labelClasses = "block text-[11px] font-mono text-text-dim uppercase tracking-wider mb-1.5"

  return (
    <main className="bg-bg min-h-screen p-4 md:p-6 pb-[100px]">
      <div className="max-w-[1000px] mx-auto flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Link href={`/carrega/${full.id}`} className="text-text-dim hover:text-text text-sm font-mono transition-colors">
            ← Càrrega #{full.num_carrega}
          </Link>
          <div>
            <p className="text-accent font-mono text-[11px] tracking-[0.15em] uppercase m-0">Naixement</p>
            <h1 className="text-xl font-bold m-0 text-text">Registrar naixement</h1>
          </div>
        </div>

        {/* Dashboard Naixement */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-mono text-text-dim uppercase tracking-wider m-0">Resum i Previsió</h2>
            <div className="text-xs font-mono text-text-dim">
              Progés general: <span className={registrats === transferits ? 'text-success' : 'text-accent'}>{registrats} / {transferits}</span> carros
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {lotsOrdenats.map(({ lotId, granja, estirp, stats }) => {
              if (stats.totalOusIncubats === 0) return null
              return (
                <div key={lotId} className="bg-bg border border-border rounded-lg p-3">
                  <div className="text-sm font-bold text-text mb-1 truncate">{granja} {estirp ? `(${estirp})` : ''}</div>
                  
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[11px] font-mono text-text-dim">Fertilitat</span>
                    <span className="text-sm font-bold text-text">
                      {stats.pctFertilitat.toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-baseline pt-2 border-t border-border">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-mono text-text-dim flex items-center gap-1">
                        Previsió pollets
                        {stats.teRegistrats && <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" title="Basat en resultats reals per tipus de màquina"></span>}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg font-bold text-text">
                          {Math.round(stats.previsioTotal).toLocaleString()}
                        </span>
                        {stats.diferenciaPrevisio !== 0 && previsions && Object.keys(previsions).length > 0 && (
                          <span className={`text-[11px] font-mono font-bold ${stats.diferenciaPrevisio > 0 ? 'text-success' : 'text-danger'}`}>
                            {stats.diferenciaPrevisio > 0 ? '+' : ''}{stats.diferenciaPrevisio.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-bold font-mono ${stats.teRegistrats ? 'text-success' : 'text-accent'}`}>
                      {stats.pctPrevisioFinal.toFixed(1)}%
                    </span>
                  </div>
                  
                  {stats.polletsReals > 0 && (
                    <div className="text-[10px] font-mono text-text-dim mt-1.5 text-right">
                      Ja nascuts: <span className="text-text">{stats.polletsReals.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Llista i Panell Lateral */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

          {/* Columna esquerra: lots i carros */}
          <div className="flex flex-col gap-4">
            {lotsOrdenats.map(({ lotId, assignacions, granja, estirp }) => {
              const assignacionsAmbTransf = assignacions.filter(a => a.transferencies.length > 0)
              if (assignacionsAmbTransf.length === 0) return null
              
              const totRegistrats = assignacionsAmbTransf.filter(a => a.transferencies[0].resultats_naix.length > 0).length
              const totTransferits = assignacionsAmbTransf.length

              return (
                <div key={lotId} className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <div className="text-sm font-bold text-text">{granja}{estirp ? ` ${estirp}` : ''}</div>
                      <div className="text-[11px] text-text-dim font-mono">
                        {totRegistrats}/{totTransferits} registrats
                      </div>
                    </div>
                    <button 
                      onClick={() => seleccionarLot(assignacionsAmbTransf)}
                      className="bg-transparent border-none text-accent text-xs font-mono cursor-pointer hover:underline"
                    >
                      {assignacionsAmbTransf.every(a => seleccionats.includes(a.id)) ? 'Desmarcar' : 'Sel·leccionar tots'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {assignacionsAmbTransf.map(a => {
                      const t = a.transferencies[0]
                      const registrat = t.resultats_naix.length > 0
                      const seleccionat = seleccionats.includes(a.id)
                      
                      return (
                        <button 
                          key={a.id} 
                          onClick={() => !registrat && toggleSeleccio(a.id)} 
                          className={`
                            flex justify-between items-center px-3 py-2 border rounded-lg text-left transition-colors
                            ${registrat ? 'cursor-default bg-success/5 border-success/30' : 'cursor-pointer hover:bg-bg/80'}
                            ${seleccionat ? 'bg-accent/10 border-accent' : !registrat ? 'bg-bg border-border' : ''}
                          `}
                        >
                          <span className={`font-mono text-xs ${seleccionat ? 'text-accent font-bold' : 'text-text-dim'}`}>
                            C{a.num_carro_full} · Naix.{t.naixedores.numero}
                          </span>
                          {registrat ? (
                            <span className="text-[11px] text-success font-mono font-bold">
                              {t.resultats_naix[0].pollets_nascuts.toLocaleString()} {t.resultats_naix[0].sexat ? '· sexat' : ''}
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-dim font-mono">
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
          <div className="flex flex-col gap-4 sticky top-4">
            {seleccionats.length > 0 ? (
              <div className="bg-surface border border-accent rounded-xl p-4 flex flex-col gap-4 shadow-sm">
                <div className="text-[11px] font-mono text-text-dim uppercase tracking-wider">
                  {seleccionats.length} carro{seleccionats.length !== 1 ? 's' : ''} seleccionat{seleccionats.length !== 1 ? 's' : ''}
                </div>

                {totalOusFertilsSeleccionats > 0 && (
                  <div className="text-xs text-text-dim font-mono">
                    Total ous fèrtils: <span className="text-text font-bold">{totalOusFertilsSeleccionats.toLocaleString()}</span>
                  </div>
                )}

                <div>
                  <label className={labelClasses}>Total pollets nascuts</label>
                  <input 
                    type="number" 
                    value={totalPollets} 
                    onChange={e => setTotalPollets(e.target.value)}
                    min="0" 
                    step="1"
                    max={totalOusFertilsSeleccionats || undefined} 
                    placeholder="Ex: 35000"
                    className={`${inputClasses} ${totalPollets !== '' && parseInt(totalPollets) > totalOusFertilsSeleccionats ? 'border-danger' : ''}`} 
                  />
                  {totalPollets !== '' && parseInt(totalPollets) > totalOusFertilsSeleccionats && totalOusFertilsSeleccionats > 0 && (
                    <div className="mt-1 text-[11px] font-mono text-danger">
                      Màxim: {totalOusFertilsSeleccionats.toLocaleString()} (total ous fèrtils)
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="sexat" 
                    checked={sexat} 
                    onChange={e => setSexat(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-accent" 
                  />
                  <label htmlFor="sexat" className="text-sm text-text cursor-pointer select-none">L'expedició és sexada?</label>
                </div>

                {totalPollets && totalOusFertilsSeleccionats > 0 && (
                  <div className="bg-bg border border-border rounded-lg p-3 text-xs font-mono text-text-dim flex flex-col gap-1.5">
                    <div className="font-bold text-text mb-1">Repartiment automàtic previst:</div>
                    {assignacionsSeleccionades.filter(a => a.transferencies.length > 0).map(a => (
                      <div key={a.id} className="flex justify-between items-center">
                        <span>C{a.num_carro_full}</span>
                        <span className="text-text font-bold">
                          {Math.round(parseInt(totalPollets) * (a.transferencies[0].ous_fertils_vacunats / totalOusFertilsSeleccionats)).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {errorMsg && (
                  <div className="p-2.5 rounded-lg bg-danger/10 border border-danger text-danger font-mono text-xs">
                    {errorMsg}
                  </div>
                )}

                <button 
                  onClick={guardarNaixement}
                  disabled={totalPollets === '' || guardant || (totalOusFertilsSeleccionats > 0 && parseInt(totalPollets) > totalOusFertilsSeleccionats)}
                  className={`
                    p-3 border-none rounded-lg font-bold text-sm cursor-pointer transition-colors
                    ${(totalPollets === '' || guardant || (totalOusFertilsSeleccionats > 0 && parseInt(totalPollets) > totalOusFertilsSeleccionats)) 
                      ? 'bg-border text-text-dim cursor-not-allowed' 
                      : 'bg-accent text-[#0f1117] hover:bg-accent/90'}
                  `}
                >
                  {guardant ? 'Guardant...' : 'Confirmar naixement'}
                </button>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-xl p-6 text-center">
                <span className="text-2xl mb-2 block opacity-50">🐣</span>
                <p className="text-sm text-text-dim font-mono m-0">
                  Selecciona un o més carros per registrar el seu naixement.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
