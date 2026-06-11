'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Carro {
  id: number
  posta: string
  quantitat_ous: number
  estat: string
  recepcio: string
  lots_reproductores: {
    id: number
    data_naixement: string
    estirp: string | null
    granges_reproductores: {
      granja: string
      nom_informal: string | null
    }
  }
}

interface Grup {
  lot_id: number
  posta: string
  quantitat_ous: number
  nom: string
  recepcio: string
  carros: Carro[]
}

function nomCarro(carro: Carro) {
  const lot = carro.lots_reproductores
  if (!lot) return `Carro #${carro.id}`
  const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
  const estirp = lot.estirp ? ` ${lot.estirp}` : ''
  return `${granja}${estirp}`
}

export default function Estoc() {
  const [carros, setCarros] = useState<Carro[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmant, setConfirmant] = useState<string | null>(null)
  const [eliminant, setEliminant] = useState<string | null>(null)

  const carregarCarros = useCallback(() => {
    setLoading(true)
    fetch('/api/carros')
      .then(r => r.json())
      .then(data => { setCarros(data); setLoading(false) })
  }, [])

  useEffect(() => { carregarCarros() }, [carregarCarros])

  const grupsMapa = carros.reduce((acc, carro) => {
    const key = `${carro.lots_reproductores?.id}-${carro.posta}-${carro.quantitat_ous}`
    if (!acc[key]) {
      acc[key] = {
        lot_id: carro.lots_reproductores?.id,
        posta: carro.posta,
        quantitat_ous: carro.quantitat_ous,
        nom: nomCarro(carro),
        recepcio: carro.recepcio,
        carros: [],
      }
    }
    acc[key].carros.push(carro)
    return acc
  }, {} as Record<string, Grup>)

  const lotsMap = new Map<number, { nom: string; grups: Grup[] }>()
  Object.values(grupsMapa).forEach(grup => {
    if (!lotsMap.has(grup.lot_id)) {
      lotsMap.set(grup.lot_id, { nom: grup.nom, grups: [] })
    }
    lotsMap.get(grup.lot_id)!.grups.push(grup)
  })

  const lots = Array.from(lotsMap.entries())
    .map(([lot_id, { nom, grups }]) => ({
      lot_id,
      nom,
      grups: [...grups].sort((a, b) => a.posta.localeCompare(b.posta)),
    }))
    .sort((a, b) => a.grups[0].posta.localeCompare(b.grups[0].posta))

  async function eliminarUn(grup: Grup) {
    const key = `${grup.lot_id}-${grup.posta}`
    setEliminant(key)
    try {
      const res = await fetch('/api/carros', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: grup.lot_id, posta: grup.posta, quantitat_ous: grup.quantitat_ous }),
      })
      if (res.ok) carregarCarros()
    } finally {
      setEliminant(null)
      setConfirmant(null)
    }
  }

  return (
    <main className="bg-bg min-h-screen p-6">
      <div className="max-w-[1200px] mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text-dim no-underline text-[1.25rem]">←</Link>
            <div>
              <p className="text-accent font-mono text-[0.7rem] tracking-[0.15em] uppercase m-0">Estoc</p>
              <h1 className="text-[1.4rem] font-bold m-0">Carros disponibles</h1>
            </div>
          </div>
          <Link href="/recepcio" className="no-underline">
            <button className="bg-accent text-[#0f1117] border-none rounded-lg px-4 py-[0.6rem] font-bold text-[0.85rem] cursor-pointer font-sans">
              + Recepció
            </button>
          </Link>
        </div>

        {loading && (
          <p className="text-text-dim font-mono text-[0.85rem] text-center py-8">Carregant...</p>
        )}
        {!loading && carros.length === 0 && (
          <p className="text-text-dim font-mono text-[0.85rem] text-center py-8">No hi ha carros disponibles</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lots.map(lot => (
            <div key={lot.lot_id}>
              <div className="text-text-dim font-mono text-[0.7rem] tracking-[0.12em] uppercase mb-2 px-1">
                {lot.nom}
              </div>
              <div className="flex flex-col gap-2">
                {lot.grups.map(grup => {
                  const key = `${grup.lot_id}-${grup.posta}`
                  const estaConfirmant = confirmant === key
                  const estaEliminant = eliminant === key

                  return (
                    <div key={key} className="bg-surface border border-border rounded-[10px] px-5 py-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-text-dim text-[0.8rem] font-mono">
                            posta {grup.posta} · {grup.quantitat_ous} ous/carro
                          </div>
                          <div className="text-text-dim text-[0.75rem] font-mono mt-[0.15rem]">
                            rebut {grup.recepcio}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {!estaConfirmant ? (
                            <button
                              onClick={() => setConfirmant(key)}
                              className="w-9 h-9 border border-border rounded-lg bg-transparent text-text-dim text-[0.85rem] cursor-pointer font-mono"
                            >
                              −1
                            </button>
                          ) : (
                            <div className="flex gap-[0.4rem]">
                              <button
                                onClick={() => setConfirmant(null)}
                                className="px-[0.6rem] py-[0.4rem] border border-border rounded-md bg-transparent text-text-dim text-[0.75rem] cursor-pointer font-sans"
                              >
                                Cancel·lar
                              </button>
                              <button
                                onClick={() => eliminarUn(grup)}
                                disabled={!!estaEliminant}
                                className="px-[0.6rem] py-[0.4rem] border border-danger rounded-md bg-danger/10 text-danger text-[0.75rem] font-bold cursor-pointer font-sans"
                              >
                                {estaEliminant ? '...' : 'Eliminar'}
                              </button>
                            </div>
                          )}
                          <div className="bg-accent/15 border border-accent rounded-[20px] px-[0.875rem] py-[0.35rem] text-accent font-mono text-base font-bold min-w-[2.5rem] text-center">
                            {grup.carros.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {!loading && carros.length > 0 && (
          <div className="mt-6 p-4 bg-surface border border-border rounded-[10px] flex justify-between items-center">
            <span className="text-text-dim text-[0.85rem] font-mono">Total disponibles</span>
            <span className="font-mono font-bold text-[1.1rem] text-success">{carros.length} carros</span>
          </div>
        )}

      </div>
    </main>
  )
}
