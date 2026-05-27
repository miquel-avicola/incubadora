'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatData, diaSemana, calcularNaixement } from '@/lib/dates'

interface Assignacio {
  id: number
  num_carro_full: number
  hora_entrada: string | null
  previsio_naixement: number | null
  previsio_manual: boolean
  es_maquila: boolean
  carros_estoc: {
    id: number
    posta: string
    quantitat_ous: number
    lots_reproductores: {
      id: number
      data_naixement: string
      estirp: string | null
      granges_reproductores: { granja: string; nom_informal: string | null }
    }
  }
  incubadores: { id: number; numero: number; model: string; tipus: string }
  transferencies?: { id: number; resultats_naix?: { id: number }[] }[]
}

interface Comanda {
  id: number
  tipus: string
  quantitat_pollets: number | null
  quantitat_ous_maquila: number | null
  previsio_naixement: number | null
  sexat: boolean
  clients: { id: number; nom: string }
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  transferencia: string | null
  estat: string
  comandes: Comanda[]
  assignacions: Assignacio[]
}

export default function DetallCarrega() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuObert, setMenuObert] = useState(false)
  const [canviantEstat, setCanviantEstat] = useState(false)
  const [editantPrevisioId, setEditantPrevisioId] = useState<number | null>(null)
  const [valorEditPrevisio, setValorEditPrevisio] = useState<string>('')
  const [desantPrevisio, setDesantPrevisio] = useState(false)
  const [editantGrupKey, setEditantGrupKey] = useState<string | null>(null)
  const [valorEditGrup, setValorEditGrup] = useState<string>('')
  const [desantGrup, setDesantGrup] = useState(false)
  const [desantMaquila, setDesantMaquila] = useState(false)

  // Afegir comanda a posteriori
  const [clients, setClients] = useState<{ id: number; nom: string }[]>([])
  const [mostrarFormComanda, setMostrarFormComanda] = useState(false)
  const [nouClientId, setNouClientId] = useState('')
  const [nouTipus, setNouTipus] = useState<'Pollets' | 'Maquila'>('Pollets')
  const [nouQuantitat, setNouQuantitat] = useState('')
  const [nouSexat, setNouSexat] = useState(false)
  const [desantComanda, setDesantComanda] = useState(false)
  const [errorComanda, setErrorComanda] = useState('')

  const carregarDades = useCallback(() => {
    if (!params.id) return
    fetch(`/api/carrega/${params.id}`)
      .then(r => r.json())
      .then(data => { setFull(data); setLoading(false) })
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  useEffect(() => {
    fetch('/api/clients-list').then(r => r.json()).then(setClients)
  }, [])

  async function afegirComanda() {
    if (!full || !nouClientId || !nouQuantitat) { setErrorComanda('Omple tots els camps'); return }
    const q = parseInt(nouQuantitat)
    if (!q || q <= 0) { setErrorComanda('La quantitat ha de ser positiva'); return }
    setDesantComanda(true)
    setErrorComanda('')
    const body: Record<string, unknown> = {
      full_carrega_id: full.id,
      client_id: parseInt(nouClientId),
      tipus: nouTipus,
      sexat: nouSexat,
    }
    if (nouTipus === 'Pollets') body.quantitat_pollets = q
    else body.quantitat_ous_maquila = q
    const res = await fetch('/api/comandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json()
      setErrorComanda(d.error || 'Error desconegut')
    } else {
      setMostrarFormComanda(false)
      setNouClientId(''); setNouQuantitat(''); setNouSexat(false); setNouTipus('Pollets')
      carregarDades()
    }
    setDesantComanda(false)
  }

  async function eliminarComanda(id: number) {
    if (!confirm('Vols eliminar aquesta comanda?')) return
    await fetch(`/api/comandes/${id}`, { method: 'DELETE' })
    carregarDades()
  }

  const toggleMaquilaCarro = async (assignacioId: number, actual: boolean) => {
    if (desantMaquila) return
    setDesantMaquila(true)
    const res = await fetch(`/api/assignacions/${assignacioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ es_maquila: !actual }),
    })
    setDesantMaquila(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`Error: ${data.error || "no s'ha pogut desar"}`)
      return
    }
    carregarDades()
  }

  const toggleMaquilaGrup = async (lotId: number, incubadoraId: number, actualMaquila: boolean) => {
    if (desantMaquila) return
    if (!confirm(actualMaquila
      ? `Treure marcat com a MAQUILA a tots els carros d'aquest lot?`
      : `Marcar tots els carros d'aquest lot com a MAQUILA?`)) return
    setDesantMaquila(true)
    const res = await fetch(`/api/carrega/${params.id}/maquila-grup`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lot_id: lotId, incubadora_id: incubadoraId, es_maquila: !actualMaquila }),
    })
    setDesantMaquila(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`Error: ${data.error || "no s'ha pogut desar"}`)
      return
    }
    carregarDades()
  }

  const finalitzarFull = async () => {
    if (!full) return
    const totalCarros = full.assignacions.length
    const ambNaixement = full.assignacions.filter(a =>
      (a.transferencies || []).some(t => (t.resultats_naix || []).length > 0)
    ).length
    const totsRegistrats = totalCarros > 0 && ambNaixement === totalCarros

    const missatge = totsRegistrats
      ? `Vols finalitzar el full #${full.num_carrega}?`
      : `⚠️ Aquest full encara no té tots els naixements registrats (${ambNaixement} de ${totalCarros}). Estàs segur que el vols tancar tot i així?`

    if (!confirm(missatge)) return
    setCanviantEstat(true)
    setMenuObert(false)
    const res = await fetch(`/api/carrega/${full.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estat: 'Finalitzat' }),
    })
    setCanviantEstat(false)
    if (!res.ok) {
      alert('No s\'ha pogut finalitzar el full.')
      return
    }
    carregarDades()
  }

  const desarPrevisio = async (assignacioId: number, valor: string) => {
    if (desantPrevisio) return
    setDesantPrevisio(true)
    let body: { previsio_naixement: number | null }
    const trimmed = valor.trim()
    if (trimmed === '') {
      // Buit -> tornar a càlcul automàtic
      body = { previsio_naixement: null }
    } else {
      const num = parseFloat(trimmed.replace(',', '.'))
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        alert("Valor invàlid: ha d'estar entre 0 i 100 (deixa-ho buit per tornar a auto).")
        setDesantPrevisio(false)
        return
      }
      body = { previsio_naixement: num / 100 }
    }
    const res = await fetch(`/api/assignacions/${assignacioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`Error: ${data.error || "no s'ha pogut desar"}`)
      setDesantPrevisio(false)
      return
    }
    setEditantPrevisioId(null)
    setValorEditPrevisio('')
    setDesantPrevisio(false)
    carregarDades()
  }

  const desarPrevisioGrup = async (lotId: number, incubadoraId: number, valor: string) => {
    if (desantGrup) return
    setDesantGrup(true)
    let body: { lot_id: number; incubadora_id: number; previsio_naixement: number | null }
    const trimmed = valor.trim()
    if (trimmed === '') {
      body = { lot_id: lotId, incubadora_id: incubadoraId, previsio_naixement: null }
    } else {
      const num = parseFloat(trimmed.replace(',', '.'))
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        alert("Valor invàlid: 0-100 (buit per tornar a auto).")
        setDesantGrup(false)
        return
      }
      body = { lot_id: lotId, incubadora_id: incubadoraId, previsio_naixement: num / 100 }
    }
    const res = await fetch(`/api/carrega/${params.id}/previsio-grup`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(`Error: ${data.error || "no s'ha pogut desar"}`)
      setDesantGrup(false)
      return
    }
    setEditantGrupKey(null)
    setValorEditGrup('')
    setDesantGrup(false)
    carregarDades()
  }

  const reobrirFull = async () => {
    if (!full) return
    if (!confirm(`Vols reobrir el full #${full.num_carrega}? Tornarà a estat Planificat.`)) return
    setCanviantEstat(true)
    setMenuObert(false)
    const res = await fetch(`/api/carrega/${full.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estat: 'Planificat' }),
    })
    setCanviantEstat(false)
    if (!res.ok) {
      alert('No s\'ha pogut reobrir el full.')
      return
    }
    carregarDades()
  }

  if (loading) return (
    <main className="bg-bg min-h-screen p-6">
      <p className="text-text-dim font-mono text-sm text-center p-8">Carregant...</p>
    </main>
  )

  if (!full) return null

  const naixement = calcularNaixement(full.carrega)
  const totalPollets = full.comandes.filter(c => c.tipus === 'Pollets').reduce((s, c) => s + (c.quantitat_pollets || 0), 0)
  const totalMaquila = full.comandes.filter(c => c.tipus === 'Maquila').reduce((s, c) => s + (c.quantitat_ous_maquila || 0), 0)

  // Calcular pollets previstos per les assignacions
  const totalOusAssignats = full.assignacions.reduce((s, a) => s + a.carros_estoc.quantitat_ous, 0)
  const totalPolletsPrevistosPropis = full.assignacions
    .filter(a => !a.es_maquila)
    .reduce((s, a) => {
      const prev = a.previsio_naixement || 0
      return s + Math.round(a.carros_estoc.quantitat_ous * prev)
    }, 0)
  const totalPolletsPrevistosMaquila = full.assignacions
    .filter(a => a.es_maquila)
    .reduce((s, a) => {
      const prev = a.previsio_naixement || 0
      return s + Math.round(a.carros_estoc.quantitat_ous * prev)
    }, 0)
  const totalPolletsPrevistos = totalPolletsPrevistosPropis + totalPolletsPrevistosMaquila

  // Agrupar assignacions per incubadora
  const perIncubadora: Record<number, Assignacio[]> = {};
  full.assignacions.forEach(a => {
    const num = a.incubadores.numero;
    if (!perIncubadora[num]) perIncubadora[num] = [];
    perIncubadora[num].push(a);
  });

  return (
    <main className="bg-bg min-h-screen p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/carrega" className="text-text-dim no-underline text-sm font-mono hover:text-text transition-colors">← Càrregues</Link>
            <div>
              <p className="text-accent font-mono text-xs tracking-widest uppercase m-0 mb-1">Càrrega</p>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold m-0 text-text">#{full.num_carrega}</h1>
                {full.estat === 'Finalitzat' && (
                  <span className="bg-success text-white font-mono text-[0.65rem] tracking-widest uppercase px-2 py-1 rounded font-bold">
                    Finalitzat
                  </span>
                )}
              </div>
            </div>
          </div>
         <div className="relative">
            <button
              onClick={() => setMenuObert(!menuObert)}
              className="px-4 py-2.5 bg-accent hover:bg-accent-dim transition-colors border-none rounded-lg text-white font-bold text-sm cursor-pointer font-sans shadow-sm"
            >
              Accions ▾
            </button>
            {menuObert && (
              <>
                <div
                  onClick={() => setMenuObert(false)}
                  className="fixed inset-0 z-40"
                />
                <div className="absolute right-0 top-[110%] bg-surface border border-border rounded-xl overflow-hidden z-50 min-w-[200px] shadow-lg">
                  {[
                    { href: `/carrega/${full.id}/imprimir`, label: '🖨️ Imprimir', target: '_blank' },
                    { href: `/carrega/${full.id}/etiquetes`, label: '🏷️ Etiquetes càrrega' },
                    { href: `/carrega/${full.id}/assignacions`, label: '+ Assignar carros' },
                    { href: `/carrega/${full.id}/vacunes`, label: 'Pla vacunal' },
                    { href: `/carrega/${full.id}/transferencia`, label: 'Transferència' },
                    { href: `/carrega/${full.id}/naixement`, label: 'Naixement' },
                    { href: `/carrega/${full.id}/expedicions`, label: 'Expedicions' },
                    { href: `/carrega/${full.id}/estadistiques`, label: '📊 Estadístiques' },
                  ].map((item, i, arr) => (
                    <Link
                      key={i}
                      href={item.href}
                      target={item.target as '_blank' | undefined}
                      style={{ textDecoration: 'none' }}
                      onClick={() => setMenuObert(false)}
                    >
                      <div style={{
                        padding: '0.85rem 1rem',
                        color: 'var(--text)',
                        fontSize: '0.9rem',
                        fontFamily: 'IBM Plex Sans',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: 'transparent',
                      }}>
                        {item.label}
                      </div>
                    </Link>
                  ))}
                  {/* Acció destacada: Finalitzar / Reobrir */}
                  {full.estat === 'Finalitzat' ? (
                    <div
                      onClick={canviantEstat ? undefined : reobrirFull}
                      style={{
                        padding: '0.85rem 1rem',
                        color: 'var(--accent)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        fontFamily: 'IBM Plex Sans',
                        cursor: canviantEstat ? 'wait' : 'pointer',
                        background: 'transparent',
                        opacity: canviantEstat ? 0.5 : 1,
                      }}
                    >
                      ↺ Reobrir full
                    </div>
                  ) : (
                    <div
                      onClick={canviantEstat ? undefined : finalitzarFull}
                      style={{
                        padding: '0.85rem 1rem',
                        color: 'var(--success)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        fontFamily: 'IBM Plex Sans',
                        cursor: canviantEstat ? 'wait' : 'pointer',
                        background: 'transparent',
                        opacity: canviantEstat ? 0.5 : 1,
                      }}
                    >
                      ✓ Finalitzar full
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info dates */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-4 grid grid-cols-3 gap-3 shadow-sm">
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Càrrega</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatData(full.carrega)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{diaSemana(full.carrega)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Transferència</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{full.transferencia ? formatData(full.transferencia) : '—'}</div>
            {full.transferencia && <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{diaSemana(full.transferencia)}</div>}
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Naixement</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatData(naixement)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{diaSemana(naixement)}</div>
          </div>
        </div>

        {/* Resum pollets */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-4 shadow-sm">
          <div className="text-xs font-mono text-text-dim uppercase tracking-widest mb-3">Resum</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--accent)' }}>{full.assignacions.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>carros</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--text)' }}>{totalOusAssignats.toLocaleString()}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>ous</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: totalPolletsPrevistosPropis >= totalPollets ? 'var(--success)' : 'var(--danger)' }}>
                {totalPolletsPrevistosPropis.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>prev. propis</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>
                {totalPolletsPrevistosMaquila.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>prev. maquila</div>
            </div>
          </div>
          {totalPollets > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', fontFamily: 'IBM Plex Mono' }}>
              Objectiu: {totalPollets.toLocaleString()} pollets{totalMaquila > 0 ? ` + ${totalMaquila.toLocaleString()} ous maq.` : ''}
            </div>
          )}
        </div>

        {/* Comandes */}
        <div className="bg-surface border border-border rounded-xl p-5 mb-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs font-mono text-text-dim uppercase tracking-widest">Comandes</div>
            <button
              onClick={() => { setMostrarFormComanda(v => !v); setErrorComanda('') }}
              style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: mostrarFormComanda ? 'var(--accent)' : 'transparent', color: mostrarFormComanda ? '#fff' : 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            >
              {mostrarFormComanda ? '× Cancel·la' : '+ Afegir comanda'}
            </button>
          </div>

          {full.comandes.length === 0 && !mostrarFormComanda && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>Sense comandes</p>
          )}
          {full.comandes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: mostrarFormComanda ? '0.75rem' : 0 }}>
              {full.comandes.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: 'var(--bg)', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.clients.nom}</span>
                    {c.sexat && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--accent)', fontFamily: 'IBM Plex Mono' }}>SEXAT</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                      {c.tipus === 'Pollets' ? `${(c.quantitat_pollets || 0).toLocaleString()} pollets` : `${(c.quantitat_ous_maquila || 0).toLocaleString()} ous maq.`}
                    </span>
                    <button
                      onClick={() => eliminarComanda(c.id)}
                      title="Eliminar comanda"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '1rem', lineHeight: 1, padding: '2px 4px', borderRadius: 4 }}
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {mostrarFormComanda && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Client</label>
                  <select
                    value={nouClientId}
                    onChange={e => setNouClientId(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem', background: 'var(--surface)' }}
                  >
                    <option value="">— Selecciona —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Tipus</label>
                  <select
                    value={nouTipus}
                    onChange={e => setNouTipus(e.target.value as 'Pollets' | 'Maquila')}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem', background: 'var(--surface)' }}
                  >
                    <option value="Pollets">Pollets</option>
                    <option value="Maquila">Maquila (ous)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                    {nouTipus === 'Pollets' ? 'Quantitat pollets' : 'Quantitat ous maquila'}
                  </label>
                  <input
                    type="number"
                    value={nouQuantitat}
                    onChange={e => setNouQuantitat(e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem', background: 'var(--surface)', boxSizing: 'border-box' }}
                  />
                </div>
                {nouTipus === 'Pollets' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: '1.2rem' }}>
                    <input
                      type="checkbox"
                      id="nou-sexat"
                      checked={nouSexat}
                      onChange={e => setNouSexat(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <label htmlFor="nou-sexat" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Sexat</label>
                  </div>
                )}
              </div>
              {errorComanda && <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0 }}>{errorComanda}</p>}
              <button
                onClick={afegirComanda}
                disabled={desantComanda}
                style={{ alignSelf: 'flex-end', padding: '7px 18px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', cursor: desantComanda ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                {desantComanda ? 'Guardant...' : 'Guardar comanda'}
              </button>
            </div>
          )}
        </div>

        {/* Assignacions per incubadora */}
        {full.assignacions.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
            <div className="text-xs font-mono text-text-dim uppercase tracking-widest mb-3">Assignacions ({full.assignacions.length} carros)</div>
            <div className="flex flex-col gap-3">
              {Object.entries(perIncubadora).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([num, assigs]) => {
                const perLot: Record<number, Assignacio[]> = {}
                for (const a of assigs) {
                  const lid = a.carros_estoc.lots_reproductores.id
                  if (!perLot[lid]) perLot[lid] = []
                  perLot[lid].push(a)
                }
                const grups = Object.values(perLot).sort((g1, g2) => {
                  const m1 = g1.reduce((m, c) => Math.min(m, c.num_carro_full), Infinity)
                  const m2 = g2.reduce((m, c) => Math.min(m, c.num_carro_full), Infinity)
                  return m1 - m2
                })
                return (
                  <div key={num} className="mb-4">
                    <div className="text-sm font-mono text-accent mb-2">
                      Incubadora {num} — {assigs[0].incubadores.model} ({assigs[0].incubadores.tipus === 'Singlestage' ? 'SS' : 'MS'})
                    </div>
                    <div className="flex flex-col gap-2">
                      {grups.map(carrosLot => {
                        const primer = carrosLot[0]
                        const lot = primer.carros_estoc.lots_reproductores
                        const granja = lot.granges_reproductores.nom_informal || lot.granges_reproductores.granja
                        const incubadoraId = primer.incubadores.id
                        const grupKey = `${incubadoraId}|${lot.id}`
                        const valors = carrosLot.map(c => c.previsio_naixement)
                        const totsIguals = valors.every(v => v === valors[0])
                        const valorUniform = totsIguals ? valors[0] : null
                        const algunsManuals = carrosLot.some(c => c.previsio_manual)
                        const totsManuals = carrosLot.every(c => c.previsio_manual)
                        return (
                          <div key={grupKey} className="bg-bg rounded-lg p-2.5">
                            <div className="flex justify-between items-center mb-1.5 text-sm">
                              <span className="font-semibold">{granja} {lot.estirp || ''} · {carrosLot.length} carro{carrosLot.length > 1 ? 's' : ''}</span>
                              <span className="flex items-center gap-2.5">
                                <button
                                  onClick={() => toggleMaquilaGrup(lot.id, incubadoraId, carrosLot.every(c => c.es_maquila))}
                                  disabled={desantMaquila}
                                  title={carrosLot.every(c => c.es_maquila) ? 'Tots marcats MAQUILA — clica per treure' : carrosLot.some(c => c.es_maquila) ? 'Alguns MAQUILA — clica per marcar tots' : 'Clica per marcar tots com a MAQUILA'}
                                  style={{
                                    padding: '0.1rem 0.4rem',
                                    fontSize: '0.65rem',
                                    fontFamily: 'IBM Plex Mono',
                                    fontWeight: 700,
                                    letterSpacing: '0.05em',
                                    border: '1px solid',
                                    borderRadius: '4px',
                                    cursor: desantMaquila ? 'wait' : 'pointer',
                                    background: carrosLot.every(c => c.es_maquila) ? '#f59e0b' : carrosLot.some(c => c.es_maquila) ? 'rgba(245,158,11,0.3)' : 'transparent',
                                    color: carrosLot.every(c => c.es_maquila) ? '#ffffff' : carrosLot.some(c => c.es_maquila) ? '#f59e0b' : 'var(--text-dim)',
                                    borderColor: carrosLot.some(c => c.es_maquila) ? '#f59e0b' : 'var(--border)',
                                  }}
                                >MAQ</button>
                                <span className="text-text-dim font-mono text-xs">tot el grup:</span>
                                {editantGrupKey === grupKey ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    autoFocus
                                    value={valorEditGrup}
                                    onChange={(e) => setValorEditGrup(e.target.value)}
                                    onBlur={() => desarPrevisioGrup(lot.id, incubadoraId, valorEditGrup)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') desarPrevisioGrup(lot.id, incubadoraId, valorEditGrup)
                                      else if (e.key === 'Escape') { setEditantGrupKey(null); setValorEditGrup('') }
                                    }}
                                    disabled={desantGrup}
                                    placeholder="buit=auto"
                                    style={{ width: '4.5rem', padding: '0.1rem 0.3rem', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '4px', color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', textAlign: 'right' }}
                                  />
                                ) : (
                                  <span
                                    onClick={() => {
                                      setEditantGrupKey(grupKey)
                                      setValorEditGrup(valorUniform != null ? String(Math.round(valorUniform * 1000) / 10) : '')
                                    }}
                                    title={totsIguals ? (totsManuals ? 'Tot el grup amb valor manual - clica per modificar' : 'Tot el grup amb valor auto - clica per fixar manualment') : 'Valors diferents - clica per posar el mateix a tots'}
                                    style={{
                                      color: totsIguals ? (totsManuals ? '#f59e0b' : 'var(--accent)') : 'var(--text-dim)',
                                      fontFamily: 'IBM Plex Mono',
                                      fontSize: '0.78rem',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      borderBottom: totsIguals && totsManuals ? '1px dashed currentColor' : (totsIguals ? '1px dotted var(--text-dim)' : '1px dashed var(--text-dim)'),
                                    }}
                                  >
                                    {totsIguals
                                      ? (valorUniform != null ? `${Math.round(valorUniform * 1000) / 10}%${totsManuals ? ' ✎' : ''}` : '—')
                                      : `mixt${algunsManuals ? ' ✎' : ''}`}
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="flex flex-col gap-1">
                              {carrosLot.sort((c1, c2) => c1.num_carro_full - c2.num_carro_full).map(a => (
                                <div key={a.id} className="flex justify-between items-center px-2 py-1.5 text-sm">
                                  <span className="font-mono text-text-dim min-w-[2rem]">C{a.num_carro_full}</span>
                                  <button
                                    onClick={() => toggleMaquilaCarro(a.id, a.es_maquila)}
                                    disabled={desantMaquila}
                                    title={a.es_maquila ? 'MAQUILA — clica per treure' : 'Clica per marcar com a maquila'}
                                    style={{
                                      marginLeft: '0.3rem',
                                      padding: '0.05rem 0.3rem',
                                      fontSize: '0.6rem',
                                      fontFamily: 'IBM Plex Mono',
                                      fontWeight: 700,
                                      border: '1px solid',
                                      borderRadius: '3px',
                                      cursor: desantMaquila ? 'wait' : 'pointer',
                                      background: a.es_maquila ? '#f59e0b' : 'transparent',
                                      color: a.es_maquila ? '#ffffff' : 'var(--border)',
                                      borderColor: a.es_maquila ? '#f59e0b' : 'var(--border)',
                                      lineHeight: 1.2,
                                    }}
                                  >M</button>
                                  <span className="flex-1 ml-2 text-text-dim">{a.carros_estoc.posta}</span>
                                  {editantPrevisioId === a.id ? (
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      autoFocus
                                      value={valorEditPrevisio}
                                      onChange={(e) => setValorEditPrevisio(e.target.value)}
                                      onBlur={() => desarPrevisio(a.id, valorEditPrevisio)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') desarPrevisio(a.id, valorEditPrevisio)
                                        else if (e.key === 'Escape') { setEditantPrevisioId(null); setValorEditPrevisio('') }
                                      }}
                                      disabled={desantPrevisio}
                                      placeholder="buit=auto"
                                      style={{ marginLeft: '0.75rem', width: '4.5rem', padding: '0.1rem 0.3rem', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: '4px', color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem', textAlign: 'right' }}
                                    />
                                  ) : (
                                    <span
                                      onClick={() => {
                                        setEditantPrevisioId(a.id)
                                        setValorEditPrevisio(a.previsio_naixement != null ? String(Math.round(a.previsio_naixement * 1000) / 10) : '')
                                      }}
                                      title={a.previsio_manual ? 'Manual - clica per modificar' : 'Auto - clica per editar individualment'}
                                      style={{
                                        marginLeft: '0.75rem',
                                        color: a.previsio_manual ? '#f59e0b' : 'var(--text-dim)',
                                        fontFamily: 'IBM Plex Mono',
                                        fontSize: '0.72rem',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        borderBottom: a.previsio_manual ? '1px dashed currentColor' : 'none',
                                      }}
                                    >
                                      {a.previsio_naixement != null ? `${Math.round(a.previsio_naixement * 1000) / 10}%` : '—'}
                                      {a.previsio_manual && ' ✎'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
