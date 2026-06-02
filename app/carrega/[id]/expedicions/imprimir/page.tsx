'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { formatData } from '@/lib/dates'

interface ExpedicioLot {
  pollets: number
  lots_reproductores: {
    estirp: string | null
    granges_reproductores: { granja: string; nom_informal: string | null }
  }
}

interface Expedicio {
  id: number
  comanda_id: number
  ordre: number | null
  pollets_comanda: number | null
  pollets_servits: number | null
  matricula: string | null
  hora_prevista_naixement: string | null
  observacions: string | null
  num_viatge: number | null
  sexe: string | null
  comandes: { id: number; tipus: string; clients: { id: number; nom: string } }
  destinacions: { id: number; nom_granja: string; nau: string | null; poblacio: string | null; sexe: string | null }
  transportistes: { id: number; nom: string } | null
  expedicio_lots: ExpedicioLot[]
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  distribucio_carros: Record<string, any> | null
}

export default function ImprimirExpedicions() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [expedicions, setExpedicions] = useState<Expedicio[]>([])
  const [loading, setLoading] = useState(true)
  const [distribucio, setDistribucio] = useState<any>({})

  // Helpers per accedir a la distribució d'una expedició
  function getGrupKey(e: Expedicio): string | null {
    if (!e.transportistes || e.num_viatge == null) return null
    return `${e.transportistes.id}_${e.num_viatge}`
  }

  function getDistExp(e: Expedicio) {
    const key = getGrupKey(e)
    if (!key || !distribucio[key]) return null
    return distribucio[key].per_expedicio[String(e.id)] ?? null
  }

  function getPolletsRealsOComanda(e: Expedicio) {
    return e.pollets_servits || getDistExp(e)?.pollets_reals || e.pollets_comanda || 0
  }

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    try {
      const [fullRes, expRes] = await Promise.all([
        fetch(`/api/carrega/${params.id}`).then(r => r.json()),
        fetch(`/api/carrega/${params.id}/expedicions`).then(r => r.json()),
      ])
      setFull(fullRes)
      setExpedicions(expRes)
      setDistribucio(fullRes?.distribucio_carros || {})
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

  // Agrupar expedicions per transportista / viatge si escau o llistar
  const transportistesData = Array.from(new Set(expedicions.map(e => e.transportistes?.nom || 'Sense Transportista')))

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 10mm; size: A4 portrait; }
          body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { background: white; color: black; font-family: 'IBM Plex Sans', sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.85rem; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: 600; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; font-size: 0.75rem; }
      `}} />
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
        
        {/* Header imprès */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Full de Repartiment de Pollets</h1>
            <p style={{ margin: '0.25rem 0 0 0', color: '#555' }}>
              Càrrega #{full.num_carrega} — {formatData(full.carrega)}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#666' }}>
            Data impressió: {new Date().toLocaleDateString('ca-ES')}
          </div>
        </div>

        {/* Taula General Expedicions */}
        {transportistesData.map(tNom => {
          const expsTransportista = expedicions.filter(e => (e.transportistes?.nom || 'Sense Transportista') === tNom)
          if (expsTransportista.length === 0) return null

          return (
            <div key={tNom} style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.1rem', borderBottom: '1px solid #ccc', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                Transportista: <strong>{tNom}</strong>
              </h2>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>Ordre</th>
                    <th>Destí</th>
                    <th>Client</th>
                    <th>Pollets (Final/Prev)</th>
                    <th>Repartiment (Carros)</th>
                    <th>Lots Origen</th>
                    <th>Hora</th>
                    <th>Matrícula</th>
                  </tr>
                </thead>
                <tbody>
                  {expsTransportista.sort((a,b) => (a.ordre || 99) - (b.ordre || 99)).map(e => (
                    <tr key={e.id}>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{e.ordre || '-'}</td>
                      <td>
                        <strong>{e.destinacions.nom_granja}</strong>
                        {e.destinacions.nau ? ` ${e.destinacions.nau}` : ''}
                        {e.destinacions.poblacio ? <div style={{ fontSize: '0.75rem', color: '#555' }}>{e.destinacions.poblacio}</div> : ''}
                      </td>
                      <td>{e.comandes?.clients?.nom}{e.comandes?.tipus === 'Maquila' ? ' (MAQUILA)' : ''}</td>
                      <td>
                        <strong>{getPolletsRealsOComanda(e) ? getPolletsRealsOComanda(e).toLocaleString() : '-'}</strong>
                        {e.sexe && <span style={{ marginLeft: '4px', fontSize: '0.8rem' }}>({e.sexe})</span>}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {(() => {
                          const dist = getDistExp(e)
                          if (!dist) return '-'
                          return `${dist.carros_sencers}c + ${dist.pico_caixes}cx${dist.en_carro_compartit ? ' *' : ''}`
                        })()}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: '#444' }}>
                        {e.expedicio_lots.length > 0 
                          ? e.expedicio_lots.map(el => {
                              const granja = el.lots_reproductores.granges_reproductores.nom_informal || el.lots_reproductores.granges_reproductores.granja
                              return granja
                            }).join(' + ')
                          : 'Sense assignar'
                        }
                      </td>
                      <td>{e.hora_prevista_naixement || '-'}</td>
                      <td>{e.matricula || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}

        <div className="no-print" style={{ marginTop: '3rem', textAlign: 'center' }}>
          <button onClick={() => window.print()} style={{ padding: '0.75rem 1.5rem', background: '#f0b429', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Imprimir ara
          </button>
        </div>
        
      </div>
    </>
  )
}
