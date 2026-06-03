'use client'
import { useAssignacions } from './useAssignacions'
import { IndeterminateCheckbox, HeaderPlan, OrdreMSP, Safata, SeccioInc, IncubadoraSS, IncubadoraMS, IncubadoraMSP, Cell, MemoCell, btnStyle, cardSeccio, h2Seccio, badgeStyle, cardInc, btnSelLliures, chipNaix, miniBtn } from './components/AllComponents';



import { useState, useEffect, useCallback, useMemo, useRef, Fragment, memo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ZonaMS, SubTipus, Dia, Fase, CarroEstoc, Incubadora, AssignacioActual, Full, CarroInst, IncInst, EstatInst, ssPosToCell, MS_ZONES_ESQ, MS_ZONES_DRE, subtipus, diaDeFull, nomCarroCurt, keyCell, diesEstoc, setmanesLot, offsetPerDia, polletsCarro, projectarEstatInst } from '@/lib/assignacions'

// ─────────────────────────────────────────────────────────────────────────────
// Component principal
// ─────────────────────────────────────────────────────────────────────────────



export interface AssignacionsClientProps {
  initialFull: any;
  initialDisponibles: any[];
  initialIncs: any[];
  initialEstatInst: any;
}

export function AssignacionsClient({ initialFull, initialDisponibles, initialIncs, initialEstatInst }: AssignacionsClientProps) {

  const hook = useAssignacions({ initialFull, initialDisponibles, initialIncs, initialEstatInst })
  const {
    full, disponibles, incs, estatInst,
    loading, errorMsg, setErrorMsg, guardant, resultatGuardar, setResultatGuardar,
    colocats, setColocats,
    seleccionades, setSeleccionades,
    dia, setDia, mspOrdre, setMspOrdre,
    mostrarProjectat, setMostrarProjectat,
    incsFiltrades, setIncsFiltrades, toggleIncFiltrada,
    carrosSeleccionats, setCarrosSeleccionats,
    fase, setFase,
    incsById, carrosLot, carrosLotFiltrats, carrosPendents,
    ssPrincipalNum, numCarroPerCella, carroPerCella, hiHaMsColocats,
    estatInstProjectat, estatInstEffectiu,
    ocupatsAltresFullsPerCella, nCanvisProjeccio, lliureAviatPerCella,
    toggleSeleccio, seleccionarLliuresInc, netejarSeleccio, reiniciar,
    onDragStartCarro, onDragOverCell, onDropCell, onDropSafata, clicarCarroColocat, onDropMSPGeneral,
    carroSeleccionatTap, cellaQueueIndex, tapCarroSafata, onTapCella,
    guardar
  } = hook

  // ── Render
  if (loading || !full) {
    return (
      <main style={{ padding: '1.5rem' }}>
        <p style={{ color: '#6b7280', textAlign: 'center' }}>Carregant...</p>
      </main>
    )
  }

  // ── Fase 1: Selecció de carros ──────────────────────────────────────────
  if (fase === 'seleccio') {
    // Comanda de pollets (exclou maquila)
    const comandaPollets = full.comandes
      .filter(c => c.tipus !== 'maquila' && c.quantitat_pollets !== null && c.quantitat_pollets > 0)
      .reduce((s, c) => s + (c.quantitat_pollets ?? 0), 0)
    const comandaMaquila = full.comandes
      .filter(c => c.tipus === 'maquila' && c.quantitat_ous_maquila !== null && c.quantitat_ous_maquila > 0)
      .reduce((s, c) => s + (c.quantitat_ous_maquila ?? 0), 0)

    // Pollets estimats dels carros seleccionats
    const polletsSel = carrosLot
      .filter(c => carrosSeleccionats.has(c.id))
      .reduce((s, c) => s + polletsCarro(c), 0)

    // Agrupar carros per lot (lots_reproductores.id), ordenar lots per dies estoc DESC
    type GrupLot = {
      lotId: number
      granja: string
      estirp: string | null
      dataNaix: string
      setmanes: number
      carros: CarroEstoc[]
    }
    const grupsMap = new Map<number, GrupLot>()
    for (const c of carrosLot) {
      const lot = c.lots_reproductores
      if (!grupsMap.has(lot.id)) {
        grupsMap.set(lot.id, {
          lotId: lot.id,
          granja: lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja,
          estirp: lot.estirp,
          dataNaix: lot.data_naixement,
          setmanes: setmanesLot(lot.data_naixement),
          carros: [],
        })
      }
      grupsMap.get(lot.id)!.carros.push(c)
    }
    // Ordenar carros dins de cada lot per dies estoc DESC (posta més antiga primer)
    grupsMap.forEach(g => {
      g.carros.sort((a, b) => diesEstoc(a.posta, full.carrega) - diesEstoc(b.posta, full.carrega))
    })
    // Ordenar lots pel dies estoc màxim del primer carro de cada lot (DESC)
    const grups = Array.from(grupsMap.values()).sort((a, b) =>
      diesEstoc(a.carros[0].posta, full.carrega) - diesEstoc(b.carros[0].posta, full.carrega)
    )

    const toggleCarro = (id: number) => {
      setCarrosSeleccionats(prev => {
        const s = new Set(prev)
        if (s.has(id)) s.delete(id); else s.add(id)
        return s
      })
    }
    const toggleLot = (ids: number[]) => {
      const tots = ids.every(id => carrosSeleccionats.has(id))
      setCarrosSeleccionats(prev => {
        const s = new Set(prev)
        if (tots) ids.forEach(id => s.delete(id))
        else ids.forEach(id => s.add(id))
        return s
      })
    }
    const seleccionarTots = () => {
      setCarrosSeleccionats(new Set(carrosLot.map(c => c.id)))
    }

    const pctPollets = comandaPollets > 0 ? Math.round((polletsSel / comandaPollets) * 100) : null
    const colorPct = pctPollets === null ? '#6b7280'
      : pctPollets < 90 ? '#b45309'
      : pctPollets > 115 ? '#b45309'
      : '#15803d'

    return (
      <main className="bg-bg min-h-screen pb-20">
        {/* Capçalera */}
        <header className="bg-surface border-b border-border px-5 py-3 flex justify-between items-center gap-3 flex-wrap">
          <div>
            <h1 className="m-0 text-lg font-bold text-text">Adjudicació full #{full.num_carrega} — Pas 1: Selecció de carros</h1>
            <div className="text-text-dim text-sm">
              Càrrega <b className="text-text">{full.carrega}</b> · {carrosLot.length} carros en estoc
            </div>
          </div>
          <a href={`/carrega/${full.id}`} className="px-3.5 py-2 rounded-md border border-border bg-surface text-text font-medium text-sm no-underline hover:bg-bg transition-colors">← Tornar al full</a>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 px-5 py-4">

          {/* Columna esquerra: comanda + resum */}
          <aside className="flex flex-col gap-3">
            {/* Comanda */}
            <div className="bg-surface border border-border rounded-lg p-3.5 shadow-sm">
              <h3 className="m-0 mb-2.5 text-sm font-bold text-text">Comanda del client</h3>
              {comandaPollets > 0 && (
                <div className="text-[13px] mb-1.5 text-text-dim">
                  <span>Pollets: </span>
                  <b className="text-text">{comandaPollets.toLocaleString('ca')}</b>
                </div>
              )}
              {comandaMaquila > 0 && (
                <div className="text-[13px] mb-1.5 text-text-dim">
                  <span>Maquila (ous): </span>
                  <b className="text-text">{comandaMaquila.toLocaleString('ca')}</b>
                </div>
              )}
              {comandaPollets === 0 && comandaMaquila === 0 && (
                <div className="text-text-dim text-xs">Sense comanda registrada</div>
              )}
            </div>

            {/* Resum selecció */}
            <div className="bg-surface border border-border rounded-lg p-3.5 shadow-sm">
              <h3 className="m-0 mb-2.5 text-sm font-bold text-text">Selecció actual</h3>
              <div className="text-[13px] mb-1 text-text-dim">
                <span>Carros: </span>
                <b className="text-text">{carrosSeleccionats.size}</b>
              </div>
              {comandaPollets > 0 && (
                <div className="text-[13px] mb-1 text-text-dim">
                  <span>Pollets prev.: </span>
                  <b style={{ color: colorPct }}>{polletsSel.toLocaleString('ca')}</b>
                  {pctPollets !== null && (
                    <span className="text-[11px] ml-1 font-bold" style={{ color: colorPct }}>({pctPollets}%)</span>
                  )}
                </div>
              )}
              {comandaPollets > 0 && pctPollets !== null && pctPollets < 90 && (
                <div className="text-[11px] text-danger mt-1 font-bold">
                  ⚠ Per sota de la comanda
                </div>
              )}
              <div className="mt-2.5 flex flex-col gap-1.5">
                <button
                  onClick={seleccionarTots}
                  className="px-2.5 py-1.5 border border-border bg-bg text-text rounded text-xs cursor-pointer hover:bg-surface font-medium"
                >Seleccionar tots</button>
                <button
                  onClick={() => setCarrosSeleccionats(new Set())}
                  className="px-2.5 py-1.5 border border-border bg-bg text-text rounded text-xs cursor-pointer hover:bg-surface font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={carrosSeleccionats.size === 0}
                >Netejar selecció</button>
              </div>
            </div>
          </aside>

          {/* Columna dreta: llista de carros */}
          <div className="flex flex-col gap-3">
            {grups.length === 0 && (
              <div className="bg-surface border border-border rounded-lg p-6 text-center text-text-dim shadow-sm">
                No hi ha carros en estoc disponibles
              </div>
            )}
            {grups.map(g => {
              const idsLot = g.carros.map(c => c.id)
              const totsSel = idsLot.every(id => carrosSeleccionats.has(id))
              const algunSel = idsLot.some(id => carrosSeleccionats.has(id))
              return (
                <div key={g.lotId} className="bg-surface border border-border rounded-lg p-3.5 shadow-sm">
                  {/* Capçalera lot */}
                  <div className="flex justify-between items-center mb-2.5">
                    <div className="flex items-center gap-2">
                      <IndeterminateCheckbox
                        type="checkbox"
                        checked={totsSel}
                        indeterminate={algunSel && !totsSel}
                        onChange={() => toggleLot(idsLot)}
                        className="w-4 h-4 cursor-pointer accent-accent"
                      />
                      <div>
                        <span className="font-bold text-sm text-text">{g.granja}</span>
                        {g.estirp && <span className="text-text-dim text-xs ml-1.5">· {g.estirp}</span>}
                        <span className="text-text-dim text-[11px] ml-1.5 opacity-70">· {g.setmanes} setm. de vida</span>
                      </div>
                    </div>
                    <span className="text-xs text-text-dim font-bold">
                      {idsLot.filter(id => carrosSeleccionats.has(id)).length}/{g.carros.length} seleccionats
                    </span>
                  </div>

                  {/* Taula de carros */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="w-7 py-1 px-1.5 text-center"></th>
                          <th className="py-1 px-2 text-left text-text-dim font-medium">Data posta</th>
                          <th className="py-1 px-2 text-right text-text-dim font-medium">Dies estoc</th>
                          <th className="py-1 px-2 text-right text-text-dim font-medium">Ous</th>
                          <th className="py-1 px-2 text-right text-text-dim font-medium">Prev. pollets</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.carros.map((c, i) => {
                          const sel = carrosSeleccionats.has(c.id)
                          const dies = diesEstoc(c.posta, full.carrega)
                          const prev = polletsCarro(c)
                          return (
                            <tr
                              key={c.id}
                              onClick={() => toggleCarro(c.id)}
                              className={`cursor-pointer border-b border-border transition-colors ${sel ? 'bg-accent/10' : 'hover:bg-bg'}`}
                            >
                              <td className="py-1.5 px-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => toggleCarro(c.id)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-3.5 h-3.5 cursor-pointer accent-accent"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-text">{c.posta}</td>
                              <td className={`py-1.5 px-2 text-right ${dies > 10 ? 'text-danger font-bold' : 'text-text'}`}>
                                {dies}d
                              </td>
                              <td className="py-1.5 px-2 text-right text-text font-mono">{c.quantitat_ous.toLocaleString('ca')}</td>
                              <td className="py-1.5 px-2 text-right text-accent font-bold font-mono">
                                {prev.toLocaleString('ca')}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-5 py-2.5 flex justify-between items-center z-40 shadow-sm">
          <div className="text-[13px] text-text-dim">
            {carrosSeleccionats.size > 0
              ? <><b className="text-text">{carrosSeleccionats.size} carros</b> seleccionats · <b style={{ color: colorPct }}>{polletsSel.toLocaleString('ca')} pollets previstos</b>{comandaPollets > 0 && <> · comanda: {comandaPollets.toLocaleString('ca')}</>}</>
              : 'Cap carro seleccionat'
            }
          </div>
          <button
            onClick={() => {
              if (carrosSeleccionats.size === 0) {
                alert('Selecciona almenys un carro abans de continuar.')
                return
              }
              setFase('assignacio')
            }}
            className="px-4 py-2 bg-accent text-[#000] border-none rounded-md font-bold text-sm cursor-pointer hover:opacity-90"
          >
            Continuar amb l&apos;assignació →
          </button>
        </footer>
      </main>
    )
  }

  return (
    <main className="bg-bg min-h-screen pb-[150px]">
      <HeaderPlan full={full} dia={dia} setDia={setDia} pendents={carrosPendents.length} total={carrosSeleccionats.size} colocats={colocats.size} onTornarSeleccio={() => setFase('seleccio')} />

      {/* Toggle vista projectada */}
      {nCanvisProjeccio > 0 && (
        <div className={`px-5 py-1.5 flex items-center gap-2 border-b border-border ${mostrarProjectat ? 'bg-success/10' : 'bg-surface'}`}>
          <label className={`flex items-center gap-1.5 cursor-pointer text-xs font-bold select-none ${mostrarProjectat ? 'text-success' : 'text-text-dim'}`}>
            <input
              type="checkbox"
              checked={mostrarProjectat}
              onChange={e => setMostrarProjectat(e.target.checked)}
              className="w-3.5 h-3.5 accent-success cursor-pointer"
            />
            Mostra estat post-transferència (transferències + rotacions MSG aplicades)
          </label>
          {!mostrarProjectat && lliureAviatPerCella.size > 0 && (
            <span className="text-[11px] text-success font-medium">
              Els slots en verd s&apos;alliberaran abans de la càrrega
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_290px] gap-4 px-5 py-4">
        <main className="flex flex-col gap-5">
          {/* Singlestage */}
          <SeccioInc titol="Single Stage" badge="SS · cap 24"
            incs={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'SS')}
            children={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'SS').map(inc => (
              <IncubadoraSS key={inc.id} inc={inc}
                carrosLot={carrosLot}
                carroPerCella={carroPerCella}
                ocupatsAltresFulls={ocupatsAltresFullsPerCella}
                lliureAviatPerCella={lliureAviatPerCella}
                mostrarProjectat={mostrarProjectat}
                colocats={colocats}
                seleccionades={seleccionades}
                numCarroPerCella={numCarroPerCella}
                cellaQueueIndex={cellaQueueIndex}
                tapModeActive={carroSeleccionatTap !== null}
                filtrada={incsFiltrades.has(inc.id)}
                anyFiltrada={incsFiltrades.size > 0}
                onToggleFiltrada={() => toggleIncFiltrada(inc.id)}
                onClicCella={onTapCella}
                onSelLliures={seleccionarLliuresInc}
                onDragStartCarro={onDragStartCarro}
                onDragOverCell={onDragOverCell}
                onDropCell={onDropCell}
                onClicCarroColocat={clicarCarroColocat}
              />
            ))} />

          {/* MSG */}
          <SeccioInc titol="Multi Stage grans" badge="MS · cap 24 · 3 zones × 8 posicions"
            incs={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'MSG')}
            children={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'MSG').map(inc => (
              <IncubadoraMS key={inc.id} inc={inc} sub="MSG" carrosLot={carrosLot}
                carroPerCella={carroPerCella}
                ocupatsAltresFulls={ocupatsAltresFullsPerCella}
                lliureAviatPerCella={lliureAviatPerCella}
                mostrarProjectat={mostrarProjectat}
                colocats={colocats}
                seleccionades={seleccionades}
                numCarroPerCella={numCarroPerCella}
                cellaQueueIndex={cellaQueueIndex}
                tapModeActive={carroSeleccionatTap !== null}
                filtrada={incsFiltrades.has(inc.id)}
                anyFiltrada={incsFiltrades.size > 0}
                onToggleFiltrada={() => toggleIncFiltrada(inc.id)}
                onClicCella={onTapCella}
                onSelLliures={seleccionarLliuresInc}
                onDragStartCarro={onDragStartCarro}
                onDragOverCell={onDragOverCell}
                onDropCell={onDropCell}
                onClicCarroColocat={clicarCarroColocat}
              />
            ))} />

          {/* MSP */}
          <SeccioInc titol="Multi Stage petites" badge="MS · cap 12 · 3 zones × 4 posicions"
            incs={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'MSP')}
            extra={
              <OrdreMSP ordre={mspOrdre} onChange={setMspOrdre} />
            }
            children={incs.filter(i => subtipus(i.tipus, i.capacitat_carros) === 'MSP').map(inc => {
              const instInc = estatInstEffectiu?.incubadores.find((x: any) => x.id === inc.id);
              return (
              <IncubadoraMSP key={inc.id} inc={inc} instInc={instInc} carrosLot={carrosLot}
                colocats={colocats}
                numCarroPerCella={numCarroPerCella}
                onDropMSPGeneral={onDropMSPGeneral}
                onClicCarroColocat={clicarCarroColocat}
                onDragStartCarro={onDragStartCarro}
                onDragOverCell={onDragOverCell}
              />
              );
            })} />

          {/* Naixedores només lectura */}
          {estatInst && estatInst.naixedores.length > 0 && (
            <section className="bg-surface border border-border rounded-xl p-3.5 shadow-sm">
              <h2 className="m-0 mb-3 text-[15px] flex gap-2 items-center text-text">Naixedores <span className="bg-bg border border-border px-2 py-0.5 rounded-full text-[11px] font-medium text-text-dim">només informatives</span></h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {estatInst.naixedores.map(n => (
                  <div key={n.id} className="border border-border rounded-lg p-2 bg-bg">
                    <div className="text-[13px] font-bold mb-1.5 text-text">Naix {n.numero} <span className="text-text-dim text-[11px] font-normal">{n.carros.length}/{n.capacitat}</span></div>
                    <div className="flex flex-col gap-1 min-h-[60px]">
                      {n.carros.length === 0
                        ? <div className="text-text-dim text-[11px] text-center p-2 opacity-50">buida</div>
                        : n.carros.map((c, i) => <div key={i} className="bg-border text-text px-1.5 py-1 rounded text-[11px] font-mono">#{c.num_carro_full}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="bg-surface border border-border rounded-lg p-3 self-start sticky top-4 max-h-[calc(100vh-32px)] overflow-y-auto"
               onDragOver={onDragOverCell}
               onDrop={onDropSafata}>
          <h3 className="m-0 mb-2 text-sm text-text">Carros a col·locar</h3>
          <div className="text-text-dim text-xs mb-2.5">
            {carrosPendents.length} pendents · {colocats.size} col·locats
          </div>
          <Safata
            pendents={carrosPendents}
            onDragStartCarro={onDragStartCarro}
            full={full}
            carroSeleccionatTap={carroSeleccionatTap}
            onTapCarro={tapCarroSafata}
          />
          <div className="mt-3 p-2 bg-bg rounded-md text-[11px] text-text-dim leading-snug">
            <b>Ordinador:</b> arrossega carros a les cel·les.<br />
            <b>Mòbil/Tablet:</b><br />
            A) Tap carro → tap cel·la (auto-avança)<br />
            B) Marca cel·les (①②③) → tap carros per omplir per ordre<br />
            Tap carro col·locat per treure&apos;l.
          </div>
        </aside>
      </div>

      {/* Errors i resultats */}
      {(errorMsg || resultatGuardar) && (
        <div className="fixed bottom-16 left-5 right-5 z-50">
          {errorMsg && (
            <div className="bg-danger/10 border border-danger text-danger p-2.5 rounded-md whitespace-pre-wrap text-[13px] mb-1.5 shadow-sm">
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="float-right bg-transparent border-none cursor-pointer text-danger text-base hover:opacity-70">×</button>
            </div>
          )}
          {resultatGuardar && (
            <div className="bg-success/10 border border-success text-success p-2.5 rounded-md text-[13px] shadow-sm">
              {resultatGuardar}
              <button onClick={() => setResultatGuardar('')} className="float-right bg-transparent border-none cursor-pointer text-success text-base hover:opacity-70">×</button>
            </div>
          )}
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-5 py-2.5 flex justify-between items-center shadow-sm z-40 overflow-x-auto">
        <div className="text-[13px] text-text-dim flex items-center gap-2 whitespace-nowrap">
          {carrosPendents.length > 0 && <>Queden <b className="text-text">{carrosPendents.length}</b> carros sense ubicar</>}
          {carrosPendents.length === 0 && colocats.size > 0 && <>Tots els carros estan col·locats ({colocats.size})</>}
          {' · '}<span>{seleccionades.size} cel·les seleccionades</span>
          {incsFiltrades.size > 0 && (
            <span className="inline-flex items-center gap-1 bg-accent/20 text-accent rounded px-2 py-0.5 text-xs font-bold">
              ✓ {incsFiltrades.size} inc. seleccionades
              <button onClick={() => setIncsFiltrades(new Set())} className="bg-transparent border-none cursor-pointer text-accent text-sm px-0.5 leading-none hover:opacity-70" title="Esborra filtre">×</button>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/carrega/${full.id}`} className="btn-secondary no-underline mr-2 whitespace-nowrap">Tornar al full</Link>
          <button onClick={netejarSeleccio} className="btn-secondary whitespace-nowrap">Netejar selecció</button>
          <button onClick={reiniciar} className="btn-secondary whitespace-nowrap">Reiniciar</button>
          <button onClick={guardar} className="btn-primary whitespace-nowrap" disabled={guardant}>{guardant ? 'Guardant...' : 'Guardar planificació'}</button>
        </div>
      </footer>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────