import React, { useRef, useEffect, memo } from 'react';
import Link from 'next/link';
import { ZonaMS, SubTipus, Dia, Fase, CarroEstoc, Incubadora, AssignacioActual, Full, CarroInst, IncInst, EstatInst, ssPosToCell, MS_ZONES_ESQ, MS_ZONES_DRE, subtipus, diaDeFull, nomCarroCurt, keyCell, diesEstoc, setmanesLot, offsetPerDia, polletsCarro, optimitzarZonesTermiques, projectarEstatInst, CellaSel, ordreCellesSS, preSuggerit, ECLOSIO_EST, suggerirAssignacioCompleta } from '@/lib/assignacions';

export const MemoCell = memo(Cell);
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

// Checkbox amb suport per a l'estat indeterminate.
// El ref el gestiona el component internament per evitar crear una nova
// funció de ref en cada render del pare (cosa que força React a reassignar
// el DOM node innecessàriament en cada re-render).
export function IndeterminateCheckbox({ indeterminate, ...props }: { indeterminate: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return <input ref={ref} {...props} />
}

export function HeaderPlan({ full, dia, setDia, pendents, total, colocats, onTornarSeleccio }: { full: Full; dia: Dia; setDia: (d: Dia) => void; pendents: number; total: number; colocats: number; onTornarSeleccio: () => void }) {
  const diaInferit = diaDeFull(full.carrega)
  return (
    <header className="bg-surface border-b border-border px-5 py-3 flex justify-between items-center gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2.5 mb-0.5">
          <button onClick={onTornarSeleccio} className="bg-transparent border border-border rounded px-2.5 py-1 text-xs cursor-pointer text-text-dim hover:bg-bg">← Pas 1</button>
          <h1 className="m-0 text-lg text-text">Adjudicació full #{full.num_carrega} — Pas 2: Assignació visual</h1>
        </div>
        <div className="text-text-dim text-sm">
          Càrrega <b className="text-text">{full.carrega}</b> · {total} carros seleccionats · {colocats} col·locats · {pendents} pendents
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <label className="text-sm text-text-dim flex items-center">
          Patró del dia:&nbsp;
          <select value={dia} onChange={e => setDia(e.target.value as Dia)} className="px-2 py-1 text-sm bg-bg border border-border rounded text-text outline-none focus:border-accent">
            <option value="dijous">Dijous (SS · Inc 1-2 · MSP)</option>
            <option value="dilluns">Dilluns (Inc 3-6 · MSP)</option>
          </select>
          {diaInferit && diaInferit !== dia && (
            <span className="text-danger text-xs ml-2">(el full és {diaInferit}!)</span>
          )}
        </label>
      </div>
    </header>
  )
}

export function OrdreMSP({ ordre, onChange }: { ordre: number[]; onChange: (o: number[]) => void }) {
  function mou(idx: number, dir: -1 | 1) {
    const novaOrdre = [...ordre]
    const j = idx + dir
    if (j < 0 || j >= novaOrdre.length) return
    ;[novaOrdre[idx], novaOrdre[j]] = [novaOrdre[j], novaOrdre[idx]]
    onChange(novaOrdre)
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-text-dim">
      Ordre MSP:
      {ordre.map((n, i) => (
        <span key={n} className="inline-flex items-center gap-0.5">
          <button onClick={() => mou(i, -1)} disabled={i === 0} className="bg-surface border border-border rounded cursor-pointer text-[10px] px-1 hover:bg-bg disabled:opacity-50 text-text">◀</button>
          <span className="bg-bg px-1.5 py-0.5 rounded font-bold text-text">{n}</span>
          <button onClick={() => mou(i, 1)} disabled={i === ordre.length - 1} className="bg-surface border border-border rounded cursor-pointer text-[10px] px-1 hover:bg-bg disabled:opacity-50 text-text">▶</button>
        </span>
      ))}
    </div>
  )
}

export function Safata({ pendents, onDragStartCarro, full }: { pendents: CarroEstoc[]; onDragStartCarro: (e: React.DragEvent, id: number, origen: string | null) => void; full: Full }) {
  // Agrupar per lot (granja+estirp+posta)
  const grups: { key: string; nom: string; estirp: string | null; posta: string; carros: CarroEstoc[] }[] = []
  const map = new Map<string, { nom: string; estirp: string | null; posta: string; carros: CarroEstoc[] }>()
  for (const c of pendents) {
    const k = `${c.lots_reproductores.granges_reproductores.granja}|${c.lots_reproductores.estirp || ''}|${c.posta}`
    if (!map.has(k)) map.set(k, { nom: nomCarroCurt(c), estirp: c.lots_reproductores.estirp, posta: c.posta, carros: [] })
    map.get(k)!.carros.push(c)
  }
  map.forEach((v, k) => grups.push({ key: k, ...v }))
  grups.sort((a, b) => diesEstoc(b.posta, full.carrega) - diesEstoc(a.posta, full.carrega))

  return (
    <div>
      {grups.map(g => (
        <div key={g.key} className="mb-2.5">
          <div className="text-[11px] text-text-dim mb-1 font-semibold">
            {g.nom}{g.estirp ? ` · ${g.estirp}` : ''} · posta {g.posta} · {g.carros.length} carro{g.carros.length !== 1 ? 's' : ''}
          </div>
          {g.carros.map(c => (
            <div key={c.id}
              draggable
              onDragStart={(e) => onDragStartCarro(e, c.id, null)}
              className="bg-accent/10 border border-accent rounded-md px-2 py-1.5 mb-1 cursor-grab text-xs leading-snug select-none text-text">
              <div className="text-[11px] opacity-80">{c.quantitat_ous.toLocaleString('ca')} ous · estoc {diesEstoc(c.posta, full.carrega)}d</div>
            </div>
          ))}
        </div>
      ))}
      {pendents.length === 0 && <div className="text-text-dim text-xs text-center p-3">Cap carro pendent</div>}
    </div>
  )
}

export function SeccioInc({ titol, badge, incs, children, extra }: { titol: string; badge: string; incs: Incubadora[]; children: React.ReactNode; extra?: React.ReactNode }) {
  if (incs.length === 0) return null
  return (
    <section className="bg-surface border border-border rounded-xl p-3.5">
      <h2 className="m-0 mb-3 text-[15px] flex gap-2 items-center text-text">
        {titol} <span className="bg-bg border border-border px-2 py-0.5 rounded-full text-[11px] font-medium text-text-dim">{badge}</span>
        {extra && <span className="ml-auto">{extra}</span>}
      </h2>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${Math.min(incs.length, 3)}, 1fr)` }}>
        {children}
      </div>
    </section>
  )
}

// ── Singlestage incubadora ────────────────────────────────────────────────

interface CellPropsCommon {
  carrosLot: CarroEstoc[]
  carroPerCella: Map<string, number>
  ocupatsAltresFulls: Map<string, { num_carro_full: number; num_carrega: number; estirp: string | null; data_transferencia_full: string | null }>
  lliureAviatPerCella: Map<string, { diesFins: number; num_carro_full: number; num_carrega: number; data_transferencia_full: string }>
  colocats: Map<number, { incId: number; pos: number; zona: ZonaMS | null }>
  seleccionades: Set<string>
  numCarroPerCella: Map<string, number>
  onSelLliures: (inc: Incubadora) => void
  onClicCella: (incId: number, pos: number, zona: ZonaMS | null) => void
  onDropCell: (e: React.DragEvent, incId: number, pos: number, zona: ZonaMS | null) => void
  onDragStartCarro: (e: React.DragEvent, id: number, origen: string | null) => void
  onDragOverCell: (e: React.DragEvent) => void
  onClicCarroColocat: (id: number) => void
  mostrarProjectat: boolean
}

export function IncubadoraSS({ inc, filtrada, anyFiltrada, onToggleFiltrada, ...p }: CellPropsCommon & {
  inc: Incubadora
  filtrada: boolean
  anyFiltrada: boolean
  onToggleFiltrada: () => void
}) {
  const ocupNous = Array.from(p.colocats.values()).filter(c => c.incId === inc.id).length
  const ocupAltres = Array.from(p.ocupatsAltresFulls.keys()).filter(k => k.startsWith(`${inc.id}|`)).length
  const exclosa = anyFiltrada && !filtrada
  return (
    <div className={`bg-bg border rounded-lg p-2 transition-all ${filtrada ? 'border-accent border-2' : exclosa ? 'border-border opacity-50' : 'border-border'}`}>
      <div className="flex justify-between items-center mb-1.5 text-sm gap-1">
        <button onClick={onToggleFiltrada} title={filtrada ? 'Exclou del suggeriment' : 'Inclou al suggeriment'} className={`font-semibold bg-transparent border-none cursor-pointer p-0 text-sm ${filtrada ? 'text-accent' : 'text-text'}`}>
          {filtrada ? '✓ ' : ''}SS {inc.numero}
        </button>
        <span className="flex gap-1.5 items-center">
          <span className="text-text-dim text-[11px]">{ocupNous + ocupAltres}/{inc.capacitat_carros}</span>
          <button onClick={() => p.onSelLliures(inc)} className="bg-accent/10 border border-accent/30 rounded px-1.5 py-0.5 text-[10px] cursor-pointer text-accent font-bold hover:bg-accent/20 transition-colors" title="Selecciona totes les cel·les lliures">+ sel. lliures</button>
        </span>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: '1fr 1fr 1fr 6px 1fr 1fr 1fr' }}>
        {['Paret esq', 'Central esq', 'Pulsator esq', '', 'Pulsator dre', 'Central dre', 'Paret dre'].map((h, i) => (
          <div key={i} className="text-[9px] text-center text-text-dim" style={{ gridColumn: i + 1, gridRow: 1 }}>{h}</div>
        ))}
        <div className="bg-text opacity-20 rounded-[1px]" style={{ gridColumn: 4, gridRow: '2 / 6' }} />
        {Array.from({ length: 24 }, (_, i) => i + 1).map(pos => {
          const { col, row } = ssPosToCell(pos)
          const gridCol = col < 3 ? (col + 1) : (col + 2)
          const gridRow = 2 + (3 - row)
          return (
            (() => {
              const k = keyCell(inc.id, pos, null)
              const carroIdNou = p.carroPerCella.get(k)
              const carroNouObj = carroIdNou !== undefined ? p.carrosLot.find(c => c.id === carroIdNou) || null : null
              return (
                <MemoCell key={pos}
                  incId={inc.id} pos={pos} zona={null} gridCol={gridCol} gridRow={gridRow}
                  carroNouObj={carroNouObj}
                  ocupAltre={p.ocupatsAltresFulls.get(k)}
                  lliureAviat={p.lliureAviatPerCella.get(k)}
                  isSeleccionada={p.seleccionades.has(k)}
                  numCarro={p.numCarroPerCella.get(k)}
                  mostrarProjectat={p.mostrarProjectat}
                  onClicCella={p.onClicCella}
                  onDropCell={p.onDropCell}
                  onDragStartCarro={p.onDragStartCarro}
                  onDragOverCell={p.onDragOverCell}
                  onClicCarroColocat={p.onClicCarroColocat}
                />
              )
            })()
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>↓ porta frontal ↓</div>
    </div>
  )
}

export function IncubadoraMS({ inc, sub, filtrada, anyFiltrada, onToggleFiltrada, ...p }: CellPropsCommon & {
  inc: Incubadora
  sub: 'MSG' | 'MSP'
  filtrada: boolean
  anyFiltrada: boolean
  onToggleFiltrada: () => void
}) {
  const ocupNous = Array.from(p.colocats.values()).filter(c => c.incId === inc.id).length
  const ocupAltres = Array.from(p.ocupatsAltresFulls.keys()).filter(k => k.startsWith(`${inc.id}|`)).length
  const profunditat = sub === 'MSG' ? 4 : 2
  const posEsq = sub === 'MSG' ? [1, 2, 3, 4] : [1, 2]
  const posDre = sub === 'MSG' ? [5, 6, 7, 8] : [3, 4]
  const exclosa = anyFiltrada && !filtrada

  return (
    <div className={`bg-bg border rounded-lg p-2 transition-all ${filtrada ? 'border-accent border-2' : exclosa ? 'border-border opacity-50' : 'border-border'}`}>
      <div className="flex justify-between items-center mb-1.5 text-sm gap-1">
        <button onClick={onToggleFiltrada} title={filtrada ? 'Exclou del suggeriment' : 'Inclou al suggeriment'} className={`font-semibold bg-transparent border-none cursor-pointer p-0 text-sm ${filtrada ? 'text-accent' : 'text-text'}`}>
          {filtrada ? '✓ ' : ''}Inc {inc.numero}
        </button>
        <span className="flex gap-1.5 items-center">
          <span className="text-text-dim text-[11px]">{ocupNous + ocupAltres}/{inc.capacitat_carros}</span>
          <button onClick={() => p.onSelLliures(inc)} className="bg-accent/10 border border-accent/30 rounded px-1.5 py-0.5 text-[10px] cursor-pointer text-accent font-bold hover:bg-accent/20 transition-colors" title="Selecciona totes les cel·les lliures">+ sel. lliures</button>
        </span>
      </div>
      <div className="grid gap-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 6px 1fr 1fr 1fr' }}>
        {/* Capçaleres */}
        {[{ z: 'paret', d: '~7d', col: 1 }, { z: 'central', d: '~0d', col: 2 }, { z: 'pulsator', d: '~14d', col: 3 },
          { z: 'pulsator', d: '~14d', col: 5 }, { z: 'central', d: '~0d', col: 6 }, { z: 'paret', d: '~7d', col: 7 }].map((h, i) => (
          <div key={i} className="text-[8px] text-center text-text-dim leading-[1.05]" style={{ gridColumn: h.col, gridRow: 1 }}>
            {h.z}<br /><span className="opacity-70">{h.d}</span>
          </div>
        ))}
        <div className="bg-text opacity-20 rounded-[1px]" style={{ gridColumn: 4, gridRow: `2 / ${2 + profunditat}` }} />
        {/* Costat esq: zones paret/central/pulsator (cols 1-3) */}
        {MS_ZONES_ESQ.map((z, zi) => posEsq.map(pos => {
            const k = keyCell(inc.id, pos, z);
            const carroIdNou = p.carroPerCella.get(k);
            const carroNouObj = carroIdNou !== undefined ? p.carrosLot.find(c => c.id === carroIdNou) || null : null;
            return (
              <MemoCell key={`esq-${pos}-${z}`}
                incId={inc.id} pos={pos} zona={z} gridCol={zi + 1} gridRow={2 + (profunditat - pos)} zonaClass={z}
                carroNouObj={carroNouObj} ocupAltre={p.ocupatsAltresFulls.get(k)} lliureAviat={p.lliureAviatPerCella.get(k)}
                isSeleccionada={p.seleccionades.has(k)} numCarro={p.numCarroPerCella.get(k)} mostrarProjectat={p.mostrarProjectat}
                onClicCella={p.onClicCella} onDropCell={p.onDropCell} onDragStartCarro={p.onDragStartCarro} onDragOverCell={p.onDragOverCell} onClicCarroColocat={p.onClicCarroColocat}
              />
            );
          }))}
        {/* Costat dre: zones pulsator/central/paret (cols 5-7) */}
        {MS_ZONES_DRE.map((z, zi) => posDre.map(pos => {
          const posLocal = pos - (sub === 'MSG' ? 4 : 2)
          return (
            (() => {
              const k = keyCell(inc.id, pos, z)
              const carroIdNou = p.carroPerCella.get(k)
              const carroNouObj = carroIdNou !== undefined ? p.carrosLot.find(c => c.id === carroIdNou) || null : null
              return (
                <MemoCell key={`dre-${pos}-${z}`}
                  incId={inc.id} pos={pos} zona={z} gridCol={zi + 5} gridRow={2 + (profunditat - posLocal)} zonaClass={z}
                  carroNouObj={carroNouObj} ocupAltre={p.ocupatsAltresFulls.get(k)} lliureAviat={p.lliureAviatPerCella.get(k)}
                  isSeleccionada={p.seleccionades.has(k)} numCarro={p.numCarroPerCella.get(k)} mostrarProjectat={p.mostrarProjectat}
                  onClicCella={p.onClicCella} onDropCell={p.onDropCell} onDragStartCarro={p.onDragStartCarro} onDragOverCell={p.onDragOverCell} onClicCarroColocat={p.onClicCarroColocat}
                />
              )
            })()
          )
        }))}
      </div>
      <div style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>↓ porta frontal ↓</div>
    </div>
  )
}

// ── Cel·la individual ──────────────────────────────────────────────────────

interface CellProps {
  incId: number; pos: number; zona: ZonaMS | null; gridCol: number; gridRow: number; zonaClass?: ZonaMS;
  carroNouObj: CarroEstoc | null;
  ocupAltre: { num_carro_full: number; num_carrega: number; estirp: string | null; data_transferencia_full: string | null } | undefined;
  lliureAviat: { diesFins: number; num_carro_full: number; num_carrega: number; data_transferencia_full: string } | undefined;
  isSeleccionada: boolean; numCarro: number | undefined; mostrarProjectat: boolean;
  onClicCella: (incId: number, pos: number, zona: ZonaMS | null) => void;
  onDropCell: (e: React.DragEvent, incId: number, pos: number, zona: ZonaMS | null) => void;
  onDragStartCarro: (e: React.DragEvent, id: number, origen: string | null) => void;
  onDragOverCell: (e: React.DragEvent) => void;
  onClicCarroColocat: (id: number) => void;
}

export function Cell({ incId, pos, zona, gridCol, gridRow, zonaClass, carroNouObj, ocupAltre, lliureAviat, isSeleccionada: sel, numCarro, mostrarProjectat, onClicCella, onDropCell, onDragStartCarro, onDragOverCell, onClicCarroColocat }: CellProps) {
  const carroIdNou = carroNouObj ? carroNouObj.id : undefined;
  const k = keyCell(incId, pos, zona)

  // lliureAviat té prioritat sobre ocupAltre (és un subconjunt que permet interacció)
  // En mode projectat, les cel·les "lliure aviat" es mostren com a buides
  const tractarComBuit = mostrarProjectat && !!lliureAviat && carroIdNou === undefined
  const blocat = !!ocupAltre && !lliureAviat

  let bgClass = 'bg-surface'
  let borderClass = 'border-dashed border-border'
  let colorClass = 'text-text'
  let cursor = 'cursor-pointer'

  if (zonaClass) {
    bgClass = zonaClass === 'paret' ? 'bg-danger/10' : zonaClass === 'central' ? 'bg-surface' : 'bg-accent/10'
  }
  if (blocat) {
    bgClass = 'bg-bg opacity-50'
    colorClass = 'text-text'
    borderClass = 'border-solid border-border'
    cursor = 'cursor-default'
  } else if (lliureAviat && !carroIdNou && !tractarComBuit) {
    // Ocupat ara però lliure a temps — verd suau (mode no projectat)
    bgClass = 'bg-success/10'
    borderClass = 'border-dashed border-success'
    colorClass = 'text-success'
    cursor = 'cursor-pointer'
  } else if (carroIdNou !== undefined) {
    bgClass = 'bg-accent/20'
    borderClass = 'border-solid border-accent'
    colorClass = 'text-accent'
    cursor = 'cursor-grab'
  } else if (sel) {
    bgClass = 'bg-accent/30'
    borderClass = 'border-solid border-accent'
    colorClass = 'text-accent'
    cursor = 'cursor-pointer'
  }

  // carroNouObj passat per props

  // Text del comptador de dies per a cel·les "lliure aviat"
  function textDiesFins(dies: number): string {
    if (dies <= 0) return 'avui'
    if (dies === 1) return 'demà'
    return `${dies}d`
  }

  // Tooltip detallat
  const titleText = blocat
    ? `Ocupat · càrrega ${ocupAltre!.num_carrega}/#${ocupAltre!.num_carro_full}${ocupAltre!.data_transferencia_full ? ' · transf ' + ocupAltre!.data_transferencia_full : ''}`
    : lliureAviat && !carroIdNou
    ? `Lliure en ${textDiesFins(lliureAviat.diesFins)} · transferència ${lliureAviat.data_transferencia_full} · carrega ${lliureAviat.num_carrega}/#${lliureAviat.num_carro_full} · click o arrossega per assignar`
    : carroNouObj
    ? `${nomCarroCurt(carroNouObj)} · ${carroNouObj.quantitat_ous} ous · click per treure`
    : `Pos ${pos}${zona ? ' · ' + zona : ''}`

  return (
    <div
      className={`${bgClass} ${borderClass} ${colorClass} ${cursor} border rounded flex flex-col items-center justify-center gap-[1px] text-[10px] font-semibold p-0.5 leading-[1.05] overflow-hidden min-h-[48px]`}
      style={{ gridColumn: gridCol, gridRow }}
      onClick={() => {
        if (carroIdNou !== undefined) onClicCarroColocat(carroIdNou)
        else if (!blocat) onClicCella(incId, pos, zona)
      }}
      draggable={carroIdNou !== undefined}
      onDragStart={(e) => carroIdNou !== undefined && onDragStartCarro(e, carroIdNou, k)}
      onDragOver={!blocat ? onDragOverCell : undefined}
      onDrop={!blocat ? (e) => onDropCell(e, incId, pos, zona) : undefined}
      title={titleText}
    >
      {blocat && ocupAltre && <span>#{ocupAltre.num_carro_full}</span>}
      {lliureAviat && !carroIdNou && !tractarComBuit && (
        <>
          <span className="text-[8px] opacity-70 text-center">#{lliureAviat.num_carro_full}</span>
          <span className="text-[10px] font-bold text-success">{textDiesFins(lliureAviat.diesFins)}</span>
        </>
      )}
      {carroNouObj && (
        <>
          {numCarro !== undefined && (
            <span className="text-[9px] font-bold text-accent bg-bg/50 rounded-sm px-[3px] mb-[1px]">#{numCarro}</span>
          )}
          <span className="text-[10px] max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{nomCarroCurt(carroNouObj)}</span>
          <span className="text-[9px] opacity-75">{carroNouObj.quantitat_ous.toLocaleString('ca')} ous</span>
        </>
      )}
      {!blocat && (tractarComBuit || !lliureAviat) && !carroNouObj && (
        <>
          {numCarro !== undefined
            ? <span className="text-[9px] font-semibold text-text-dim">#{numCarro}</span>
            : <span className="text-[9px] opacity-30">{pos}</span>
          }
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Estils helpers
// ─────────────────────────────────────────────────────────────────────────────

export function cardSeccio(): React.CSSProperties { return { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 } }
export function h2Seccio(): React.CSSProperties { return { margin: '0 0 12px', fontSize: 15, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text)' } }
export function badgeStyle(): React.CSSProperties { return { background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, color: 'var(--text-dim)' } }
export function cardInc(): React.CSSProperties { return { border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--bg)' } }
export function btnSelLliures(): React.CSSProperties { return { background: 'var(--accent)', opacity: 0.8, border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: '#000', fontWeight: 600 } }
export function chipNaix(): React.CSSProperties { return { background: 'var(--border)', color: 'var(--text)', padding: '4px 6px', borderRadius: 4, fontSize: 11 } }
export function miniBtn(): React.CSSProperties { return { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer', fontSize: 10, color: 'var(--text)' } }
export function btnStyle(primari: boolean): React.CSSProperties {
  return primari
    ? { padding: '8px 14px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#000', cursor: 'pointer', fontSize: 13, marginLeft: 8, fontWeight: 600 }
    : { padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, marginLeft: 8, fontWeight: 500 }
}
