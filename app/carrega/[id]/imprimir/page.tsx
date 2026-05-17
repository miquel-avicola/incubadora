'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatData, diaSemana, calcularNaixement } from '@/lib/dates'

interface AssignacioVacuna {
  dosi: number
  vacunes: { id: number; nom: string }
}

interface Transferencia {
  ous_explosius: number
  ous_fertils_vacunats: number
  naixedores: { numero: number }
  resultats_naix: { pollets_nascuts: number }[]
}

interface Assignacio {
  id: number
  num_carro_full: number
  carros_estoc: {
    posta: string
    quantitat_ous: number
    lots_reproductores: {
      estirp: string | null
      granges_reproductores: { granja: string; nom_informal: string | null }
    }
  }
  incubadores: { numero: number }
  assignacio_vacunes: AssignacioVacuna[]
  transferencies: Transferencia[]
}

interface Comanda {
  tipus: string
  quantitat_pollets: number | null
  sexat: boolean
  clients: { nom: string }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  comandes: Comanda[]
  assignacions: Assignacio[]
}

export default function ImprimirFull() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [loading, setLoading] = useState(true)

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const res = await fetch(`/api/carrega/${params.id}`)
    const data = await res.json()
    setFull(data)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  if (loading || !full) return (
    <div style={{ padding: '2rem', fontFamily: 'Arial', textAlign: 'center' }}>
      Carregant...
    </div>
  )

  const naixement = calcularNaixement(full.carrega)
  const assignacionsOrdenades = [...full.assignacions].sort((a, b) => a.num_carro_full - b.num_carro_full)
  const totalPollets = full.comandes.filter(c => c.tipus === 'Pollets').reduce((s, c) => s + (c.quantitat_pollets || 0), 0)
  const MAX_PER_COL = 22
  const colEsquerra = assignacionsOrdenades.slice(0, MAX_PER_COL)
  const colDreta = assignacionsOrdenades.slice(MAX_PER_COL, MAX_PER_COL * 2)
  const pad = (col: Assignacio[]) => [...col, ...Array.from<null>({ length: MAX_PER_COL - col.length }).fill(null)] as (Assignacio | null)[]
  const esquerra22 = pad(colEsquerra)
  const dreta22 = pad(colDreta)

  function nomGranja(a: Assignacio) {
    const lot = a.carros_estoc.lots_reproductores
    const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
    const estirp = lot.estirp ? ` ${lot.estirp}` : ''
    return `${granja}${estirp}`
  }

  function nomVacuna(a: Assignacio) {
    if (a.assignacio_vacunes.length === 0) return '—'
    return [...a.assignacio_vacunes]
      .sort((x, y) => x.vacunes.id - y.vacunes.id)
      .map(av => `${av.dosi === 0.5 ? '½' : '1'} ${av.vacunes.nom.split(' ')[0]}`)
      .join(' + ')
  }

  // Signatura del pla vacunal per agrupar carros amb el mateix pla
  function signaturaPla(av: AssignacioVacuna[]): string {
    if (av.length === 0) return ''
    return [...av]
      .sort((x, y) => x.vacunes.id - y.vacunes.id)
      .map(v => `${v.vacunes.id}|${v.dosi}`)
      .join('+')
  }

  // Paleta pastel: colors clars i diferenciables, neutres per a impressió
  const PALETA_PASTEL = ['#e8e1f5', '#d9f0e1', '#fbe6dc', '#d6e8f5', '#fdf0c8', '#f5dde8', '#e0eaf0', '#efe1cd']

  // Mapeig signatura -> color, ordenat per primera aparició a la llista
  const signaturesUniques: string[] = []
  assignacionsOrdenades.forEach(a => {
    const s = signaturaPla(a.assignacio_vacunes)
    if (s && !signaturesUniques.includes(s)) signaturesUniques.push(s)
  })
  const sigToColor: Record<string, string> = {}
  signaturesUniques.forEach((s, i) => { sigToColor[s] = PALETA_PASTEL[i % PALETA_PASTEL.length] })

  // Per a la llegenda: signatura -> nom llegible (un carro qualsevol del grup)
  const sigToNom: Record<string, string> = {}
  assignacionsOrdenades.forEach(a => {
    const s = signaturaPla(a.assignacio_vacunes)
    if (s && !sigToNom[s]) sigToNom[s] = nomVacuna(a)
  })

  const td = { border: '1px solid #ccc', padding: '2px 4px' }
  const tdC = { ...td, textAlign: 'center' as const }

  const filaCarro = (a: Assignacio | null, idx: number) => {
    if (!a) return (
      <tr key={`buit-${idx}`} style={{ background: idx % 2 === 0 ? 'white' : '#f5f5f5' }}>
        <td style={tdC} /><td style={td} /><td style={tdC} /><td style={tdC} />
        <td style={tdC} /><td style={tdC} /><td style={tdC} /><td style={tdC} /><td style={tdC} />
      </tr>
    )
    const t = a.transferencies[0]
    const transferit = !!t
    const nascut = transferit && t.resultats_naix.length > 0
    const sig = signaturaPla(a.assignacio_vacunes)
    const bgPla = sig ? sigToColor[sig] : 'white'
    return (
      <tr key={a.id} style={{ background: bgPla }}>
        <td style={tdC}>{a.num_carro_full}</td>
        <td style={td}>{nomGranja(a)}</td>
        <td style={tdC}>{a.incubadores.numero}</td>
        <td style={tdC}>{a.carros_estoc.posta.slice(5)}</td>
        <td style={{ ...tdC, fontSize: '8px' }}>{nomVacuna(a)}</td>
        <td style={{ ...tdC, color: transferit ? '#111' : '#ccc' }}>
          {transferit ? t.ous_explosius : ''}
        </td>
        <td style={{ ...tdC, color: transferit ? '#111' : '#ccc' }}>
          {transferit ? t.ous_fertils_vacunats.toLocaleString() : ''}
        </td>
        <td style={{ ...tdC, color: transferit ? '#111' : '#ccc' }}>
          {transferit ? `N${t.naixedores.numero}` : ''}
        </td>
        <td style={{ ...tdC, color: nascut ? '#111' : '#ccc' }}>
          {nascut ? t.resultats_naix[0].pollets_nascuts.toLocaleString() : ''}
        </td>
      </tr>
    )
  }

  const capcalera = (
    <thead>
      <tr style={{ background: '#222', color: 'white' }}>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'center' }}>C#</th>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'left' }}>Granja</th>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'center' }}>Inc</th>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'center' }}>Posta</th>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'center' }}>Vacuna</th>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'center' }}>Exp.</th>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'center' }}>Fèrtils</th>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'center' }}>Naix.</th>
        <th style={{ border: '1px solid #555', padding: '2px 4px', textAlign: 'center' }}>Pollets</th>
      </tr>
    </thead>
  )

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none !important; }
          .print-page { height: 100vh; padding: 0; }
        }
        body { font-family: Arial, sans-serif; font-size: 9px; color: #111; background: white; margin: 0; }
        table { border-collapse: collapse; width: 100%; }
        .print-page { display: flex; flex-direction: column; height: 190mm; padding: 8px 12px; box-sizing: border-box; }
        .print-tables { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .print-tables table { height: 100%; }
      `}</style>

      <div className="no-print" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', borderBottom: '1px solid #ddd', background: '#f9f9f9' }}>
        <button onClick={() => window.print()} style={{ padding: '0.4rem 0.9rem', background: '#222', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
          🖨️ Imprimir
        </button>
        <button onClick={() => window.history.back()} style={{ padding: '0.4rem 0.9rem', background: 'transparent', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
          ← Tornar
        </button>
        <span style={{ fontSize: '0.8rem', color: '#666' }}>Full #{full.num_carrega} — A4 horitzontal</span>
      </div>

      <div className="print-page">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px', borderBottom: '2px solid #111', paddingBottom: '3px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700 }}>Càrrega #{full.num_carrega}</div>
            <div style={{ fontSize: '7px', color: '#666', marginTop: '1px' }}>Miquel Avícola — Sala d'incubació</div>
          </div>
          <div style={{ display: 'flex', gap: '14px', fontSize: '9px', textAlign: 'center', alignItems: 'center' }}>
            {[
              { label: 'Càrrega', data: full.carrega },
              { label: 'Transferència', data: full.transferencia },
              { label: 'Naixement', data: naixement },
            ].map(({ label, data }) => (
              <div key={label}>
                <div style={{ fontSize: '7px', textTransform: 'uppercase', color: '#888', fontWeight: 700 }}>{label}</div>
                <div style={{ fontWeight: 700 }}>{data ? formatData(data) : '—'}</div>
                <div style={{ color: '#666' }}>{data ? diaSemana(data) : ''}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: '7px', textTransform: 'uppercase', color: '#888', fontWeight: 700 }}>Carros</div>
              <div style={{ fontWeight: 700, fontSize: '12px' }}>{full.assignacions.length}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '4px', fontSize: '9px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {full.comandes.filter(c => c.tipus === 'Pollets').map((c, i) => (
            <span key={i}><strong>{c.clients.nom}</strong>{c.sexat ? ' (sexat)' : ''}: {(c.quantitat_pollets || 0).toLocaleString()} pollets</span>
          ))}
          {totalPollets > 0 && <span style={{ marginLeft: 'auto', fontWeight: 700 }}>TOTAL: {totalPollets.toLocaleString()} pollets</span>}
        </div>

        <div className="print-tables">
          <table>{capcalera}<tbody>{esquerra22.map((a, i) => filaCarro(a, i))}</tbody></table>
          <table>{capcalera}<tbody>{dreta22.map((a, i) => filaCarro(a, i))}</tbody></table>
        </div>

        {signaturesUniques.length > 0 && (
          <div style={{ marginTop: '4px', fontSize: '7.5px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #ddd', paddingTop: '3px' }}>
            <span style={{ color: '#666', fontWeight: 700 }}>PLA VACUNAL:</span>
            {signaturesUniques.map(s => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: sigToColor[s], border: '1px solid #aaa' }} />
                <span>{sigToNom[s]}</span>
              </span>
            ))}
          </div>
        )}

        <div style={{ marginTop: '3px', fontSize: '7px', color: '#999', borderTop: '1px solid #ddd', paddingTop: '3px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Exp. = ous explosius · Fèrtils = ous fèrtils vacunats · Naix. = naixedora destí</span>
          <span>Imprès: {new Date().toLocaleDateString('ca-ES')}</span>
        </div>

      </div>
    </>
  )
}
