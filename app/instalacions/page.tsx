'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ───────────────────────────────────────────────────────────────────
// Tipus retornats per /api/instalacions (estructura que ve de la
// funció PL/pgSQL estat_instalacions).
// ───────────────────────────────────────────────────────────────────

interface CarroInc {
  assignacio_id: number
  carro_id: number
  num_carro_full: number
  full_id: number
  num_carrega: number
  lot_id: number | null
  estirp: 'Ross' | 'Cobb' | null
  granja: string | null
  data_naixement_lot: string | null
  setmanes_lot: number | null
  quantitat_ous: number
  entrada_incubadora: string | null
  dia_incubacio: number | null
  data_transferencia_full: string | null
  setmana_transferencia: string | null
  posicio: number | null
  zona: 'central' | 'paret' | 'pulsator' | null
  zona_actualitzada_at: string | null
}

interface CarroNx {
  transferencia_id: number
  assignacio_id: number
  carro_id: number
  num_carro_full: number
  full_id: number
  num_carrega: number
  lot_id: number | null
  estirp: 'Ross' | 'Cobb' | null
  granja: string | null
  data_naixement_lot: string | null
  setmanes_lot: number | null
  quantitat_ous: number
  entrada_incubadora: string | null
  dia_incubacio: number | null
  data_transferencia: string | null
  incubadora_origen_id: number | null
  ous_fertils_vacunats: number | null
}

interface Incubadora {
  id: number
  numero: number
  tipus: 'Multistage' | 'Singlestage'
  model: string | null
  capacitat: number
  carros: CarroInc[]
}

interface Naixedora {
  id: number
  numero: number
  model: string | null
  capacitat: number
  carros: CarroNx[]
}

interface Estat {
  incubadores: Incubadora[]
  naixedores: Naixedora[]
  generat_a: string
}

// ───────────────────────────────────────────────────────────────────
// Layout físic de les Singlestage. 6 passadissos × 4 files de
// profunditat. Els passadissos van d'esquerra a dreta de la sala:
// paret-esq | central-esq | pulsator-esq | [pulsator central] |
// pulsator-dre | central-dre | paret-dre. Dins de cada passadís el
// carro 1 és el més a prop de la porta i el 4 el més al fons (toca
// el pulsator).
// ───────────────────────────────────────────────────────────────────

const SS_LAYOUT: Array<{ posicio: number; col: number; row: number; zona: 'paret' | 'central' | 'pulsator' }> = [
  // Costat esquerra (cols 1-3)
  { posicio: 1, col: 1, row: 1, zona: 'paret' },
  { posicio: 2, col: 1, row: 2, zona: 'paret' },
  { posicio: 3, col: 1, row: 3, zona: 'paret' },
  { posicio: 4, col: 1, row: 4, zona: 'paret' },
  { posicio: 9, col: 2, row: 1, zona: 'central' },
  { posicio: 10, col: 2, row: 2, zona: 'central' },
  { posicio: 11, col: 2, row: 3, zona: 'central' },
  { posicio: 12, col: 2, row: 4, zona: 'central' },
  { posicio: 17, col: 3, row: 1, zona: 'pulsator' },
  { posicio: 18, col: 3, row: 2, zona: 'pulsator' },
  { posicio: 19, col: 3, row: 3, zona: 'pulsator' },
  { posicio: 20, col: 3, row: 4, zona: 'pulsator' },
  // Costat dreta (cols 4-6) — més a prop del pulsator central a l'esquerra
  { posicio: 21, col: 4, row: 1, zona: 'pulsator' },
  { posicio: 22, col: 4, row: 2, zona: 'pulsator' },
  { posicio: 23, col: 4, row: 3, zona: 'pulsator' },
  { posicio: 24, col: 4, row: 4, zona: 'pulsator' },
  { posicio: 13, col: 5, row: 1, zona: 'central' },
  { posicio: 14, col: 5, row: 2, zona: 'central' },
  { posicio: 15, col: 5, row: 3, zona: 'central' },
  { posicio: 16, col: 5, row: 4, zona: 'central' },
  { posicio: 5, col: 6, row: 1, zona: 'paret' },
  { posicio: 6, col: 6, row: 2, zona: 'paret' },
  { posicio: 7, col: 6, row: 3, zona: 'paret' },
  { posicio: 8, col: 6, row: 4, zona: 'paret' },
]

