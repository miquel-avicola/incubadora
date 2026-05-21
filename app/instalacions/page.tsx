'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  calorActualPerZona,
  indexCalorCarro,
  indexEquilibri,
  type CarroTermic,
  type ZonaMS as ZonaTermic,
} from '@/lib/termico'

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

interface PendingMove {
  assignacioId: number
  incIdDesti: number
  posDesti: number
  zonaDesti: 'central' | 'paret' | 'pulsator' | null
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

// Gradient blau (fred) → vermell (calent) per a la capa tèrmica visual.
// t=0 → blau fosc; t=1 → vermell fosc. Escala global (maxCalor = màxim de tots els carros).
function heatColor(calor: number, maxCalor: number): { bg: string; text: string; border: string } {
  if (maxCalor <= 0 || calor <= 0) return { bg: '#1e2030', text: '#666', border: '#2a2c35' }
  const t = Math.min(1, calor / maxCalor)
  // Hue: 230 (blau) → 0 (vermell)
  const hue = Math.round(230 * (1 - t))
  const sat = Math.round(55 + 25 * t)
  const light = Math.round(16 + 14 * Math.sin(Math.PI * t)) // pic de lluentor al mig
  const bg = `hsl(${hue}, ${sat}%, ${light}%)`
  const textLight = Math.round(60 + 25 * t)
  const text = `hsl(${hue}, 15%, ${textLight}%)`
  const border = `hsl(${hue}, ${sat}%, ${light + 10}%)`
  return { bg, text, border }
}

function fmtCalor(calor: number): string {
  if (calor <= 0) return '—'
  if (calor >= 1000) return `${(calor / 1000).toFixed(1)}k`
  return Math.round(calor).toString()
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
// Helper: aplica un moviment localment a una còpia de l'estat
// ───────────────────────────────────────────────────────────────────

function aplicarMoureLocal(
  e: Estat,
  assignacioId: number,
  incIdDesti: number,
  posDesti: number,
  zonaDesti: 'central' | 'paret' | 'pulsator' | null
): Estat {
  const nou = JSON.parse(JSON.stringify(e)) as Estat
  let carroMogut: CarroInc | null = null
  for (const inc of nou.incubadores) {
    const idx = inc.carros.findIndex((c) => c.assignacio_id === assignacioId)
    if (idx >= 0) {
      carroMogut = inc.carros.splice(idx, 1)[0]
      break
    }
  }
  if (!carroMogut) return nou
  carroMogut.posicio = posDesti
  carroMogut.zona = zonaDesti
  const incDesti = nou.incubadores.find((i) => i.id === incIdDesti)
  if (incDesti) incDesti.carros.push(carroMogut)
  return nou
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
  // Calor per posició i total de la incubadora
  const maxCalorGlobal = edicio?.maxCalorGlobal ?? 0
  const calorPerPosicio = new Map<number, number>()
  let totalCalorInc = 0
  inc.carros.forEach((c) => {
    if (c.posicio !== null && c.setmanes_lot !== null && c.dia_incubacio !== null) {
      const cal = indexCalorCarro(c.quantitat_ous, c.setmanes_lot, c.dia_incubacio)
      calorPerPosicio.set(c.posicio, cal)
      totalCalorInc += cal
    }
  })

  return (
    <div style={cardStyle}>
      <HeaderTargeta numero={inc.numero} tipus="Singlestage" model={inc.model} ocupats={inc.carros.length} capacitat={inc.capacitat} totalCalor={totalCalorInc} maxCalorTotalInc={edicio?.maxCalorTotalInc} />

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
            const calCell = carro ? (calorPerPosicio.get(posicio) ?? 0) : 0
            const c = carro ? heatColor(calCell, maxCalorGlobal) : colorOcupat()
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
// Capa tèrmica: barres de calor per zona dins d'una MS
// ───────────────────────────────────────────────────────────────────

function BarresCalorZones({ carros }: { carros: CarroInc[] }) {
  // Converteix els CarroInc a CarroTermic, ometent els que no tinguin dades
  const carrosTermics: CarroTermic[] = carros
    .filter((c) => c.zona !== null && c.dia_incubacio !== null && c.setmanes_lot !== null)
    .map((c) => ({
      zona: c.zona as ZonaTermic,
      quantitat_ous: c.quantitat_ous,
      setmanes_lot: c.setmanes_lot!,
      dia_incubacio: c.dia_incubacio!,
    }))

  if (carrosTermics.length === 0) return null

  const calors = calorActualPerZona(carrosTermics)
  const equilibri = indexEquilibri(carrosTermics)
  const maxCalor = Math.max(calors.central, calors.paret, calors.pulsator, 1)

  const zones: { key: ZonaTermic; label: string; accent: string }[] = [
    { key: 'central', label: 'Central', accent: '#27ae60' },
    { key: 'paret',   label: 'Paret',   accent: '#3498db' },
    { key: 'pulsator',label: 'Pulsator',accent: '#e74c3c' },
  ]

  const equilibriColor =
    equilibri >= 0.85 ? '#27ae60'
    : equilibri >= 0.65 ? '#e67e22'
    : '#c0392b'

  return (
    <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.6rem', background: '#10121a', borderRadius: '6px', border: '1px solid #1e2030' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.58rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
          Calor metabòlica
        </span>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: equilibriColor, fontFamily: 'IBM Plex Mono, monospace' }}>
          ⚖ {Math.round(equilibri * 100)}%
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {zones.map(({ key, label, accent }) => {
          const val = calors[key]
          const pct = maxCalor > 0 ? val / maxCalor : 0
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.55rem', color: accent, width: '46px', textAlign: 'right', flexShrink: 0 }}>{label}</span>
              <div style={{ flex: 1, height: '6px', background: '#1e2030', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.round(pct * 100)}%`,
                  height: '100%',
                  background: accent,
                  opacity: 0.75,
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', width: '30px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>
                {Math.round(pct * 100)}%
              </span>
            </div>
          )
        })}
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
  // Calor per assignació i total de la incubadora
  const maxCalorGlobal = edicio?.maxCalorGlobal ?? 0
  const calorPerAssignacio = new Map<number, number>()
  let totalCalorInc = 0
  inc.carros.forEach((c) => {
    if (c.setmanes_lot !== null && c.dia_incubacio !== null) {
      const cal = indexCalorCarro(c.quantitat_ous, c.setmanes_lot, c.dia_incubacio)
      calorPerAssignacio.set(c.assignacio_id, cal)
      totalCalorInc += cal
    }
  })

  // Per MSG: dividir cada zona en costat esq (pos 1-4) i dre (pos 5-8)
  const esMSG = inc.capacitat === 24
  const zonesESQ: Record<'central'|'paret'|'pulsator', CarroInc[]> = { central: [], paret: [], pulsator: [] }
  const zonesDRE: Record<'central'|'paret'|'pulsator', CarroInc[]> = { central: [], paret: [], pulsator: [] }
  if (esMSG) {
    inc.carros.forEach((c) => {
      if (!c.zona) return
      const z = c.zona as 'central'|'paret'|'pulsator'
      if (c.posicio !== null && c.posicio >= 1 && c.posicio <= 4) zonesESQ[z].push(c)
      else if (c.posicio !== null && c.posicio >= 5 && c.posicio <= 8) zonesDRE[z].push(c)
    })
  }

  const mostraRotar = edicio?.actiu === true && inc.capacitat === 24
  const pulsatorBuit = zones.pulsator.length === 0
  const hiHaPending = (edicio?.pendingCount ?? 0) > 0
  return (
    <div style={cardStyle}>
      <HeaderTargeta numero={inc.numero} tipus="Multistage" model={inc.model} ocupats={inc.carros.length} capacitat={inc.capacitat} totalCalor={totalCalorInc} maxCalorTotalInc={edicio?.maxCalorTotalInc} />

      {mostraRotar && (
        <div style={{ marginTop: '0.4rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              if (!pulsatorBuit || hiHaPending) return
              if (!confirm(`Rotar zones d'aquesta MS?\nparet (${zones.paret.length}) -> pulsator\ncentral (${zones.central.length}) -> paret\nCentral quedara buit.`)) return
              edicio!.onRotar(inc.id)
            }}
            disabled={!pulsatorBuit || hiHaPending}
            title={
              hiHaPending
                ? 'Confirma o descarta els canvis pendents abans de rotar'
                : pulsatorBuit
                ? 'Rotar paret->pulsator i central->paret'
                : 'Pulsator no esta buit: cal transferir o moure aquests carros primer'
            }
            style={{
              background: (!pulsatorBuit || hiHaPending) ? 'transparent' : '#1f2933',
              border: '1px solid ' + ((!pulsatorBuit || hiHaPending) ? 'var(--border)' : 'var(--accent)'),
              color: (!pulsatorBuit || hiHaPending) ? 'var(--text-dim)' : 'var(--accent)',
              padding: '0.25rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              cursor: (!pulsatorBuit || hiHaPending) ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            Rotar zones
          </button>
        </div>
      )}

      {esMSG ? (
        /* MSG: layout físic 2 costats */
        <div style={{ marginTop: '0.75rem' }}>
          {/* Capçaleres de columna */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 16px 1fr 1fr 1fr',
            gap: '0 3px',
            marginBottom: '0.25rem',
            fontSize: '0.48rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            textAlign: 'center',
            fontFamily: 'IBM Plex Mono, monospace',
            fontWeight: 700,
          }}>
            <div style={{ color: '#3498db' }}>Paret</div>
            <div style={{ color: '#27ae60' }}>Ctral</div>
            <div style={{ color: '#e74c3c' }}>Puls</div>
            <div />
            <div style={{ color: '#e74c3c' }}>Puls</div>
            <div style={{ color: '#27ae60' }}>Ctral</div>
            <div style={{ color: '#3498db' }}>Paret</div>
          </div>
          {/* Subetiqueta ESQ / DRE */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 16px 1fr 1fr 1fr',
            gap: '0 3px',
            marginBottom: '0.3rem',
            fontSize: '0.44rem',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            textAlign: 'center',
            fontFamily: 'IBM Plex Mono, monospace',
          }}>
            <div>esq</div><div>esq</div><div>esq</div>
            <div />
            <div>dre</div><div>dre</div><div>dre</div>
          </div>
          {/* Grid 7 columnes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 16px 1fr 1fr 1fr', gap: '0.25rem 3px', alignItems: 'start' }}>
            <ColumnaZona titol="Paret esq" carros={zonesESQ.paret} accent="#3498db" inc={inc} zona="paret" costat="esq" edicio={edicio} sub={sub} calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} />
            <ColumnaZona titol="Central esq" carros={zonesESQ.central} accent="#27ae60" inc={inc} zona="central" costat="esq" edicio={edicio} sub={sub} calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} />
            <ColumnaZona titol="Pulsator esq" carros={zonesESQ.pulsator} accent="#e74c3c" inc={inc} zona="pulsator" costat="esq" edicio={edicio} sub={sub} calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} />
            {/* Separador pulsator central */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#2a2c35', borderRadius: '4px', minHeight: '80px',
              color: '#666', fontSize: '0.85rem', fontWeight: 900, userSelect: 'none',
              writingMode: 'vertical-rl',
              letterSpacing: '0.1em',
            }}>
              ×
            </div>
            <ColumnaZona titol="Pulsator dre" carros={zonesDRE.pulsator} accent="#e74c3c" inc={inc} zona="pulsator" costat="dre" edicio={edicio} sub={sub} calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} />
            <ColumnaZona titol="Central dre" carros={zonesDRE.central} accent="#27ae60" inc={inc} zona="central" costat="dre" edicio={edicio} sub={sub} calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} />
            <ColumnaZona titol="Paret dre" carros={zonesDRE.paret} accent="#3498db" inc={inc} zona="paret" costat="dre" edicio={edicio} sub={sub} calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} />
          </div>
        </div>
      ) : (
        /* MSP: layout simple 3 columnes */
        <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
          <ColumnaZona titol="Central" calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} carros={zones.central} accent="#27ae60" inc={inc} zona="central" edicio={edicio} sub={sub} />
          <ColumnaZona titol="Paret" calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} carros={zones.paret} accent="#3498db" inc={inc} zona="paret" edicio={edicio} sub={sub} />
          <ColumnaZona titol="Pulsator" calorPerAssignacio={calorPerAssignacio} maxCalorGlobal={maxCalorGlobal} carros={zones.pulsator} accent="#e74c3c" inc={inc} zona="pulsator" edicio={edicio} sub={sub} />
        </div>
      )}

      <BarresCalorZones carros={inc.carros} />

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

