'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcularNaixement, calcularTransferencia, formatData, diaSemana } from '@/lib/dates'

interface Client {
  id: number
  nom: string
}

interface Comanda {
  client_id: number
  client_nom: string
  tipus: 'Pollets' | 'Maquila'
  quantitat: number
  sexat: boolean
}

interface ComandaPendent {
  id: number
  tipus: string
  quantitat_pollets: number | null
  quantitat_ous_maquila: number | null
  sexat: boolean
  data_prevista_naixement: string | null
  clients: { id: number; nom: string }
}

interface ComandaSuggerida {
  key: string // 'id_X' per comandes reals o 'regla_X' per regles
  comanda_id?: number // si és comanda real preliminar
  regla_id?: number   // si és projecció d'una regla recurrent
  tipus: 'Pollets' | 'Maquila'
  quantitat: number
  client_id: number
  client_nom: string
  data_naixement: string // data específica per a la qual es projecta
  sexat?: boolean
  data_real_comanda?: string | null // data_prevista_naixement original de la comanda real
}

interface ReglaRecurrent {
  id: number
  client_id: number
  dia_setmana: number
  tipus: 'Pollets' | 'Maquila'
  quantitat: number
  actiu: boolean
  clients: { nom: string }
}

export default function NovaCarrega() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [dataCarrega, setDataCarrega] = useState('')
  const [dataTransferencia, setDataTransferencia] = useState('')
  const [comandes, setComandes] = useState<Comanda[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Comandes pendents suggerides (combina preliminars + regles recurrents)
  const [suggerides, setSuggerides] = useState<ComandaSuggerida[]>([])
  const [seleccionades, setSeleccionades] = useState<Set<string>>(new Set())
  // Modificacions locals per fila (quantitat, tipus, sexat)
  const [overrides, setOverrides] = useState<Record<string, { quantitat?: string; tipus?: 'Pollets' | 'Maquila'; sexat?: boolean }>>({})

  // Form nova comanda manual
  const [clientId, setClientId] = useState('')
  const [tipus, setTipus] = useState<'Pollets' | 'Maquila'>('Pollets')
  const [quantitat, setQuantitat] = useState('')
  const [sexat, setSexat] = useState(false)

  useEffect(() => {
    fetch('/api/clients-list').then(r => r.json()).then(setClients)
  }, [])

  useEffect(() => {
    if (dataCarrega) {
      setDataTransferencia(calcularTransferencia(dataCarrega))
    }
  }, [dataCarrega])

  // Quan canvia la data de càrrega, buscar comandes preliminars + regles recurrents
  useEffect(() => {
    if (!dataCarrega) { setSuggerides([]); return }
    const naixement = calcularNaixement(dataCarrega)
    const diaSetmana = new Date(naixement + 'T00:00:00').getDay()

    Promise.all([
      fetch(`/api/comandes?pendents=true&data=${naixement}`).then(r => r.json()),
      fetch('/api/previsio-recurrent').then(r => r.json()),
    ]).then(([comandesRes, reglesRes]) => {
      const comandes: ComandaPendent[] = Array.isArray(comandesRes) ? comandesRes : []
      const regles: ReglaRecurrent[] = Array.isArray(reglesRes) ? reglesRes : []

      const llista: ComandaSuggerida[] = []

      // 1. Comandes preliminars existents (±14 dies del naixement)
      comandes.forEach(c => {
        const q = c.tipus === 'Pollets' ? (c.quantitat_pollets || 0) : (c.quantitat_ous_maquila || 0)
        llista.push({
          key: `id_${c.id}`,
          comanda_id: c.id,
          tipus: c.tipus as 'Pollets' | 'Maquila',
          quantitat: q,
          client_id: c.clients.id,
          client_nom: c.clients.nom,
          data_naixement: c.data_prevista_naixement || naixement,
          sexat: c.sexat,
          data_real_comanda: c.data_prevista_naixement,
        })
      })

      // 2. Regles recurrents per al dia de la setmana del naixement,
      //    sempre que no hi hagi ja una comanda preliminar per a aquest (client, tipus, data)
      regles.forEach(r => {
        if (!r.actiu) return
        if (r.dia_setmana !== diaSetmana) return
        const jaCobreix = comandes.some(c =>
          c.clients.id === r.client_id &&
          c.tipus === r.tipus &&
          c.data_prevista_naixement === naixement
        )
        if (jaCobreix) return
        llista.push({
          key: `regla_${r.id}`,
          regla_id: r.id,
          tipus: r.tipus,
          quantitat: r.quantitat,
          client_id: r.client_id,
          client_nom: r.clients.nom,
          data_naixement: naixement,
        })
      })

      setSuggerides(llista)
      // Seleccionar-les totes per defecte
      setSeleccionades(new Set(llista.map(s => s.key)))
      // Esborrar overrides al canviar de data
      setOverrides({})
    })
  }, [dataCarrega])

  // Helpers per llegir el valor efectiu d'una fila (override o original)
  function getQuantitat(s: ComandaSuggerida): number {
    const ov = overrides[s.key]?.quantitat
    if (ov !== undefined && ov !== '') return parseInt(ov) || 0
    return s.quantitat
  }
  function getTipus(s: ComandaSuggerida): 'Pollets' | 'Maquila' {
    return overrides[s.key]?.tipus ?? s.tipus
  }
  function getSexat(s: ComandaSuggerida): boolean {
    return overrides[s.key]?.sexat ?? (s.sexat ?? false)
  }
  function setOverride(key: string, camp: 'quantitat' | 'tipus' | 'sexat', valor: any) {
    setOverrides(prev => ({ ...prev, [key]: { ...prev[key], [camp]: valor } }))
  }

  const naixement = dataCarrega ? calcularNaixement(dataCarrega) : null

  function toggleSeleccio(key: string) {
    setSeleccionades(prev => {
      const nou = new Set(prev)
      if (nou.has(key)) nou.delete(key)
      else nou.add(key)
      return nou
    })
  }

  function afegirComanda() {
    if (!clientId || !quantitat) return
    const client = clients.find(c => c.id === parseInt(clientId))
    if (!client) return
    setComandes(prev => [...prev, {
      client_id: parseInt(clientId),
      client_nom: client.nom,
      tipus, quantitat: parseInt(quantitat), sexat,
    }])
    setClientId(''); setQuantitat(''); setSexat(false)
  }

  function eliminarComanda(idx: number) {
    setComandes(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!dataCarrega) { setError('La data de càrrega és obligatòria'); return }
    setLoading(true)
    setError('')

    try {
      // Crear full de càrrega
      const resF = await fetch('/api/carrega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrega: dataCarrega, transferencia: dataTransferencia }),
      })
      const full = await resF.json()
      if (!resF.ok) { setError(full.error); setLoading(false); return }

      // Processar comandes suggerides seleccionades:
      // - Si és preliminar existent (comanda_id), PATCH per vincular-la + aplicar canvis
      // - Si és projecció de regla recurrent (regla_id), POST per crear comanda nova
      for (const s of suggerides) {
        if (!seleccionades.has(s.key)) continue
        const q = getQuantitat(s)
        const t = getTipus(s)
        const sx = getSexat(s)
        const fields = {
          tipus: t,
          quantitat_pollets: t === 'Pollets' ? q : null,
          quantitat_ous_maquila: t === 'Maquila' ? q : null,
          sexat: sx,
        }
        if (s.comanda_id) {
          await fetch(`/api/comandes/${s.comanda_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_carrega_id: full.id, ...fields }),
          })
        } else if (s.regla_id) {
          await fetch('/api/comandes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_carrega_id: full.id,
              client_id: s.client_id,
              data_prevista_naixement: s.data_naixement,
              ...fields,
            }),
          })
        }
      }

      // Crear comandes noves manuals
      for (const c of comandes) {
        await fetch('/api/comandes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_carrega_id: full.id,
            client_id: c.client_id,
            tipus: c.tipus,
            quantitat_pollets: c.tipus === 'Pollets' ? c.quantitat : null,
            quantitat_ous_maquila: c.tipus === 'Maquila' ? c.quantitat : null,
            sexat: c.sexat,
          }),
        })
      }

      router.push(`/carrega/${full.id}`)
    } catch {
      setError('Error de connexió')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text)',
    fontSize: '0.95rem', outline: 'none', fontFamily: 'IBM Plex Sans',
  }
  const labelStyle = {
    display: 'block' as const, fontSize: '0.7rem', fontFamily: 'IBM Plex Mono',
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    color: 'var(--text-dim)', marginBottom: '0.4rem',
  }

  const clientsDisponibles = clients.filter(c => !comandes.find(co => co.client_id === c.id))

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Link href="/carrega" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrregues</Link>
          <div>
            <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Nova</p>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Nova càrrega</h1>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Dates */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ fontWeight: 700, margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Dates</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Data de càrrega *</label>
                <input type="date" value={dataCarrega} onChange={e => setDataCarrega(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Data de transferència</label>
                <input type="date" value={dataTransferencia} onChange={e => setDataTransferencia(e.target.value)} style={inputStyle} />
              </div>
            </div>
            {naixement && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                Naixement previst: <span style={{ color: 'var(--accent)' }}>{formatData(naixement)}</span> ({diaSemana(naixement)})
                {' · '}Transferència: <span style={{ color: 'var(--text)' }}>{diaSemana(dataTransferencia)}</span>
              </div>
            )}
          </div>

          {/* Comandes pendents suggerides (preliminars + projeccions recurrents) */}
          {suggerides.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '1.25rem' }}>
              <p style={{ fontWeight: 700, margin: '0 0 0.25rem 0', fontSize: '0.95rem' }}>
                Comandes pendents suggerides
              </p>
              <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.72rem', margin: '0 0 1rem 0' }}>
                Naixement previst: {naixement ? formatData(naixement) : '—'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {suggerides.map(s => {
                  const sel = seleccionades.has(s.key)
                  const esRecurrent = s.regla_id != null
                  const tipusActual = getTipus(s)
                  const sexatActual = getSexat(s)
                  const quantitatVal = overrides[s.key]?.quantitat ?? String(s.quantitat)
                  return (
                    <div
                      key={s.key}
                      style={{
                        padding: '0.75rem 1rem', borderRadius: '8px',
                        border: '1px solid', borderColor: sel ? 'var(--success)' : 'var(--border)',
                        background: sel ? 'rgba(34,197,94,0.06)' : 'var(--bg)',
                        display: 'flex', flexDirection: 'column', gap: '0.55rem',
                      }}
                    >
                      {/* Capçalera: check + nom + etiqueta recurrent + data */}
                      <div onClick={() => toggleSeleccio(s.key)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '1rem', color: sel ? 'var(--success)' : 'var(--border)' }}>
                            {sel ? '✓' : '○'}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.client_nom}</span>
                          {esRecurrent && (
                            <span style={{ fontSize: '0.65rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              recurrent
                            </span>
                          )}
                        </div>
                        {s.data_real_comanda && (
                          <span style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.72rem' }}>
                            {formatData(s.data_real_comanda)}
                          </span>
                        )}
                      </div>

                      {/* Controls inline */}
                      {sel && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingLeft: '1.6rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            {(['Pollets', 'Maquila'] as const).map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setOverride(s.key, 'tipus', t)}
                                style={{
                                  padding: '0.35rem 0.7rem', fontSize: '0.75rem',
                                  border: '1px solid', borderRadius: '6px',
                                  background: tipusActual === t ? 'rgba(240,180,41,0.15)' : 'var(--surface)',
                                  borderColor: tipusActual === t ? 'var(--accent)' : 'var(--border)',
                                  color: tipusActual === t ? 'var(--accent)' : 'var(--text-dim)',
                                  cursor: 'pointer', fontFamily: 'IBM Plex Sans',
                                }}
                              >{t}</button>
                            ))}
                          </div>
                          <input
                            type="number"
                            value={quantitatVal}
                            onChange={e => setOverride(s.key, 'quantitat', e.target.value)}
                            style={{
                              width: '7rem', padding: '0.35rem 0.5rem',
                              background: 'var(--surface)', border: '1px solid var(--border)',
                              borderRadius: '6px', color: 'var(--text)',
                              fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', textAlign: 'right',
                              outline: 'none',
                            }}
                          />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                            {tipusActual === 'Pollets' ? 'pollets' : 'ous maq.'}
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', cursor: 'pointer', marginLeft: 'auto' }}>
                            <input
                              type="checkbox"
                              checked={sexatActual}
                              onChange={e => setOverride(s.key, 'sexat', e.target.checked)}
                            />
                            Sexat
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', fontSize: '0.72rem', marginTop: '0.75rem', marginBottom: 0 }}>
                {seleccionades.size} de {suggerides.length} seleccionades
              </p>
            </div>
          )}

          {/* Comandes noves manuals */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ fontWeight: 700, margin: '0 0 1rem 0', fontSize: '0.95rem' }}>Afegir comandes noves</p>

            {comandes.length > 0 && (
              <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {comandes.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.client_nom}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginLeft: '0.5rem', fontFamily: 'IBM Plex Mono' }}>
                        {c.tipus === 'Pollets' ? `${c.quantitat.toLocaleString()} pollets` : `${c.quantitat.toLocaleString()} ous maquila`}
                        {c.sexat && ' · sexat'}
                      </span>
                    </div>
                    <button onClick={() => eliminarComanda(i)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.85rem', padding: '0.25rem' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text)', fontSize: '0.95rem', outline: 'none', fontFamily: 'IBM Plex Sans' }}>
                  <option value="">Selecciona un client...</option>
                  {clientsDisponibles.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Tipus</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['Pollets', 'Maquila'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setTipus(t)} style={{
                        flex: 1, padding: '0.7rem', border: '1px solid',
                        borderColor: tipus === t ? 'var(--accent)' : 'var(--border)',
                        borderRadius: '8px', background: tipus === t ? 'rgba(240,180,41,0.1)' : 'var(--bg)',
                        color: tipus === t ? 'var(--accent)' : 'var(--text-dim)',
                        fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'IBM Plex Sans',
                      }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{tipus === 'Pollets' ? 'Pollets' : 'Ous maquila'}</label>
                  <input type="number" value={quantitat} onChange={e => setQuantitat(e.target.value)} placeholder="0" style={inputStyle} />
                </div>
              </div>
              {tipus === 'Pollets' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  <input type="checkbox" checked={sexat} onChange={e => setSexat(e.target.checked)} />
                  Sexat
                </label>
              )}
              <button
                type="button"
                onClick={afegirComanda}
                disabled={!clientId || !quantitat}
                style={{
                  padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600,
                  fontFamily: 'IBM Plex Sans', cursor: (!clientId || !quantitat) ? 'not-allowed' : 'pointer',
                  background: (!clientId || !quantitat) ? 'var(--border)' : 'var(--surface)',
                  border: `1px solid ${(!clientId || !quantitat) ? 'var(--border)' : 'var(--accent)'}`,
                  color: (!clientId || !quantitat) ? 'var(--text-dim)' : 'var(--accent)',
                }}
              >
                + Afegir comanda
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.875rem', borderRadius: '8px', background: 'rgba(240,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !dataCarrega}
            style={{
              width: '100%', padding: '1rem', border: 'none', borderRadius: '10px',
              fontSize: '1rem', fontWeight: 700, fontFamily: 'IBM Plex Sans',
              cursor: (loading || !dataCarrega) ? 'not-allowed' : 'pointer',
              background: (loading || !dataCarrega) ? 'var(--border)' : 'var(--accent)',
              color: (loading || !dataCarrega) ? 'var(--text-dim)' : '#0f1117',
            }}
          >
            {loading ? 'Creant càrrega...' : `Crear càrrega${seleccionades.size > 0 ? ` (${seleccionades.size + comandes.length} comandes)` : comandes.length > 0 ? ` (${comandes.length} comandes)` : ''}`}
          </button>
        </div>
      </div>
    </main>
  )
}