// ───────────────────────────────────────────────────────────────────
// Helpers de presentació
// ───────────────────────────────────────────────────────────────────

// Color únic per a cel·les ocupades — tema fosc, sense distinció per estirp.
function colorOcupat(): { bg: string; text: string; border: string } {
  return { bg: '#2a2c35', text: '#e0e0e0', border: '#3a3c45' }
}

function fmtData(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' })
}

function ocupacioColor(ocupats: number, capacitat: number): string {
  if (capacitat === 0) return 'var(--text-dim)'
  const pct = ocupats / capacitat
  if (pct >= 1) return '#c0392b' // ple
  if (pct >= 0.75) return '#e67e22' // gairebé ple
  if (pct > 0) return '#27ae60' // ocupació parcial
  return 'var(--text-dim)' // buit
}

// ───────────────────────────────────────────────────────────────────
// Subcomponent: targeta d'una Singlestage amb mapa de posicions
// ───────────────────────────────────────────────────────────────────

function TargetaSinglestage({ inc, edicio }: { inc: Incubadora; edicio?: ContextEdicio }) {
  const sub: SubTipus = 'SS'
  const carrosPerPosicio = new Map<number, CarroInc>()
  const sensePosicio: CarroInc[] = []
  inc.carros.forEach((c) => {
    if (c.posicio !== null) carrosPerPosicio.set(c.posicio, c)
    else sensePosicio.push(c)
  })

  return (
    <div style={cardStyle}>
      <HeaderTargeta numero={inc.numero} tipus="Singlestage" model={inc.model} ocupats={inc.carros.length} capacitat={inc.capacitat} />

      <div style={{ marginTop: '0.75rem' }}>
        {/* Capçaleres per columna */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr) 10px repeat(3, 1fr)',
          gap: '0 6px',
          marginBottom: '0.3rem',
          padding: '0 4px',
          fontSize: '0.55rem',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          textAlign: 'center',
          fontFamily: 'IBM Plex Mono, monospace',
          fontWeight: 600,
        }}>
          <div>Paret esq</div>
          <div>Central esq</div>
          <div>Pulsator esq</div>
          <div />
          <div>Pulsator dre</div>
          <div>Central dre</div>
          <div>Paret dre</div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr) 10px repeat(3, 1fr)',
            gridTemplateRows: 'repeat(4, auto)',
            gap: '2px 6px',
            background: '#0f1117',
            padding: '4px',
            borderRadius: '6px',
          }}
        >
          {SS_LAYOUT.map(({ posicio, col, row }) => {
            const carro = carrosPerPosicio.get(posicio)
            const c = colorOcupat()
            // Insereix el separador del pulsator central a la columna 4 visual
            const colVisual = col <= 3 ? col : col + 1
            // Inverteix l'eix Y perquè el carro 1 (i la resta de "primers" de cada
            // passadís) surti a baix, més a prop de la porta. Fila visual = 5 - row.
            const rowVisual = 5 - row
            const arrossegable = !!edicio?.actiu && !!carro
            const acceptaDropAqui = !!edicio?.actiu && !carro && edicio.subTipusArrossegat === 'SS'
            return (
              <div
                key={posicio}
                draggable={arrossegable}
                onDragStart={arrossegable ? (e) => {
                  e.dataTransfer.setData('assignacio_id', String(carro!.assignacio_id))
                  e.dataTransfer.setData('sub', 'SS')
                  e.dataTransfer.effectAllowed = 'move'
                  edicio!.setSubTipusArrossegat('SS')
                } : undefined}
                onDragEnd={arrossegable ? () => edicio!.setSubTipusArrossegat(null) : undefined}
                onDragOver={acceptaDropAqui ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } : undefined}
                onDrop={acceptaDropAqui ? (e) => {
                  e.preventDefault()
                  const aid = parseInt(e.dataTransfer.getData('assignacio_id'), 10)
                  if (!Number.isFinite(aid)) return
                  edicio!.onMoure(aid, inc.id, posicio, null)
                } : undefined}
                title={
                  carro
                    ? `Pos ${posicio} · ${carro.granja ?? '—'} · #${carro.num_carrega}/${carro.num_carro_full} · ${carro.setmanes_lot ?? '?'}s repr · dia ${carro.dia_incubacio ?? '?'}${edicio?.actiu ? ' · arrossega per moure' : ''}`
                    : `Pos ${posicio} · lliure${acceptaDropAqui ? ' (drop aquí)' : ''}`
                }
                style={{
                  gridColumn: colVisual,
                  gridRow: rowVisual,
                  background: carro ? c.bg : (acceptaDropAqui ? '#1d2c1d' : '#1a1c25'),
                  color: carro ? c.text : '#555',
                  border: `${acceptaDropAqui ? '2px dashed #27ae60' : '1px solid'} ${carro ? c.border : (acceptaDropAqui ? '#27ae60' : '#2a2c35')}`,
                  borderRadius: '3px',
                  padding: '3px 3px',
                  fontSize: '0.55rem',
                  textAlign: 'center',
                  fontFamily: 'IBM Plex Mono, monospace',
                  lineHeight: 1.15,
                  minHeight: '58px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: carro ? 'space-between' : 'center',
                  overflow: 'hidden',
                  cursor: arrossegable ? 'grab' : 'default',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.6rem', opacity: 0.55 }}>{posicio}</div>
                {carro ? (
                  <>
                    <div style={{
                      fontSize: '0.58rem', fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{carro.granja ?? '—'}</div>
                    <div style={{ fontSize: '0.55rem', opacity: 0.85 }}>
                      {carro.num_carrega}/{carro.num_carro_full}
                    </div>
                    <div style={{ fontSize: '0.55rem', opacity: 0.7 }}>{carro.dia_incubacio ?? '?'}d</div>
                  </>
                ) : null}
              </div>
            )
          })}
          {/* Línia central del pulsator */}
          <div style={{ gridColumn: 4, gridRow: '1 / 5', background: '#2a2c35', borderRadius: '2px' }} />
        </div>

        {sensePosicio.length > 0 && (
          <div style={{ marginTop: '0.5rem', padding: '0.4rem', background: '#1a1c25', borderRadius: '4px', fontSize: '0.7rem', color: '#999' }}>
            <strong>{sensePosicio.length}</strong> carros sense posició assignada
          </div>
        )}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Subcomponent: targeta d'una Multistage agrupada per zona
// ───────────────────────────────────────────────────────────────────

function TargetaMultistage({ inc, edicio }: { inc: Incubadora; edicio?: ContextEdicio }) {
  const sub = subtipusDe(inc)
  const zones: Record<'central' | 'paret' | 'pulsator' | 'sense', CarroInc[]> = {
    central: [],
    paret: [],
    pulsator: [],
    sense: [],
  }
  inc.carros.forEach((c) => {
    if (c.zona === null) zones.sense.push(c)
    else zones[c.zona].push(c)
  })

  return (
    <div style={cardStyle}>
      <HeaderTargeta numero={inc.numero} tipus="Multistage" model={inc.model} ocupats={inc.carros.length} capacitat={inc.capacitat} />

      <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
        <ColumnaZona titol="Central" carros={zones.central} accent="#27ae60" inc={inc} zona="central" edicio={edicio} sub={sub} />
        <ColumnaZona titol="Paret" carros={zones.paret} accent="#3498db" inc={inc} zona="paret" edicio={edicio} sub={sub} />
        <ColumnaZona titol="Pulsator" carros={zones.pulsator} accent="#e74c3c" inc={inc} zona="pulsator" edicio={edicio} sub={sub} />
      </div>

      {zones.sense.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
            Sense zona ({zones.sense.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {zones.sense.map((c) => (
              <ChipCarro key={c.assignacio_id} carro={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ColumnaZona({ titol, carros, accent, inc, zona, edicio, sub }: { titol: string; carros: CarroInc[]; accent: string; inc?: Incubadora; zona?: 'central'|'paret'|'pulsator'; edicio?: ContextEdicio; sub?: SubTipus }) {
  const acceptaDrop = edicio?.actiu && inc && zona && sub && edicio.subTipusArrossegat === sub
  const lliureEnZona = inc && zona ? (carros.length < (inc.capacitat === 24 ? 8 : 4)) : false
  return (
    <div
      style={{ background: '#1a1c25', borderRadius: '6px', padding: '0.4rem', minHeight: '120px', border: acceptaDrop && lliureEnZona ? '2px dashed ' + accent : '2px solid transparent', transition: 'border 0.1s' }}
      onDragOver={acceptaDrop && lliureEnZona ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } : undefined}
      onDrop={acceptaDrop && lliureEnZona && inc && zona && edicio ? (e) => {
        e.preventDefault()
        const aid = parseInt(e.dataTransfer.getData('assignacio_id'), 10)
        const pos = posicioLliureMSZona(inc, zona)
        if (!Number.isFinite(aid) || pos === null) return
        edicio.onMoure(aid, inc.id, pos, zona)
      } : undefined}
    >
      <div style={{ fontSize: '0.65rem', color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem', fontWeight: 600 }}>
        {titol} <span style={{ color: 'var(--text-dim)' }}>({carros.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {carros.length === 0 ? (
          <div style={{ fontSize: '0.65rem', color: '#444', textAlign: 'center', padding: '0.5rem 0' }}>—</div>
        ) : (
          carros.map((c) => <ChipCarro key={c.assignacio_id} carro={c} edicio={edicio} sub={sub} />)
        )}
      </div>
    </div>
  )
}

function ChipCarro({ carro, edicio, sub }: { carro: CarroInc | CarroNx; edicio?: ContextEdicio; sub?: SubTipus }) {
  const c = colorOcupat()
  const isInc = (carro as CarroInc).assignacio_id !== undefined && (carro as CarroNx).transferencia_id === undefined
  const arrosegable = edicio?.actiu && isInc && sub !== undefined
  return (
    <div
      title={`${carro.granja ?? '—'} · #${carro.num_carrega}/${carro.num_carro_full} · ${carro.setmanes_lot ?? '?'}s repr · dia ${carro.dia_incubacio ?? '?'}${arrosegable ? ' · arrossega per moure' : ''}`}
      draggable={arrosegable}
      onDragStart={arrosegable ? (e) => {
        e.dataTransfer.setData('assignacio_id', String((carro as CarroInc).assignacio_id))
        e.dataTransfer.setData('sub', sub!)
        e.dataTransfer.effectAllowed = 'move'
        edicio!.setSubTipusArrossegat(sub!)
      } : undefined}
      onDragEnd={arrosegable ? () => edicio!.setSubTipusArrossegat(null) : undefined}
      style={{
        background: c.bg,
        cursor: arrosegable ? 'grab' : 'default',
        color: c.text,
        border: `1px solid ${c.border}`,
        borderRadius: '3px',
        padding: '3px 5px',
        fontSize: '0.62rem',
        fontFamily: 'IBM Plex Mono, monospace',
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
      }}
    >
      <span style={{
        fontWeight: 600,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {carro.granja ?? '—'}
      </span>
      <span style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.8, fontSize: '0.58rem' }}>
        <span>{carro.num_carrega}/{carro.num_carro_full}</span>
        <span>{carro.dia_incubacio ?? '?'}d</span>
      </span>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Targeta d'una naixedora
// ───────────────────────────────────────────────────────────────────

function TargetaNaixedora({ nx }: { nx: Naixedora }) {
  return (
    <div style={cardStyle}>
      <HeaderTargeta numero={nx.numero} tipus="Naixedora" model={nx.model} ocupats={nx.carros.length} capacitat={nx.capacitat} />
      <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {nx.carros.length === 0 ? (
          <div style={{ fontSize: '0.7rem', color: '#444', textAlign: 'center', padding: '0.8rem 0' }}>Buida</div>
        ) : (
          nx.carros.map((c) => <ChipCarro key={c.transferencia_id} carro={c} />)
        )}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Capçalera comuna de targeta
// ───────────────────────────────────────────────────────────────────

function HeaderTargeta({ numero, tipus, model, ocupats, capacitat }: { numero: number; tipus: string; model: string | null; ocupats: number; capacitat: number }) {
  const colorOcup = ocupacioColor(ocupats, capacitat)
  const tipusBadge = tipus === 'Singlestage' ? { bg: '#5d4037', txt: '#fff' } : tipus === 'Multistage' ? { bg: '#1565c0', txt: '#fff' } : { bg: '#2e7d32', txt: '#fff' }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
      <div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>
          {tipus === 'Naixedora' ? `N${numero}` : `#${numero}`}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{model ?? '—'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
        <span style={{ background: tipusBadge.bg, color: tipusBadge.txt, fontSize: '0.6rem', padding: '1px 6px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {tipus}
        </span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: colorOcup, fontFamily: 'IBM Plex Mono, monospace' }}>
          {ocupats}/{capacitat}
        </span>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '0.9rem',
}


// ───────────────────────────────────────────────────────────────────
// Mode edició — drag-and-drop entre cel·les del mateix tipus
// ───────────────────────────────────────────────────────────────────

type SubTipus = 'SS' | 'MSG' | 'MSP'

function subtipusDe(inc: Incubadora): SubTipus {
  if (inc.tipus === 'Singlestage') return 'SS'
  return inc.capacitat === 24 ? 'MSG' : 'MSP'
}

interface ContextEdicio {
  actiu: boolean
  // Subtipus del carro en curs d'arrossegament (per pintar drop targets vàlids)
  subTipusArrossegat: SubTipus | null
  setSubTipusArrossegat: (s: SubTipus | null) => void
  // Crida PATCH /api/assignacions/[id]
  onMoure: (assignacioId: number, incIdDesti: number, posDesti: number, zonaDesti: 'central'|'paret'|'pulsator'|null) => void
}

// Trobar la posició lliure mínima d'una zona MS dins una incubadora destí
function posicioLliureMSZona(inc: Incubadora, zona: 'central'|'paret'|'pulsator'): number | null {
  const max = inc.capacitat === 24 ? 8 : 4
  const ocupades = new Set(inc.carros.filter(c => c.zona === zona && c.posicio !== null).map(c => c.posicio as number))
  for (let p = 1; p <= max; p++) if (!ocupades.has(p)) return p
  return null
}

// ───────────────────────────────────────────────────────────────────
// Pàgina principal
// ───────────────────────────────────────────────────────────────────

export default function Instalacions() {
  const [estat, setEstat] = useState<Estat | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modeEdicio, setModeEdicio] = useState(false)
  const [subTipusArrossegat, setSubTipusArrossegat] = useState<SubTipus | null>(null)
  const [missatgeEdicio, setMissatgeEdicio] = useState<string>('')

  const carregar = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch('/api/instalacions', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Error carregant dades')
        return r.json()
      })
      .then((data: Estat) => {
        setEstat(data)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // ── Mode edició: handler de mou
  const onMoureCarro = useCallback(async (assignacioId: number, incIdDesti: number, posDesti: number, zonaDesti: 'central'|'paret'|'pulsator'|null) => {
    setMissatgeEdicio('')
    try {
      const res = await fetch(`/api/assignacions/${assignacioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incubadora_id: incIdDesti, posicio: posDesti, zona: zonaDesti }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMissatgeEdicio('Error: ' + (data.error || res.statusText))
        return
      }
      setMissatgeEdicio('✓ Mogut')
      carregar()
    } catch (e) {
      setMissatgeEdicio('Error xarxa: ' + String(e))
    }
  }, [carregar])

  const ctxEdicio: ContextEdicio = {
    actiu: modeEdicio,
    subTipusArrossegat,
    setSubTipusArrossegat,
    onMoure: onMoureCarro,
  }

  // Totals globals
  const totalCarrosInc = estat?.incubadores.reduce((s, i) => s + i.carros.length, 0) ?? 0
  const totalCapacitatInc = estat?.incubadores.reduce((s, i) => s + i.capacitat, 0) ?? 0
  const totalCarrosNx = estat?.naixedores.reduce((s, n) => s + n.carros.length, 0) ?? 0
  const totalCapacitatNx = estat?.naixedores.reduce((s, n) => s + n.capacitat, 0) ?? 0

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                ← Inici
              </Link>
            </p>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Instal·lacions</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {loading ? 'Carregant...' : `${totalCarrosInc} carros a incubadores · ${totalCarrosNx} a naixedores`}
            </p>
          </div>
          <button
            onClick={carregar}
            disabled={loading}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '0.4rem 0.9rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            {loading ? '...' : '↻ Refrescar'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#3d1c1c', border: '1px solid #c0392b', color: '#ffb3b3', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {estat && !loading && (
          <>
            {/* Resum global + toggle edició */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <KpiBox titol="Incubadores" valor={`${totalCarrosInc}/${totalCapacitatInc}`} subtitol={`${estat.incubadores.length} màquines`} />
              <KpiBox titol="Naixedores" valor={`${totalCarrosNx}/${totalCapacitatNx}`} subtitol={`${estat.naixedores.length} màquines`} />
              <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <button
                  onClick={() => setModeEdicio(v => !v)}
                  style={{ background: modeEdicio ? '#c0392b' : 'var(--surface)', border: '1px solid ' + (modeEdicio ? '#c0392b' : 'var(--border)'), color: modeEdicio ? '#fff' : 'var(--text)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  {modeEdicio ? '✓ Tancar edició' : '✎ Editar'}
                </button>
                {modeEdicio && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', maxWidth: 240, textAlign: 'right' }}>
                    Arrossega els carros a una cel·la lliure del mateix tipus. SS↔SS, MSG↔MSG, MSP↔MSP.
                  </div>
                )}
                {missatgeEdicio && (
                  <div style={{ fontSize: '0.7rem', color: missatgeEdicio.startsWith('Error') ? '#ffb3b3' : '#86efac', maxWidth: 240, textAlign: 'right' }}>
                    {missatgeEdicio}
                  </div>
                )}
              </div>
            </div>

            {/* INCUBADORES */}
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>
                Incubadores
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
                {estat.incubadores.map((inc) =>
                  inc.tipus === 'Singlestage' ? <TargetaSinglestage key={inc.id} inc={inc} edicio={ctxEdicio} /> : <TargetaMultistage key={inc.id} inc={inc} edicio={ctxEdicio} />
                )}
              </div>
            </section>

            {/* NAIXEDORES */}
            <section>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>
                Naixedores
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {estat.naixedores.map((nx) => (
                  <TargetaNaixedora key={nx.id} nx={nx} />
                ))}
              </div>
            </section>

            <p style={{ marginTop: '2rem', fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              Generat: {new Date(estat.generat_a).toLocaleString('ca-ES')}
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function KpiBox({ titol, valor, subtitol }: { titol: string; valor: string; subtitol: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.7rem 1rem', minWidth: '160px' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{titol}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace', marginTop: '2px' }}>{valor}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>{subtitol}</div>
    </div>
  )
}
