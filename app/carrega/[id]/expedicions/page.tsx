'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Destinacio {
  id: number
  nom_granja: string
  nau: string | null
  poblacio: string | null
  codi_rega: string | null
  client_id: number | null
}

interface Transportista {
  id: number
  nom: string
  empresa: string | null
  max_carros: number | null
  tipus_carro: number | null
  alcada_min: number | null
  alcada_max: number | null
  pollets_caixa_min: number | null
  pollets_caixa_max: number | null
}

interface Comanda {
  id: number
  clients: { id: number; nom: string }
  quantitat_pollets: number | null
  tipus: string
}

interface ExpedicioLot {
  id: number
  pollets: number
  lots_reproductores: {
    id: number
    data_naixement: string
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
  grup_sexat_id: string | null
  comandes: { id: number; clients: { id: number; nom: string } }
  destinacions: { id: number; nom_granja: string; nau: string | null; poblacio: string | null; sexe: string | null }
  transportistes: { id: number; nom: string } | null
  expedicio_lots: ExpedicioLot[]
  expedicio_vacunes: { vacuna_id: number; vacunes: { id: number; nom: string; via: string } }[]
}

interface Vacuna {
  id: number
  nom: string
  via: string
}

interface Full {
  id: number
  num_carrega: number
  carrega: string
  comandes: Comanda[]
}

interface ResultatExpedicio {
  expedicio_id: number
  client: string
  carros_sencers: number
  pico_caixes: number
  pollets_reals: number
  diferencia: number
}

interface CarroCompartit {
  alcada_carro: number
  items: Array<{ expedicio_id: number; client: string; caixes: number }>
}

interface Opcio {
  alcada: number
  pollets_caixa: number
  resultats: ResultatExpedicio[]
  carros_compartits: CarroCompartit[]
  total_carros: number
  score: { num_compartits: number; num_multiples_5: number; suma_diferencies: number }
}

export type DistribucioSaved = Record<string, {
  alcada: number
  pollets_caixa: number
  nom_transportista: string
  num_viatge: number
  transportista_id: number
  per_expedicio: Record<string, {
    carros_sencers: number
    pico_caixes: number
    pollets_reals: number
    diferencia: number
    en_carro_compartit: boolean
  }>
  carros_compartits: Array<{
    alcada_carro: number
    items: Array<{ expedicio_id: number; client: string; caixes: number }>
  }>
}>

function nomDestinacio(d: { nom_granja: string; nau: string | null }) {
  return d.nau ? `${d.nom_granja} ${d.nau}` : d.nom_granja
}

function etiquetaSexe(sexe: string | null) {
  if (sexe === 'F') return '♀ Femelles'
  if (sexe === 'M') return '♂ Mascles'
  return null
}

function calcularOpcions(exps: Expedicio[], t: Transportista): Opcio[] {
  const { alcada_min, alcada_max, pollets_caixa_min, pollets_caixa_max, max_carros } = t
  if (!alcada_min || !alcada_max || !pollets_caixa_min || !pollets_caixa_max || !max_carros) return []

  const opcions: Opcio[] = []

  for (let alcada = alcada_min; alcada <= alcada_max; alcada++) {
    for (let pc = pollets_caixa_min; pc <= pollets_caixa_max; pc++) {
      const pollets_per_carro = alcada * pc

      const resultats: ResultatExpedicio[] = exps.map(e => {
        const pollets = e.pollets_comanda || 0
        const carros_sencers = Math.floor(pollets / pollets_per_carro)
        const resta = pollets % pollets_per_carro
        const pico_caixes = Math.round(resta / pc)
        const pollets_reals = carros_sencers * pollets_per_carro + pico_caixes * pc
        const diferencia = Math.abs(pollets - pollets_reals)
        return { expedicio_id: e.id, client: e.comandes?.clients?.nom || '', carros_sencers, pico_caixes, pollets_reals, diferencia }
      })

      if (resultats.some(r => r.diferencia >= 100)) continue

      const total_sencers = resultats.reduce((s, r) => s + r.carros_sencers, 0)
      const amPico = resultats.filter(r => r.pico_caixes > 0)
      let carros_compartits: CarroCompartit[] = []

      if (amPico.length > 0) {
        if (total_sencers + amPico.length <= max_carros) {
          carros_compartits = amPico.map(r => ({
            alcada_carro: r.pico_caixes,
            items: [{ expedicio_id: r.expedicio_id, client: r.client, caixes: r.pico_caixes }],
          }))
        } else {
          const carros_disp = max_carros - total_sencers
          if (carros_disp <= 0) {
            carros_compartits = [{
              alcada_carro: amPico.reduce((s, r) => s + r.pico_caixes, 0),
              items: amPico.map(r => ({ expedicio_id: r.expedicio_id, client: r.client, caixes: r.pico_caixes })),
            }]
          } else {
            const grups: CarroCompartit[] = Array.from({ length: carros_disp }, () => ({ alcada_carro: 0, items: [] }))
            amPico.forEach((r, i) => {
              const g = grups[i % carros_disp]
              g.items.push({ expedicio_id: r.expedicio_id, client: r.client, caixes: r.pico_caixes })
              g.alcada_carro += r.pico_caixes
            })
            carros_compartits = grups.filter(g => g.items.length > 0)
          }
        }
      }

      const total_carros = total_sencers + carros_compartits.length
      if (total_carros > max_carros) continue

      const num_multiples_5 = resultats.filter(r => r.carros_sencers > 0 && r.carros_sencers % 5 === 0).length
      const suma_dif = resultats.reduce((s, r) => s + r.diferencia, 0)

      opcions.push({
        alcada, pollets_caixa: pc, resultats, carros_compartits, total_carros,
        score: { num_compartits: carros_compartits.length, num_multiples_5, suma_diferencies: suma_dif },
      })
    }
  }

  opcions.sort((a, b) => {
    if (a.score.num_compartits !== b.score.num_compartits) return a.score.num_compartits - b.score.num_compartits
    if (a.score.num_multiples_5 !== b.score.num_multiples_5) return b.score.num_multiples_5 - a.score.num_multiples_5
    return a.score.suma_diferencies - b.score.suma_diferencies
  })

  return opcions.slice(0, 5)
}

export default function Expedicions() {
  const params = useParams()
  const [full, setFull] = useState<Full | null>(null)
  const [expedicions, setExpedicions] = useState<Expedicio[]>([])
  const [destinacions, setDestinacions] = useState<Destinacio[]>([])
  const [transportistes, setTransportistes] = useState<Transportista[]>([])
  const [loading, setLoading] = useState(true)
  const [vacunes, setVacunes] = useState<Vacuna[]>([])

  const [mostrarForm, setMostrarForm] = useState(false)
  const [comandaId, setComandaId] = useState('')
  const [destinacioId, setDestinacioId] = useState('')
  const [transportistaId, setTransportistaId] = useState('')
  const [matricula, setMatricula] = useState('')
  const [horaPrevist, setHoraPrevist] = useState('')
  const [polletsComanda, setPolletsComanda] = useState('')
  const [sexatToggle, setSexatToggle] = useState(false)
  const [polletsM, setPolletsM] = useState('')
  const [polletsF, setPolletsF] = useState('')
  const [cercaDestinacio, setCercaDestinacio] = useState('')
  const [creant, setCreant] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [mostrarNovaGranja, setMostrarNovaGranja] = useState(false)
  const [novaGranjaNom, setNovaGranjaNom] = useState('')
  const [novaGranjaNau, setNovaGranjaNau] = useState('')
  const [novaGranjaPoblacio, setNovaGranjaPoblacio] = useState('')
  const [novaGranjaRega, setNovaGranjaRega] = useState('')
  const [creantGranja, setCreantGranja] = useState(false)
  const [errorGranja, setErrorGranja] = useState('')

  const [opcionsPerViatge, setOpcionsPerViatge] = useState<Record<string, Opcio[]>>({})
  const [opcioSeleccionada, setOpcioSeleccionada] = useState<Record<string, number>>({})

  const carregarDades = useCallback(async () => {
    if (!params.id) return
    const [fullRes, expRes] = await Promise.all([
      fetch(`/api/carrega/${params.id}`).then(r => r.json()),
      fetch(`/api/carrega/${params.id}/expedicions`).then(r => r.json()),
    ])
    setFull(fullRes)
    setExpedicions(expRes)
    setLoading(false)
  }, [params.id])

  useEffect(() => { carregarDades() }, [carregarDades])

  useEffect(() => {
    fetch('/api/transportistes').then(r => r.json()).then(setTransportistes)
    fetch('/api/vacunes').then(r => r.json()).then(data => setVacunes(Array.isArray(data) ? data : []))
  }, [])

  useEffect(() => {
    if (!comandaId || !full) return
    const comanda = full.comandes.find(c => c.id === parseInt(comandaId))
    if (!comanda) return
    fetch(`/api/destinacions?client_id=${comanda.clients.id}`)
      .then(r => r.json())
      .then(setDestinacions)
  }, [comandaId, full])

  async function crearNovaGranja() {
    if (!novaGranjaNom.trim()) return
    setCreantGranja(true)
    setErrorGranja('')
    const comanda = full?.comandes.find(c => c.id === parseInt(comandaId))
    const res = await fetch('/api/destinacions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom_granja: novaGranjaNom.trim(),
        nau: novaGranjaNau.trim() || null,
        poblacio: novaGranjaPoblacio.trim() || null,
        codi_rega: novaGranjaRega.trim() || null,
        client_id: comanda?.clients.id || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setErrorGranja(data.error || 'Error desconegut')
    } else {
      setDestinacions(prev => [...prev, data].sort((a, b) => a.nom_granja.localeCompare(b.nom_granja)))
      setDestinacioId(String(data.id))
      setCercaDestinacio(data.nom_granja)
      setMostrarNovaGranja(false)
      setNovaGranjaNom('')
      setNovaGranjaNau('')
      setNovaGranjaPoblacio('')
      setNovaGranjaRega('')
    }
    setCreantGranja(false)
  }

  async function crearExpedicio() {
    if (!comandaId || !destinacioId) return
    if (sexatToggle && (!polletsM || !polletsF)) return
    setCreant(true)
    setErrorMsg('')
    const postBody = sexatToggle
      ? {
          comanda_id: parseInt(comandaId),
          destinacio_id: parseInt(destinacioId),
          transportista_id: transportistaId ? parseInt(transportistaId) : null,
          matricula: matricula || null,
          hora_prevista_naixement: horaPrevist || null,
          sexat: true,
          polletsM: parseInt(polletsM) || null,
          polletsF: parseInt(polletsF) || null,
        }
      : {
          comanda_id: parseInt(comandaId),
          destinacio_id: parseInt(destinacioId),
          transportista_id: transportistaId ? parseInt(transportistaId) : null,
          matricula: matricula || null,
          hora_prevista_naixement: horaPrevist || null,
          pollets_comanda: polletsComanda ? parseInt(polletsComanda) : null,
          sexe: null,
        }
    const res = await fetch(`/api/carrega/${params.id}/expedicions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody),
    })
    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error || 'Error desconegut')
    } else {
      setMostrarForm(false)
      setComandaId('')
      setDestinacioId('')
      setTransportistaId('')
      setMatricula('')
      setHoraPrevist('')
      setPolletsComanda('')
      setSexatToggle(false)
      setPolletsM('')
      setPolletsF('')
      setCercaDestinacio('')
      setMostrarNovaGranja(false)
      setNovaGranjaNom('')
      setNovaGranjaNau('')
      setNovaGranjaPoblacio('')
      setNovaGranjaRega('')
      carregarDades()
    }
    setCreant(false)
  }

  async function toggleVacunaExpedicio(expedicioId: number, vacunaId: number, teVacuna: boolean) {
    if (teVacuna) {
      await fetch(`/api/expedicions/${expedicioId}/vacunes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacuna_id: vacunaId }),
      })
    } else {
      await fetch(`/api/expedicions/${expedicioId}/vacunes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacuna_id: vacunaId }),
      })
    }
    carregarDades()
  }

  async function eliminarExpedicio(id: number) {
    await fetch(`/api/carrega/${params.id}/expedicions`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expedicio_id: id }),
    })
    carregarDades()
  }

  async function actualitzarNumViatge(expId: number, val: number | null) {
    setExpedicions(prev => prev.map(e => e.id === expId ? { ...e, num_viatge: val } : e))
    await fetch(`/api/expedicions/${expId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ num_viatge: val }),
    })
  }

  function calcularGrup(grupKey: string, exps: Expedicio[], transportista: Transportista) {
    const opcions = calcularOpcions(exps, transportista)
    setOpcionsPerViatge(prev => ({ ...prev, [grupKey]: opcions }))
  }

  function triarOpcio(grupKey: string, idx: number, opcio: Opcio, transportista: Transportista, numViatge: number) {
    setOpcioSeleccionada(prev => ({ ...prev, [grupKey]: idx }))

    const expIdsEnCompartit = new Set<number>()
    opcio.carros_compartits.filter(cc => cc.items.length > 1).forEach(cc => {
      cc.items.forEach(it => expIdsEnCompartit.add(it.expedicio_id))
    })

    const per_expedicio: DistribucioSaved[string]['per_expedicio'] = {}
    opcio.resultats.forEach(r => {
      per_expedicio[String(r.expedicio_id)] = {
        carros_sencers: r.carros_sencers,
        pico_caixes: r.pico_caixes,
        pollets_reals: r.pollets_reals,
        diferencia: r.diferencia,
        en_carro_compartit: expIdsEnCompartit.has(r.expedicio_id),
      }
    })

    const lsKey = `mav_dist_${params.id}`
    let saved: DistribucioSaved = {}
    try {
      const raw = localStorage.getItem(lsKey)
      if (raw) saved = JSON.parse(raw)
    } catch { /* ignore */ }

    saved[grupKey] = {
      alcada: opcio.alcada,
      pollets_caixa: opcio.pollets_caixa,
      nom_transportista: transportista.nom,
      num_viatge: numViatge,
      transportista_id: transportista.id,
      per_expedicio,
      carros_compartits: opcio.carros_compartits,
    }
    localStorage.setItem(lsKey, JSON.stringify(saved))
  }

  if (loading || !full) return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <p style={{ color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', textAlign: 'center', padding: '2rem' }}>Carregant...</p>
    </main>
  )

  const vacunesNaixement = vacunes.filter(v => v.via?.toLowerCase().startsWith('naix'))

  const destinacionsFiltrades = destinacions.filter(d =>
    nomDestinacio(d).toLowerCase().includes(cercaDestinacio.toLowerCase()) ||
    (d.poblacio || '').toLowerCase().includes(cercaDestinacio.toLowerCase())
  )

  const polletsPerComanda: Record<number, { objectiu: number; assignats: number }> = {}
  full.comandes.filter(c => c.tipus === 'Pollets').forEach(c => {
    polletsPerComanda[c.id] = { objectiu: c.quantitat_pollets || 0, assignats: 0 }
  })
  expedicions.forEach(e => {
    const cid = e.comandes?.id
    if (cid && polletsPerComanda[cid]) polletsPerComanda[cid].assignats += e.pollets_comanda || 0
  })

  const grupsViatge: Array<{ key: string; transportista: Transportista; num_viatge: number; exps: Expedicio[] }> = []
  const grupMap = new Map<string, typeof grupsViatge[0]>()
  expedicions.forEach(e => {
    if (!e.transportistes || e.num_viatge == null) return
    const key = `${e.transportistes.id}_${e.num_viatge}`
    if (!grupMap.has(key)) {
      const t = transportistes.find(t => t.id === e.transportistes!.id)
      if (!t) return
      const g = { key, transportista: t, num_viatge: e.num_viatge, exps: [] as Expedicio[] }
      grupMap.set(key, g)
      grupsViatge.push(g)
    }
    grupMap.get(key)!.exps.push(e)
  })
  grupsViatge.sort((a, b) => {
    const nc = a.transportista.nom.localeCompare(b.transportista.nom)
    return nc !== 0 ? nc : a.num_viatge - b.num_viatge
  })

  const inputStyle = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '0.6rem 0.75rem', color: 'var(--text)', fontSize: '0.9rem',
    outline: 'none', fontFamily: 'IBM Plex Sans', width: '100%',
  }
  const labelStyle = {
    display: 'block' as const, fontSize: '0.7rem', fontFamily: 'IBM Plex Mono',
    color: 'var(--text-dim)', textTransform: 'uppercase' as const,
    letterSpacing: '0.1em', marginBottom: '0.4rem',
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '1.5rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Capçalera */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href={`/carrega/${full.id}`} style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: '0.85rem', fontFamily: 'IBM Plex Mono' }}>← Càrrega #{full.num_carrega}</Link>
            <div>
              <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Expedicions</p>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Repartiment de pollets</h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href={`/carrega/${params.id}/expedicions/naixement`} style={{ textDecoration: 'none' }}>
              <button style={{ padding: '0.6rem 1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                Dia del naixement
              </button>
            </Link>
            <Link href={`/carrega/${params.id}/expedicions/etiquetes-pollets`} style={{ textDecoration: 'none' }}>
              <button style={{ padding: '0.6rem 1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                🏷 Etiquetes
              </button>
            </Link>
            <button onClick={() => setMostrarForm(!mostrarForm)} style={{ padding: '0.6rem 1rem', background: 'var(--accent)', border: 'none', borderRadius: '8px', color: '#0f1117', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
              + Nova expedició
            </button>
          </div>
        </div>

        {/* Resum per comanda */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Resum comandes</div>
          {full.comandes.filter(c => c.tipus === 'Pollets').map(c => {
            const { objectiu, assignats } = polletsPerComanda[c.id] || { objectiu: 0, assignats: 0 }
            const diff = objectiu - assignats
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>{c.clients.nom}</span>
                <div style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem' }}>
                  <span style={{ color: assignats === objectiu ? 'var(--success)' : 'var(--accent)' }}>
                    {assignats.toLocaleString()} / {objectiu.toLocaleString()}
                  </span>
                  {diff !== 0 && (
                    <span style={{ marginLeft: '0.5rem', color: diff > 0 ? 'var(--danger)' : 'var(--text-dim)', fontSize: '0.75rem' }}>
                      {diff > 0 ? `−${diff.toLocaleString()} pendent` : `+${Math.abs(diff).toLocaleString()} excés`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Formulari nova expedició */}
        {mostrarForm && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Nova expedició</div>

            <div>
              <label style={labelStyle}>Comanda (client)</label>
              <select value={comandaId} onChange={e => { setComandaId(e.target.value); setDestinacioId(''); setCercaDestinacio('') }} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">Selecciona client...</option>
                {full.comandes.filter(c => c.tipus === 'Pollets').map(c => (
                  <option key={c.id} value={c.id}>{c.clients.nom} — {(c.quantitat_pollets || 0).toLocaleString()} pollets</option>
                ))}
              </select>
            </div>

            {comandaId && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Destinació</label>
                  <button
                    type="button"
                    onClick={() => { setMostrarNovaGranja(!mostrarNovaGranja); setErrorGranja('') }}
                    style={{
                      fontSize: '0.72rem', fontFamily: 'IBM Plex Mono', padding: '0.2rem 0.6rem',
                      borderRadius: '5px', cursor: 'pointer', border: '1px solid',
                      borderColor: mostrarNovaGranja ? 'var(--accent)' : 'var(--border)',
                      background: mostrarNovaGranja ? 'rgba(240,180,41,0.1)' : 'var(--bg)',
                      color: mostrarNovaGranja ? 'var(--accent)' : 'var(--text-dim)',
                    }}
                  >
                    + Nova granja
                  </button>
                </div>

                {mostrarNovaGranja && (
                  <div style={{ background: 'rgba(240,180,41,0.07)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.72rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nova granja</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={labelStyle}>Nom granja *</label>
                        <input
                          type="text"
                          value={novaGranjaNom}
                          onChange={e => setNovaGranjaNom(e.target.value)}
                          placeholder="Ex: Can Puig"
                          style={inputStyle}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Nau</label>
                        <input
                          type="text"
                          value={novaGranjaNau}
                          onChange={e => setNovaGranjaNau(e.target.value)}
                          placeholder="Ex: A"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={labelStyle}>Població</label>
                        <input
                          type="text"
                          value={novaGranjaPoblacio}
                          onChange={e => setNovaGranjaPoblacio(e.target.value)}
                          placeholder="Ex: Girona"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Codi REGA</label>
                        <input
                          type="text"
                          value={novaGranjaRega}
                          onChange={e => setNovaGranjaRega(e.target.value)}
                          placeholder="Ex: ES170120000012"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                    {errorGranja && (
                      <div style={{ padding: '0.4rem 0.6rem', borderRadius: '5px', background: 'rgba(240,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'IBM Plex Mono', fontSize: '0.75rem' }}>
                        {errorGranja}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => { setMostrarNovaGranja(false); setNovaGranjaNom(''); setNovaGranjaNau(''); setNovaGranjaPoblacio(''); setNovaGranjaRega(''); setErrorGranja('') }}
                        style={{ flex: 1, padding: '0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'IBM Plex Sans', fontSize: '0.82rem' }}
                      >
                        Cancel·lar
                      </button>
                      <button
                        type="button"
                        onClick={crearNovaGranja}
                        disabled={!novaGranjaNom.trim() || creantGranja}
                        style={{
                          flex: 2, padding: '0.5rem', border: 'none', borderRadius: '6px', fontWeight: 700,
                          fontFamily: 'IBM Plex Sans', fontSize: '0.82rem', cursor: 'pointer',
                          background: (!novaGranjaNom.trim() || creantGranja) ? 'var(--border)' : 'var(--accent)',
                          color: (!novaGranjaNom.trim() || creantGranja) ? 'var(--text-dim)' : '#0f1117',
                        }}
                      >
                        {creantGranja ? 'Creant...' : 'Crear granja'}
                      </button>
                    </div>
                  </div>
                )}

                <input type="text" placeholder="Cerca granja..." value={cercaDestinacio} onChange={e => setCercaDestinacio(e.target.value)} style={{ ...inputStyle, marginBottom: '0.4rem' }} />
                <select value={destinacioId} onChange={e => setDestinacioId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }} size={5}>
                  <option value="">Selecciona destinació...</option>
                  {destinacionsFiltrades.map(d => (
                    <option key={d.id} value={d.id}>{nomDestinacio(d)}{d.poblacio ? ` — ${d.poblacio}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle sexat */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ ...labelStyle, margin: 0 }}>Sexat</span>
              <button
                type="button"
                onClick={() => { setSexatToggle(!sexatToggle); setPolletsM(''); setPolletsF('') }}
                style={{
                  padding: '0.3rem 0.8rem', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono',
                  borderRadius: '6px', border: '1px solid',
                  borderColor: sexatToggle ? 'var(--accent)' : 'var(--border)',
                  background: sexatToggle ? 'rgba(240,180,41,0.12)' : 'var(--bg)',
                  color: sexatToggle ? 'var(--accent)' : 'var(--text-dim)',
                  cursor: 'pointer', fontWeight: sexatToggle ? 700 : 400,
                }}
              >
                {sexatToggle ? '✓ Actiu' : 'No'}
              </button>
            </div>

            {!sexatToggle ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Pollets previstos</label>
                  <input type="number" value={polletsComanda} onChange={e => setPolletsComanda(e.target.value)} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hora prevista</label>
                  <input type="text" value={horaPrevist} onChange={e => setHoraPrevist(e.target.value)} placeholder="8:00" style={inputStyle} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>♂ Mascles</label>
                  <input type="number" value={polletsM} onChange={e => setPolletsM(e.target.value)} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>♀ Femelles</label>
                  <input type="number" value={polletsF} onChange={e => setPolletsF(e.target.value)} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Hora prevista</label>
                  <input type="text" value={horaPrevist} onChange={e => setHoraPrevist(e.target.value)} placeholder="8:00" style={inputStyle} />
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Transportista</label>
                <select value={transportistaId} onChange={e => setTransportistaId(e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                  <option value="">Cap / per definir</option>
                  {transportistes.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Matrícula</label>
                <input type="text" value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="0000 AAA" style={inputStyle} />
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: '0.6rem', borderRadius: '6px', background: 'rgba(240,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setMostrarForm(false)} style={{ flex: 1, padding: '0.75rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
                Cancel·lar
              </button>
              <button onClick={crearExpedicio} disabled={!comandaId || !destinacioId || creant || (sexatToggle && (!polletsM || !polletsF))} style={{
                flex: 2, padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 700,
                fontFamily: 'IBM Plex Sans', fontSize: '0.9rem', cursor: 'pointer',
                background: (!comandaId || !destinacioId || creant || (sexatToggle && (!polletsM || !polletsF))) ? 'var(--border)' : 'var(--accent)',
                color: (!comandaId || !destinacioId || creant || (sexatToggle && (!polletsM || !polletsF))) ? 'var(--text-dim)' : '#0f1117',
              }}>
                {creant ? 'Creant...' : 'Crear expedició'}
              </button>
            </div>
          </div>
        )}

        {/* Llista d'expedicions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {expedicions.length === 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem', fontFamily: 'IBM Plex Mono' }}>Sense expedicions</p>
          )}
          {expedicions.map(e => (
            <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    {e.ordre && <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', color: 'var(--text-dim)', minWidth: '1.5rem' }}>#{e.ordre}</span>}
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{nomDestinacio(e.destinacions)}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>{e.comandes?.clients?.nom}</span>
                    {e.sexe && (
                      <span style={{
                        fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', fontWeight: 700,
                        padding: '0.1rem 0.5rem', borderRadius: '4px',
                        background: e.sexe === 'F' ? 'rgba(236,72,153,0.15)' : 'rgba(59,130,246,0.15)',
                        color: e.sexe === 'F' ? '#ec4899' : '#3b82f6',
                      }}>
                        {etiquetaSexe(e.sexe)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                    {e.pollets_comanda ? `${e.pollets_comanda.toLocaleString()} pollets previstos` : 'sense quantitat'}
                    {e.hora_prevista_naixement && ` · ${e.hora_prevista_naixement}`}
                    {e.transportistes && ` · ${e.transportistes.nom}`}
                    {e.matricula && ` · ${e.matricula}`}
                  </div>
                  {e.expedicio_lots.length > 0 && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--success)' }}>
                      {e.expedicio_lots.map(el => {
                        const granja = el.lots_reproductores.granges_reproductores.nom_informal || el.lots_reproductores.granges_reproductores.granja
                        return `${el.pollets.toLocaleString()} de ${granja}${el.lots_reproductores.estirp ? ` ${el.lots_reproductores.estirp}` : ''}`
                      }).join(' + ')}
                    </div>
                  )}

                  {/* Selector viatge */}
                  <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Viatge</span>
                    <select
                      value={e.num_viatge ?? ''}
                      onChange={ev => actualitzarNumViatge(e.id, ev.target.value === '' ? null : parseInt(ev.target.value))}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.2rem 0.5rem', color: e.num_viatge ? 'var(--accent)' : 'var(--text-dim)', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', cursor: 'pointer', outline: 'none', fontWeight: e.num_viatge ? 700 : 400 }}
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  {/* Vacunes naixement */}
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(240,180,41,0.08)', border: '1px solid var(--accent)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                      Vacunes naixement ({vacunesNaixement.length})
                    </div>
                    {vacunesNaixement.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)' }}>Cap vacuna de via Naixement a la BD</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {vacunesNaixement.map(v => {
                          const activa = e.expedicio_vacunes.some(ev => ev.vacuna_id === v.id)
                          return (
                            <button key={v.id} onClick={() => toggleVacunaExpedicio(e.id, v.id, activa)} style={{
                              padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontFamily: 'IBM Plex Mono',
                              borderRadius: '6px', cursor: 'pointer', border: '1px solid',
                              borderColor: activa ? 'var(--success)' : 'var(--border)',
                              background: activa ? 'rgba(34,197,94,0.15)' : 'var(--bg)',
                              color: activa ? 'var(--success)' : 'var(--text)',
                              fontWeight: activa ? 700 : 400,
                            }}>
                              {activa ? '✓ ' : ''}{v.nom}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => eliminarExpedicio(e.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem', marginLeft: '0.5rem' }}>✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Distribució de carros per viatge */}
        {grupsViatge.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1rem' }}>
              Distribució de carros per viatge
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {grupsViatge.map(g => {
                const opcions = opcionsPerViatge[g.key]
                const selIdx = opcioSeleccionada[g.key] ?? -1
                const teParametres = !!(g.transportista.alcada_min && g.transportista.alcada_max &&
                  g.transportista.pollets_caixa_min && g.transportista.pollets_caixa_max && g.transportista.max_carros)

                return (
                  <div key={g.key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{g.transportista.nom}</span>
                        <span style={{ marginLeft: '0.5rem', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700 }}>Viatge {g.num_viatge}</span>
                        {g.transportista.max_carros && (
                          <span style={{ marginLeft: '0.5rem', fontFamily: 'IBM Plex Mono', fontSize: '0.72rem', color: 'var(--text-dim)' }}>(màx. {g.transportista.max_carros} carros)</span>
                        )}
                      </div>
                      <button onClick={() => calcularGrup(g.key, g.exps, g.transportista)} disabled={!teParametres}
                        title={!teParametres ? 'El transportista no té els paràmetres de carro configurats' : undefined}
                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', fontFamily: 'IBM Plex Mono', borderRadius: '6px', border: '1px solid', borderColor: teParametres ? 'var(--accent)' : 'var(--border)', background: 'var(--bg)', color: teParametres ? 'var(--accent)' : 'var(--text-dim)', cursor: teParametres ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                        Calcular opcions
                      </button>
                    </div>

                    <div style={{ marginBottom: '0.75rem' }}>
                      {g.exps.map(e => (
                        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.25rem 0', borderBottom: '1px solid var(--border)' }}>
                          <span>{e.comandes?.clients?.nom} — {nomDestinacio(e.destinacions)}</span>
                          <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                            {e.pollets_comanda ? e.pollets_comanda.toLocaleString() : '—'} pollets
                          </span>
                        </div>
                      ))}
                    </div>

                    {opcions !== undefined && opcions.length === 0 && (
                      <div style={{ padding: '0.5rem', fontFamily: 'IBM Plex Mono', fontSize: '0.78rem', color: 'var(--danger)' }}>
                        Cap combinació vàlida amb els paràmetres actuals.
                      </div>
                    )}

                    {opcions && opcions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {opcions.map((opcio, idx) => {
                          const sel = selIdx === idx
                          return (
                            <div key={idx} style={{ border: '1px solid', borderColor: sel ? 'var(--success)' : 'var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', background: sel ? 'rgba(34,197,94,0.06)' : 'var(--bg)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.82rem' }}>
                                  <span style={{ fontWeight: 700 }}>Alçada: {opcio.alcada} cx · Pollets/caixa: {opcio.pollets_caixa}</span>
                                  <span style={{ marginLeft: '0.6rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                                    {opcio.total_carros} carros
                                    {opcio.carros_compartits.filter(cc => cc.items.length > 1).length > 0 && (
                                      <span style={{ color: 'var(--accent)' }}>{' '}({opcio.carros_compartits.filter(cc => cc.items.length > 1).length} compartit{opcio.carros_compartits.filter(cc => cc.items.length > 1).length > 1 ? 's' : ''})</span>
                                    )}
                                  </span>
                                </div>
                                <button onClick={() => triarOpcio(g.key, idx, opcio, g.transportista, g.num_viatge)}
                                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontFamily: 'IBM Plex Mono', borderRadius: '6px', cursor: 'pointer', border: '1px solid', borderColor: sel ? 'var(--success)' : 'var(--border)', background: sel ? 'rgba(34,197,94,0.18)' : 'var(--bg)', color: sel ? 'var(--success)' : 'var(--text)', fontWeight: sel ? 700 : 400, whiteSpace: 'nowrap' }}>
                                  {sel ? '✓ Triada' : 'Triar aquesta opció'}
                                </button>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: opcio.carros_compartits.some(cc => cc.items.length > 1) ? '0.5rem' : 0 }}>
                                {opcio.resultats.map(r => (
                                  <div key={r.expedicio_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontFamily: 'IBM Plex Mono' }}>
                                    <span style={{ color: 'var(--text)' }}>{r.client}</span>
                                    <span>
                                      <span style={{ color: 'var(--text)' }}>{r.carros_sencers}c</span>
                                      {r.pico_caixes > 0 && <span style={{ color: 'var(--accent)' }}> + {r.pico_caixes} cx pico</span>}
                                      <span style={{ color: 'var(--text-dim)' }}> · {r.pollets_reals.toLocaleString()} pollets</span>
                                      {r.diferencia > 0 && <span style={{ color: r.diferencia >= 50 ? 'var(--danger)' : 'var(--text-dim)' }}> (Δ{r.diferencia})</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {opcio.carros_compartits.some(cc => cc.items.length > 1) && (
                                <div style={{ padding: '0.45rem 0.6rem', background: 'rgba(240,180,41,0.07)', borderRadius: '6px', border: '1px solid rgba(240,180,41,0.2)' }}>
                                  <div style={{ fontSize: '0.62rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Carros compartits</div>
                                  {opcio.carros_compartits.filter(cc => cc.items.length > 1).map((cc, ci) => (
                                    <div key={ci} style={{ fontSize: '0.75rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                                      Carro {ci + 1} ({cc.alcada_carro} cx): {cc.items.map(it => `${it.client} ${it.caixes}cx`).join(' + ')}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
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