function ColumnaZona({ titol, carros, accent, inc, zona, costat, edicio, sub, calorPerAssignacio, maxCalorGlobal }: { titol: string; carros: CarroInc[]; accent: string; inc?: Incubadora; zona?: 'central'|'paret'|'pulsator'; costat?: 'esq'|'dre'; edicio?: ContextEdicio; sub?: SubTipus; calorPerAssignacio?: Map<number, number>; maxCalorGlobal?: number }) {
  const acceptaDrop = edicio?.actiu && inc && zona && sub && edicio.subTipusArrossegat === sub
  // Per MSG amb costat definit: max 4 per semibanda. MSP o sense costat: límit per zona completa.
  const maxPerColumna = costat !== undefined ? 4 : (inc && zona ? (inc.capacitat === 24 ? 8 : 4) : 4)
  const lliureEnZona = inc && zona ? (carros.length < maxPerColumna) : false
  return (
    <div
      style={{ background: '#1a1c25', borderRadius: '6px', padding: '0.4rem', minHeight: '80px', border: acceptaDrop && lliureEnZona ? '2px dashed ' + accent : '2px solid transparent', transition: 'border 0.1s' }}
      onDragOver={acceptaDrop && lliureEnZona ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } : undefined}
      onDrop={acceptaDrop && lliureEnZona && inc && zona && edicio ? (e) => {
        e.preventDefault()
        const aid = parseInt(e.dataTransfer.getData('assignacio_id'), 10)
        const pos = posicioLliureMSZona(inc, zona, costat)
        if (!Number.isFinite(aid) || pos === null) return
        edicio.onMoure(aid, inc.id, pos, zona)
      } : undefined}
    >
      <div style={{ fontSize: costat !== undefined ? '0.58rem' : '0.65rem', color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', fontWeight: 600, textAlign: costat !== undefined ? 'center' : 'left' }}>
        {costat === undefined ? `${titol} ` : ''}<span style={{ color: 'var(--text-dim)' }}>({carros.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {carros.length === 0 ? (
          <div style={{ fontSize: '0.65rem', color: '#444', textAlign: 'center', padding: '0.5rem 0' }}>—</div>
        ) : (
          carros.map((c) => <ChipCarro key={c.assignacio_id} carro={c} edicio={edicio} sub={sub} calor={calorPerAssignacio?.get(c.assignacio_id)} maxCalor={maxCalorGlobal} />)
        )}
      </div>
    </div>
  )
}

function ChipCarro({ carro, edicio, sub, calor, maxCalor }: { carro: CarroInc | CarroNx; edicio?: ContextEdicio; sub?: SubTipus; calor?: number; maxCalor?: number }) {
  const c = (calor !== undefined && maxCalor !== undefined && maxCalor > 0) ? heatColor(calor, maxCalor) : colorOcupat()
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

function HeaderTargeta({ numero, tipus, model, ocupats, capacitat, totalCalor, maxCalorTotalInc }: { numero: number; tipus: string; model: string | null; ocupats: number; capacitat: number; totalCalor?: number; maxCalorTotalInc?: number }) {
  const colorOcup = ocupacioColor(ocupats, capacitat)
  const tipusBadge = tipus === 'Singlestage' ? { bg: '#5d4037', txt: '#fff' } : tipus === 'Multistage' ? { bg: '#1565c0', txt: '#fff' } : { bg: '#2e7d32', txt: '#fff' }
  const heatPct = (totalCalor && maxCalorTotalInc && maxCalorTotalInc > 0) ? Math.round(totalCalor / maxCalorTotalInc * 100) : null

  return (
    <div>
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
      {totalCalor !== undefined && totalCalor > 0 && (
        <div style={{ marginTop: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Calor total</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'IBM Plex Mono, monospace' }}>{fmtCalor(totalCalor)}</span>
          </div>
          {heatPct !== null && (
            <div style={{ height: '4px', background: '#1e2030', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${heatPct}%`,
                height: '100%',
                background: `hsl(${Math.round(230 * (1 - heatPct / 100))}, 70%, 45%)`,
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </div>
      )}
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
  pendingCount: number
  maxCalorGlobal: number      // màxim de calor d'un sol carro a totes les incubadores (per normalitzar colors)
  maxCalorTotalInc: number  // màxim de calor total d'una incubadora (per la barra comparativa)
  // Subtipus del carro en curs d'arrossegament (per pintar drop targets vàlids)
  subTipusArrossegat: SubTipus | null
  setSubTipusArrossegat: (s: SubTipus | null) => void
  // Acumula el moviment localment (sense API)
  onMoure: (assignacioId: number, incIdDesti: number, posDesti: number, zonaDesti: 'central'|'paret'|'pulsator'|null) => void
  // Crida POST /api/instalacions/rotar-zones/[inc_id] (nomes MS grans amb pulsator buit)
  onRotar: (incId: number) => void
}

// Trobar la posició lliure mínima d'una zona MS dins una incubadora destí.
// Per MSG (cap=24) amb costat definit: 'esq' cerca en pos 1-4, 'dre' en 5-8.
function posicioLliureMSZona(inc: Incubadora, zona: 'central'|'paret'|'pulsator', costat?: 'esq'|'dre'): number | null {
  if (inc.capacitat === 24 && costat) {
    const rangeMin = costat === 'esq' ? 1 : 5
    const rangeMax = costat === 'esq' ? 4 : 8
    const ocupades = new Set(inc.carros.filter(c => c.zona === zona && c.posicio !== null).map(c => c.posicio as number))
    for (let p = rangeMin; p <= rangeMax; p++) if (!ocupades.has(p)) return p
    return null
  }
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
  const [estatLocal, setEstatLocal] = useState<Estat | null>(null)
  const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmant, setConfirmant] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modeEdicio, setModeEdicio] = useState(false)
  const [subTipusArrossegat, setSubTipusArrossegat] = useState<SubTipus | null>(null)
  const [missatgeEdicio, setMissatgeEdicio] = useState<string>('')

  // Calor màxima per carro (per normalitzar colors) i per incubadora total (per barra comparativa)
  const { maxCalorGlobal, maxCalorTotalInc } = useMemo(() => {
    const er = estatLocal ?? estat
    if (!er) return { maxCalorGlobal: 0, maxCalorTotalInc: 0 }
    let maxCarro = 0
    let maxInc = 0
    for (const inc of er.incubadores) {
      let totalInc = 0
      for (const c of inc.carros) {
        if (c.setmanes_lot === null || c.dia_incubacio === null) continue
        const cal = indexCalorCarro(c.quantitat_ous, c.setmanes_lot, c.dia_incubacio)
        if (cal > maxCarro) maxCarro = cal
        totalInc += cal
      }
      if (totalInc > maxInc) maxInc = totalInc
    }
    return { maxCalorGlobal: maxCarro, maxCalorTotalInc: maxInc }
  }, [estatLocal, estat])

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
        setEstatLocal(JSON.parse(JSON.stringify(data)))
        setPendingMoves([])
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

  // ── Acumula moviment localment, sense fer cap crida API
  const onMoureCarro = useCallback((
    assignacioId: number,
    incIdDesti: number,
    posDesti: number,
    zonaDesti: 'central' | 'paret' | 'pulsator' | null
  ) => {
    setEstatLocal((prev) =>
      prev ? aplicarMoureLocal(prev, assignacioId, incIdDesti, posDesti, zonaDesti) : prev
    )
    setPendingMoves((prev) => [...prev, { assignacioId, incIdDesti, posDesti, zonaDesti }])
  }, [])

  // ── Confirmar: envia tots els moviments (deduplicats) i refresca
  const onConfirmarCanvis = useCallback(async () => {
    if (pendingMoves.length === 0) return
    setConfirmant(true)
    setMissatgeEdicio('')

    // Deduplicació: per cada assignacioId, queda només el darrer moviment
    const movesMap: Record<number, PendingMove> = {}
    pendingMoves.forEach((m) => { movesMap[m.assignacioId] = m })
    const movesDeduplicats = Object.values(movesMap)

    const errors: string[] = []
    await Promise.all(
      movesDeduplicats.map(async ({ assignacioId, incIdDesti, posDesti, zonaDesti }) => {
        try {
          const res = await fetch(`/api/assignacions/${assignacioId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ incubadora_id: incIdDesti, posicio: posDesti, zona: zonaDesti }),
          })
          const data = await res.json()
          if (!res.ok) errors.push(data.error || res.statusText)
        } catch (e) {
          errors.push(String(e))
        }
      })
    )

    setConfirmant(false)
    if (errors.length > 0) {
      setMissatgeEdicio('Errors: ' + errors.join(', '))
      // Recarrega igualment per tenir l'estat real de la BD
      carregar()
    } else {
      setMissatgeEdicio(`✓ ${movesDeduplicats.length} canvi(s) guardats`)
      carregar()
    }
  }, [pendingMoves, carregar])

  // ── Descartar: torna a l'estat de la darrera càrrega de la BD
  const onDescartarCanvis = useCallback(() => {
    if (estat) setEstatLocal(JSON.parse(JSON.stringify(estat)))
    setPendingMoves([])
    setMissatgeEdicio('')
  }, [estat])

  // ── Toggle mode edició: si hi ha canvis pendents, pregunta
  const toggleEdicio = useCallback(() => {
    if (modeEdicio && pendingMoves.length > 0) {
      if (!confirm(`Hi ha ${pendingMoves.length} canvi(s) sense confirmar. Vols descartar-los i tancar l'edició?`)) return
      onDescartarCanvis()
    }
    setModeEdicio((v) => !v)
    setMissatgeEdicio('')
  }, [modeEdicio, pendingMoves.length, onDescartarCanvis])

  // Mode edicio: handler de rotacio manual de zones (MS gran)
  const onRotarInc = useCallback(async (incId: number) => {
    setMissatgeEdicio('')
    try {
      const res = await fetch(`/api/instalacions/rotar-zones/${incId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        const motiu = (data && typeof data === 'object' && 'motiu' in data) ? String((data as { motiu: unknown }).motiu) : (data?.error ?? res.statusText)
        setMissatgeEdicio('Error rotant: ' + motiu)
        return
      }
      const np = (data && typeof data === 'object' && 'paret_a_pulsator' in data) ? (data as { paret_a_pulsator: number }).paret_a_pulsator : 0
      const nc = (data && typeof data === 'object' && 'central_a_paret' in data) ? (data as { central_a_paret: number }).central_a_paret : 0
      setMissatgeEdicio(`Rotades zones (${np} paret->pulsator, ${nc} central->paret)`)
      carregar()
    } catch (e) {
      setMissatgeEdicio('Error xarxa: ' + String(e))
    }
  }, [carregar])

  const ctxEdicio: ContextEdicio = {
    actiu: modeEdicio,
    pendingCount: pendingMoves.length,
    maxCalorGlobal,
    maxCalorTotalInc,
    subTipusArrossegat,
    setSubTipusArrossegat,
    onMoure: onMoureCarro,
    onRotar: onRotarInc,
  }

  // Usem l'estat local (amb els moviments pendents aplicats) per al render
  const estatRender = estatLocal ?? estat

  // Totals globals
  const totalCarrosInc = estatRender?.incubadores.reduce((s, i) => s + i.carros.length, 0) ?? 0
  const totalCapacitatInc = estatRender?.incubadores.reduce((s, i) => s + i.capacitat, 0) ?? 0
  const totalCarrosNx = estatRender?.naixedores.reduce((s, n) => s + n.carros.length, 0) ?? 0
  const totalCapacitatNx = estatRender?.naixedores.reduce((s, n) => s + n.capacitat, 0) ?? 0

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

        {estatRender && !loading && (
          <>
            {/* Resum global + toggle edició */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <KpiBox titol="Incubadores" valor={`${totalCarrosInc}/${totalCapacitatInc}`} subtitol={`${estatRender.incubadores.length} màquines`} />
              <KpiBox titol="Naixedores" valor={`${totalCarrosNx}/${totalCapacitatNx}`} subtitol={`${estatRender.naixedores.length} màquines`} />
              <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {/* Botó Editar / Tancar edició */}
                <button
                  onClick={toggleEdicio}
                  style={{
                    background: modeEdicio ? '#c0392b' : 'var(--surface)',
                    border: '1px solid ' + (modeEdicio ? '#c0392b' : 'var(--border)'),
                    color: modeEdicio ? '#fff' : 'var(--text)',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {modeEdicio ? '✕ Tancar edició' : '✎ Editar'}
                </button>

                {/* Botons de canvis pendents */}
                {modeEdicio && pendingMoves.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#f0b429', fontWeight: 600 }}>
                      {pendingMoves.length} canvi(s) sense guardar
                    </span>
                    <button
                      onClick={onDescartarCanvis}
                      disabled={confirmant}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text-dim)',
                        padding: '0.3rem 0.7rem',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      Descartar
                    </button>
                    <button
                      onClick={onConfirmarCanvis}
                      disabled={confirmant}
                      style={{
                        background: confirmant ? '#1a3a1a' : '#1e4620',
                        border: '1px solid #27ae60',
                        color: '#86efac',
                        padding: '0.3rem 0.9rem',
                        borderRadius: '5px',
                        cursor: confirmant ? 'wait' : 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {confirmant ? 'Guardant...' : `✓ Confirmar ${pendingMoves.length} canvi(s)`}
                    </button>
                  </div>
                )}

                {modeEdicio && pendingMoves.length === 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', maxWidth: 240, textAlign: 'right' }}>
                    Arrossega els carros a una cel·la lliure del mateix tipus. SS↔SS, MSG↔MSG, MSP↔MSP.
                  </div>
                )}
                {missatgeEdicio && (
                  <div style={{ fontSize: '0.7rem', color: missatgeEdicio.startsWith('Error') ? '#ffb3b3' : '#86efac', maxWidth: 280, textAlign: 'right' }}>
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
                {estatRender.incubadores.map((inc) =>
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
                {estatRender.naixedores.map((nx) => (
                  <TargetaNaixedora key={nx.id} nx={nx} />
                ))}
              </div>
            </section>

            <p style={{ marginTop: '2rem', fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'center' }}>
              Generat: {new Date(estat!.generat_a).toLocaleString('ca-ES')}
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
