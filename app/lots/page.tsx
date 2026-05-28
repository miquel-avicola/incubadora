'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Granja {
  id: number
  granja: string
  nom_informal: string | null
  marca_oficial: string | null
}

interface Lot {
  id: number
  data_naixement: string
  estirp: string | null
  granges_reproductores: {
    granja: string
    nom_informal: string | null
  }
  actiu: boolean
}

export default function Lots() {
  const [lots, setLots] = useState<Lot[]>([])
  const [granges, setGranges] = useState<Granja[]>([])
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarFormGranja, setMostrarFormGranja] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultat, setResultat] = useState<{ ok: boolean; missatge: string } | null>(null)

  const [granjaId, setGranjaId] = useState('')
  const [dataNaixement, setDataNaixement] = useState('')
  const [estirp, setEstirp] = useState('')

  const [nomGranja, setNomGranja] = useState('')
  const [nomInformal, setNomInformal] = useState('')
  const [marcaOficial, setMarcaOficial] = useState('')
  const [codiRega, setCodiRega] = useState('')

  const router = useRouter()

  useEffect(() => {
    fetch('/api/lots').then(r => r.json()).then(setLots)
    fetch('/api/granges').then(r => r.json()).then(setGranges)
  }, [])

  async function crearLot(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResultat(null)
    try {
      const res = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granja_reproductora_id: parseInt(granjaId, 10), data_naixement: dataNaixement, estirp: estirp || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResultat({ ok: false, missatge: data.error })
      } else {
        setResultat({ ok: true, missatge: 'Lot creat correctament' })
        setMostrarForm(false)
        setGranjaId(''); setDataNaixement(''); setEstirp('')
        fetch('/api/lots').then(r => r.json()).then(setLots)
      }
    } catch {
      setResultat({ ok: false, missatge: 'Error de connexió' })
    } finally {
      setLoading(false)
    }
  }

  async function crearGranja(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/granges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granja: nomGranja, nom_informal: nomInformal || null, marca_oficial: marcaOficial || null, codi_rega: codiRega || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResultat({ ok: false, missatge: data.error })
      } else {
        setResultat({ ok: true, missatge: 'Granja creada correctament' })
        setMostrarFormGranja(false)
        setNomGranja(''); setNomInformal(''); setMarcaOficial(''); setCodiRega('')
        fetch('/api/granges').then(r => r.json()).then(setGranges)
      }
    } catch {
      setResultat({ ok: false, missatge: 'Error de connexió' })
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-surface border border-border rounded-lg px-4 py-3 text-text text-[0.95rem] outline-none font-sans'
  const labelCls = 'block text-[0.7rem] font-mono tracking-[0.1em] uppercase text-text-dim mb-[0.4rem]'

  return (
    <main className="bg-bg min-h-screen p-6">
      <div className="max-w-[640px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text-dim no-underline text-[1.25rem]">←</Link>
            <div>
              <p className="text-accent font-mono text-[0.7rem] tracking-[0.15em] uppercase m-0">
                Gestió
              </p>
              <h1 className="text-[1.4rem] font-bold m-0">Lots de reproductores</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setMostrarFormGranja(!mostrarFormGranja); setMostrarForm(false) }}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-text-dim text-[0.8rem] cursor-pointer font-sans"
            >
              + Granja
            </button>
            <button
              onClick={() => { setMostrarForm(!mostrarForm); setMostrarFormGranja(false) }}
              className="px-3 py-2 bg-accent border-none rounded-lg text-[#0f1117] text-[0.8rem] font-bold cursor-pointer font-sans"
            >
              + Lot
            </button>
          </div>
        </div>

        {/* Resultat */}
        {resultat && (
          <div className={[
            'px-4 py-[0.875rem] rounded-lg mb-4 font-mono text-[0.85rem]',
            resultat.ok
              ? 'bg-success/10 border border-success text-success'
              : 'bg-danger/10 border border-danger text-danger',
          ].join(' ')}>
            {resultat.missatge}
          </div>
        )}

        {/* Formulari nova granja */}
        {mostrarFormGranja && (
          <form onSubmit={crearGranja} className="bg-surface border border-border rounded-xl p-5 mb-6 flex flex-col gap-4">
            <p className="font-bold m-0 text-[0.95rem]">Nova granja reproductora</p>
            <div>
              <label className={labelCls}>Nom oficial *</label>
              <input value={nomGranja} onChange={e => setNomGranja(e.target.value)} required className={inputCls} placeholder="Ex: SAMANIEGO BOTARELL" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nom informal</label>
                <input value={nomInformal} onChange={e => setNomInformal(e.target.value)} className={inputCls} placeholder="Ex: Botarell" />
              </div>
              <div>
                <label className={labelCls}>Marca oficial</label>
                <input value={marcaOficial} onChange={e => setMarcaOficial(e.target.value)} className={inputCls} placeholder="Ex: 1360BU" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Codi REGA</label>
              <input value={codiRega} onChange={e => setCodiRega(e.target.value)} className={inputCls} placeholder="Ex: ES0001234" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMostrarFormGranja(false)} className="flex-1 py-3 bg-transparent border border-border rounded-lg text-text-dim cursor-pointer font-sans">Cancel·lar</button>
              <button type="submit" disabled={loading} className="flex-1 py-3 bg-accent border-none rounded-lg text-[#0f1117] font-bold cursor-pointer font-sans">Crear granja</button>
            </div>
          </form>
        )}

        {/* Formulari nou lot */}
        {mostrarForm && (
          <form onSubmit={crearLot} className="bg-surface border border-border rounded-xl p-5 mb-6 flex flex-col gap-4">
            <p className="font-bold m-0 text-[0.95rem]">Nou lot de reproductores</p>
            <div>
              <label className={labelCls}>Granja reproductora *</label>
              <select value={granjaId} onChange={e => setGranjaId(e.target.value)} required className={inputCls}>
                <option value="">Selecciona una granja...</option>
                {granges.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nom_informal ? `${g.nom_informal} (${g.granja})` : g.granja}
                    {g.marca_oficial ? ` — ${g.marca_oficial}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data de naixement *</label>
                <input type="date" value={dataNaixement} onChange={e => setDataNaixement(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Estirp</label>
                <select value={estirp} onChange={e => setEstirp(e.target.value)} className={inputCls}>
                  <option value="">Cap</option>
                  <option value="Ross">Ross</option>
                  <option value="Cobb">Cobb</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMostrarForm(false)} className="flex-1 py-3 bg-transparent border border-border rounded-lg text-text-dim cursor-pointer font-sans">Cancel·lar</button>
              <button type="submit" disabled={loading} className="flex-1 py-3 bg-accent border-none rounded-lg text-[#0f1117] font-bold cursor-pointer font-sans">Crear lot</button>
            </div>
          </form>
        )}

        {/* Llista de lots */}
        <div className="flex flex-col gap-3">
          {lots.length === 0 && (
            <p className="text-text-dim text-center py-8 font-mono text-[0.85rem]">
              No hi ha lots registrats
            </p>
          )}
          {lots.map(lot => (
            <div
              key={lot.id}
              onClick={() => router.push(`/lots/${lot.id}`)}
              className="bg-surface border border-border rounded-[10px] px-5 py-4 flex justify-between items-center cursor-pointer transition-colors duration-150 hover:border-accent"
            >
              <div>
                <div className="font-semibold text-[0.95rem]">
                  {lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja}
                  {lot.estirp && <span className="text-accent ml-2 font-mono text-[0.8rem]">{lot.estirp}</span>}
                </div>
                <div className="text-text-dim text-[0.8rem] font-mono mt-[0.2rem]">
                  nascut {lot.data_naixement}
                  {lot.actiu === false && <span className="ml-2 text-danger">[Tancat]</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-text-dim font-mono text-[0.75rem]">#{lot.id}</span>
                <span className="text-text-dim text-[0.9rem]">→</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
