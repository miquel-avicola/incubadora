'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Lot {
  id: number
  data_naixement: string
  estirp: string | null
  granges_reproductores: {
    granja: string
    nom_informal: string | null
  }
}

function nomLot(lot: Lot) {
  const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
  const estirp = lot.estirp ? ` ${lot.estirp}` : ''
  const data = lot.data_naixement
  return `${granja}${estirp} — nascut ${data}`
}

export default function Recepcio() {
  const [lots, setLots] = useState<Lot[]>([])
  const [lotId, setLotId] = useState('')
  const [posta, setPosta] = useState('')
  const [quantitat, setQuantitat] = useState('4800')
  const [nombreCarros, setNombreCarros] = useState('1')
  const [loading, setLoading] = useState(false)
  const [resultat, setResultat] = useState<{ ok: boolean; missatge: string } | null>(null)

  useEffect(() => {
    fetch('/api/lots')
      .then(r => r.json())
      .then(setLots)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResultat(null)

    try {
      const res = await fetch('/api/carros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lot_id: lotId, posta, quantitat_ous: quantitat, nombre_carros: nombreCarros }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResultat({ ok: false, missatge: data.error || 'Error desconegut' })
      } else {
        setResultat({ ok: true, missatge: `✓ ${data.created} carro${data.created > 1 ? 's' : ''} registrat${data.created > 1 ? 's' : ''} correctament` })
        setLotId('')
        setPosta('')
        setQuantitat('4800')
        setNombreCarros('1')
      }
    } catch {
      setResultat({ ok: false, missatge: 'Error de connexió' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="bg-bg min-h-screen p-6">
      <div className="max-w-[480px] mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/estoc" className="text-text-dim no-underline text-[1.25rem]">←</Link>
          <div>
            <p className="text-accent font-mono text-[0.7rem] tracking-[0.15em] uppercase m-0">
              Recepció
            </p>
            <h1 className="text-[1.4rem] font-bold m-0">Carros d&apos;ous</h1>
          </div>
        </div>

        {/* Formulari */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Lot */}
          <div>
            <label className="block text-[0.75rem] font-mono tracking-[0.1em] uppercase text-text-dim mb-2">
              Lot de reproductores
            </label>
            <select
              value={lotId}
              onChange={e => setLotId(e.target.value)}
              required
              className="w-full bg-surface border border-border rounded-lg px-4 py-[0.875rem] text-text text-base outline-none font-sans"
            >
              <option value="">Selecciona un lot...</option>
              {lots.map(lot => (
                <option key={lot.id} value={lot.id}>{nomLot(lot)}</option>
              ))}
            </select>
          </div>

          {/* Data de posta */}
          <div>
            <label className="block text-[0.75rem] font-mono tracking-[0.1em] uppercase text-text-dim mb-2">
              Data de posta
            </label>
            <input
              type="date"
              value={posta}
              onChange={e => setPosta(e.target.value)}
              required
              className="w-full bg-bg border border-border rounded-lg px-4 py-[0.875rem] text-text text-base outline-none font-sans"
            />
          </div>

          {/* Quantitat d'ous */}
          <div>
            <label className="block text-[0.75rem] font-mono tracking-[0.1em] uppercase text-text-dim mb-2">
              Ous per carro
            </label>
            <div className="flex gap-3">
              {['4800', '2400'].map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantitat(q)}
                  className={[
                    'flex-1 py-[0.875rem] border rounded-lg font-mono text-base font-semibold cursor-pointer',
                    quantitat === q
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-bg text-text-dim',
                  ].join(' ')}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre de carros */}
          <div>
            <label className="block text-[0.75rem] font-mono tracking-[0.1em] uppercase text-text-dim mb-2">
              Nombre de carros
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setNombreCarros(n => String(Math.max(1, parseInt(n) - 1)))}
                className="w-12 h-12 border border-border rounded-lg bg-bg text-text text-[1.5rem] cursor-pointer shrink-0"
              >−</button>
              <input
                type="number"
                value={nombreCarros}
                onChange={e => setNombreCarros(e.target.value)}
                min="1"
                max="20"
                required
                className="w-full bg-bg border border-border rounded-lg px-4 py-[0.875rem] text-text text-[1.5rem] font-bold text-center font-mono outline-none"
              />
              <button
                type="button"
                onClick={() => setNombreCarros(n => String(Math.min(20, parseInt(n) + 1)))}
                className="w-12 h-12 border border-border rounded-lg bg-bg text-text text-[1.5rem] cursor-pointer shrink-0"
              >+</button>
            </div>
          </div>

          {/* Resultat */}
          {resultat && (
            <div className={[
              'p-4 rounded-lg font-mono text-[0.9rem]',
              resultat.ok
                ? 'bg-success/10 border border-success text-success'
                : 'bg-danger/10 border border-danger text-danger',
            ].join(' ')}>
              {resultat.missatge}
            </div>
          )}

          {/* Botó enviar */}
          <button
            type="submit"
            disabled={loading}
            className={[
              'w-full py-4 border-none rounded-[10px] text-base font-bold font-sans mt-2',
              loading
                ? 'bg-border text-text-dim cursor-not-allowed'
                : 'bg-accent text-[#0f1117] cursor-pointer',
            ].join(' ')}
          >
            {loading ? 'Registrant...' : `Registrar ${nombreCarros} carro${parseInt(nombreCarros) > 1 ? 's' : ''}`}
          </button>

        </form>
      </div>
    </main>
  )
}
