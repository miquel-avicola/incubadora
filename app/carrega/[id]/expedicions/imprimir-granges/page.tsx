'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatData, diaSemana, calcularNaixement } from '@/lib/dates'

interface Expedicio {
  id: number
  ordre: number | null
  pollets_comanda: number | null
  pollets_servits: number | null
  sexe: string | null
  comandes: { id: number; tipus: string; clients: { id: number; nom: string } }
  destinacions: {
    id: number
    nom_granja: string
    nau: string | null
    poblacio: string | null
    codi_rega: string | null
    telefon: string | null
    sexe: string | null
  }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
}

function etiquetaSexe(sexe: string | null) {
  if (sexe === 'F') return '♀'
  if (sexe === 'M') return '♂'
  return ''
}

export default function ImprimirGranges() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [expedicions, setExpedicions] = useState<Expedicio[]>([])
  const [loading, setLoading] = useState(true)

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    try {
      const [fullRes, expRes] = await Promise.all([
        fetch(`/api/carrega/${params.id}`).then(r => r.json()),
        fetch(`/api/carrega/${params.id}/expedicions`).then(r => r.json()),
      ])
      setFull(fullRes)
      setExpedicions(Array.isArray(expRes) ? expRes : [])
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  // Llença la impressió un cop carregat
  useEffect(() => {
    if (!loading && full && expedicions) {
      setTimeout(() => window.print(), 500)
    }
  }, [loading, full, expedicions])

  if (loading || !full) return <div style={{ padding: '2rem', fontFamily: 'monospace' }}>Carregant dades per imprimir...</div>

  // Agrupar per client, mantenint l'ordre de l'expedició dins de cada grup
  const grupsMap = new Map<string, { client: string; exps: Expedicio[] }>()
  for (const e of expedicions) {
    const client = e.comandes?.clients?.nom || 'Sense client'
    if (!grupsMap.has(client)) grupsMap.set(client, { client, exps: [] })
    grupsMap.get(client)!.exps.push(e)
  }
  const grups = Array.from(grupsMap.values()).sort((a, b) => a.client.localeCompare(b.client))
  grups.forEach(g => g.exps.sort((a, b) => (a.ordre || 99) - (b.ordre || 99)))

  const fmt = (n: number | null) => (n != null && n > 0 ? n.toLocaleString('ca') : '—')

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        /* Forcem colors foscos sobre fons blanc també en pantalla:
           la pàgina es renderitza dins del layout fosc de l'app i, si no,
           el text clar heretat del tema queda gairebé invisible. */
        .full-granges { background: #fff; color: #111; }
        .full-granges h1, .full-granges h2, .full-granges strong, .full-granges p, .full-granges th, .full-granges td { color: #111; }
        .full-granges .subtle { color: #555; }
        .full-granges .meta { color: #666; }
        .full-granges table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.85rem; }
        .full-granges th, .full-granges td { border: 1px solid #ccc; padding: 7px 8px; text-align: left; }
        .full-granges th { background-color: #f0f0f0; font-weight: 600; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; font-size: 0.7rem; }
        .full-granges td.num { text-align: right; font-family: 'IBM Plex Mono', monospace; }
        @media print {
          @page { margin: 10mm; size: A4 portrait; }
          body { background: white !important; }
          .full-granges { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .full-granges h2 { break-after: avoid; }
          .full-granges tr { break-inside: avoid; }
        }
      `}} />
      <div className="full-granges" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>

        {/* Header imprès */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Full d&apos;Expedicions per Granja</h1>
            <p className="subtle" style={{ margin: '0.25rem 0 0 0' }}>
              Càrrega #{full.num_carrega}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', textAlign: 'center', fontSize: '0.8rem' }}>
            {[
              { label: 'Càrrega', data: full.carrega },
              { label: 'Transferència', data: full.transferencia },
              { label: 'Naixement', data: calcularNaixement(full.carrega) },
            ].map(({ label, data }) => (
              <div key={label}>
                <div className="meta" style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</div>
                <div style={{ fontWeight: 700 }}>{data ? formatData(data) : '—'}</div>
                <div className="subtle" style={{ fontSize: '0.7rem' }}>{data ? diaSemana(data) : ''}</div>
              </div>
            ))}
          </div>
        </div>

        {expedicions.length === 0 && (
          <p className="meta">Sense expedicions per imprimir.</p>
        )}

        {grups.map(g => (
          <div key={g.client} style={{ marginBottom: '1.75rem' }}>
            <h2 style={{ fontSize: '1.05rem', borderBottom: '1px solid #ccc', paddingBottom: '0.4rem', marginBottom: '0.25rem' }}>
              Client: <strong>{g.client}</strong>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Granja</th>
                  <th style={{ width: '60px' }}>Nau</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Pollets prev.</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>Pollets reals</th>
                  <th style={{ width: '140px' }}>REGA</th>
                  <th style={{ width: '110px' }}>Telèfon</th>
                </tr>
              </thead>
              <tbody>
                {g.exps.map(e => {
                  const d = e.destinacions
                  const sexe = etiquetaSexe(e.sexe)
                  return (
                    <tr key={e.id}>
                      <td>
                        <strong>{d.nom_granja}</strong>
                        {sexe && <span style={{ marginLeft: '4px' }}>{sexe}</span>}
                        {d.poblacio ? <div className="subtle" style={{ fontSize: '0.72rem' }}>{d.poblacio}</div> : null}
                      </td>
                      <td>{d.nau || '—'}</td>
                      <td className="num">{fmt(e.pollets_comanda)}</td>
                      <td className="num">{fmt(e.pollets_servits)}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.78rem' }}>{d.codi_rega || '—'}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.8rem' }}>{d.telefon || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

        <div className="no-print" style={{ marginTop: '3rem', textAlign: 'center' }}>
          <button onClick={() => window.print()} style={{ padding: '0.75rem 1.5rem', background: '#f0b429', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Imprimir ara
          </button>
        </div>

      </div>
    </>
  )
}
