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
  telefon: string | null
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
  quantitat_ous_maquila: number | null
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
  distribucio_carros: DistribucioSaved | null
  comandes: Comanda[]
  assignacions: {
    es_maquila: boolean
    carros_estoc: { quantitat_ous: number } | null
    transferencies: {
      resultats_naix: { pollets_nascuts: number }[]
    }[]
  }[]
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

// Desviació màxima (en pollets) que pot tenir una expedició respecte de la
// quantitat demanada perquè una combinació es consideri vàlida. Com més alt,
// més opcions de repartiment apareixen.
const DELTA_MAX_POLLETS = 300

function calcularOpcions(exps: Expedicio[], t: Transportista, forcaAlcada?: number, forcaPc?: number): Opcio[] {
  const { alcada_min, alcada_max, pollets_caixa_min, pollets_caixa_max, max_carros } = t
  if (!alcada_min || !alcada_max || !pollets_caixa_min || !pollets_caixa_max || !max_carros) return []

  const opcions: Opcio[] = []

  const minA = forcaAlcada || alcada_min;
  const maxA = forcaAlcada || alcada_max;
  const minPc = forcaPc || pollets_caixa_min;
  const maxPc = forcaPc || pollets_caixa_max;

  for (let alcada = minA; alcada <= maxA; alcada++) {
    for (let pc = minPc; pc <= maxPc; pc++) {
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

      if (resultats.some(r => r.diferencia >= DELTA_MAX_POLLETS)) continue

      const total_sencers = resultats.reduce((s, r) => s + r.carros_sencers, 0)
      const amPico = resultats.filter(r => r.pico_caixes > 0)

      const total_picos_caixes = amPico.reduce((s, r) => s + r.pico_caixes, 0)
      if (total_sencers * alcada + total_picos_caixes > max_carros * alcada) continue

      let carros_compartits: CarroCompartit[] = []

      if (amPico.length > 0) {
        if (total_sencers + amPico.length <= max_carros) {
          // Hi ha carros de sobres: cada pico va al seu propi carro (sense barrejar clients)
          carros_compartits = amPico.map(r => ({
            alcada_carro: r.pico_caixes,
            items: [{ expedicio_id: r.expedicio_id, client: r.client, caixes: r.pico_caixes }],
          }))
        } else {
          // No hi ha prou carros perquè cada pico vagi sol: empaquetem les caixes
          // sobrants en carros compartits amb first-fit decreixent, respectant SEMPRE
          // l'alçada del carro (cap carro pot superar 'alcada' caixes). Com que cada
          // pico individual ja és ≤ alcada, sempre hi cap com a mínim sol.
          const ordenats = [...amPico].sort((a, b) => b.pico_caixes - a.pico_caixes)
          const bins: CarroCompartit[] = []
          for (const r of ordenats) {
            let bin = bins.find(b => b.alcada_carro + r.pico_caixes <= alcada)
            if (!bin) { bin = { alcada_carro: 0, items: [] }; bins.push(bin) }
            bin.items.push({ expedicio_id: r.expedicio_id, client: r.client, caixes: r.pico_caixes })
            bin.alcada_carro += r.pico_caixes
          }
          carros_compartits = bins
        }
      }

      // Seguretat: cap carro compartit pot superar l'alçada (el bin-packing ja ho garanteix)
      if (carros_compartits.some(g => g.alcada_carro > alcada)) continue

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
  const [novaGranjaTelefon, setNovaGranjaTelefon] = useState('')
  const [creantGranja, setCreantGranja] = useState(false)
  const [errorGranja, setErrorGranja] = useState('')

  // Edició del telèfon de la destinació ja seleccionada
  const [editTelefon, setEditTelefon] = useState('')
  const [guardantTelefon, setGuardantTelefon] = useState(false)

  const [opcionsPerViatge, setOpcionsPerViatge] = useState<Record<string, Opcio[]>>({})
  const [opcioSeleccionada, setOpcioSeleccionada] = useState<Record<string, number>>({})
  const [filtresGrup, setFiltresGrup] = useState<Record<string, { alcada: string, pc: string }>>({})
  const [aplicantDist, setAplicantDist] = useState<string | null>(null)

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
    // Maquila: prefill amb els pollets nascuts dels seus ous (el que neix va a la seva granja)
    if (comanda.tipus === 'Maquila') {
      const nascutsMaquila = (full.assignacions || []).reduce(
        (s, a) => a.es_maquila
          ? s + (a.transferencies?.reduce((tA, t) => tA + (t.resultats_naix?.reduce((rA, r) => rA + (r.pollets_nascuts || 0), 0) || 0), 0) || 0)
          : s,
        0
      )
      setPolletsComanda(nascutsMaquila > 0 ? String(nascutsMaquila) : '')
    }
  }, [comandaId, full])

  // Quan se selecciona una destinació, precarrega el seu telèfon a l'editor
  useEffect(() => {
    if (!destinacioId) { setEditTelefon(''); return }
    const d = destinacions.find(x => x.id === parseInt(destinacioId))
    setEditTelefon(d?.telefon || '')
  }, [destinacioId, destinacions])

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
        telefon: novaGranjaTelefon.trim() || null,
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
      setNovaGranjaTelefon('')
    }
    setCreantGranja(false)
  }

  async function guardarTelefonDestinacio() {
    if (!destinacioId) return
    setGuardantTelefon(true)
    const id = parseInt(destinacioId)
    const nou = editTelefon.trim() || null
    const res = await fetch(`/api/destinacions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefon: nou }),
    })
    if (res.ok) {
      setDestinacions(prev => prev.map(d => d.id === id ? { ...d, telefon: nou } : d))
    }
    setGuardantTelefon(false)
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
      setNovaGranjaTelefon('')
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

  // Canviar el xofer d'una expedició ja creada. En fer-ho, es reinicia el viatge
  // (num_viatge → null) perquè s'hagi de tornar a triar i recalcular la distribució
  // de carros amb el nou transportista.
  async function actualitzarTransportista(expId: number, val: number | null) {
    const transportista = val ? transportistes.find(t => t.id === val) ?? null : null
    setExpedicions(prev => prev.map(e => e.id === expId
      ? { ...e, transportistes: transportista ? { id: transportista.id, nom: transportista.nom } : null, num_viatge: null }
      : e))
    setOpcionsPerViatge({})
    setOpcioSeleccionada({})
    await fetch(`/api/expedicions/${expId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transportista_id: val, num_viatge: null }),
    })
    await carregarDades()
  }

  async function actualitzarPolletsComanda(expId: number, valor: string) {
    const num = valor.trim() === '' ? null : parseInt(valor)
    if (num !== null && (isNaN(num) || num < 0)) return
    setExpedicions(prev => prev.map(e => e.id === expId ? { ...e, pollets_comanda: num } : e))
    await fetch(`/api/expedicions/${expId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollets_comanda: num }),
    })
  }

  function calcularGrup(grupKey: string, exps: Expedicio[], transportista: Transportista) {
    const f = filtresGrup[grupKey] || {}
    const forcaAlcada = f.alcada ? parseInt(f.alcada) : undefined
    const forcaPc = f.pc ? parseInt(f.pc) : undefined
    const opcions = calcularOpcions(exps, transportista, forcaAlcada, forcaPc)
    setOpcionsPerViatge(prev => ({ ...prev, [grupKey]: opcions }))
  }

  async function triarOpcio(grupKey: string, idx: number, opcio: Opcio, transportista: Transportista, numViatge: number) {
    setOpcioSeleccionada(prev => ({ ...prev, [grupKey]: idx }))
    setAplicantDist(grupKey)

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

    // Fusionar amb la distribució ja desada (altres viatges) i persistir-ho a la BD
    const novaDist: DistribucioSaved = { ...(full?.distribucio_carros || {}) }
    novaDist[grupKey] = {
      alcada: opcio.alcada,
      pollets_caixa: opcio.pollets_caixa,
      nom_transportista: transportista.nom,
      num_viatge: numViatge,
      transportista_id: transportista.id,
      per_expedicio,
      carros_compartits: opcio.carros_compartits,
    }

    await fetch(`/api/carrega/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distribucio_carros: novaDist }),
    })

    // Sobreescriure la quantitat de cada expedició amb el seu pollets_reals (arrodonit a caixes/carros)
    await Promise.all(opcio.resultats.map(r =>
      fetch(`/api/expedicions/${r.expedicio_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollets_comanda: r.pollets_reals }),
      })
    ))

    await carregarDades()
    setAplicantDist(null)
  }

  if (loading || !full) return (
    <div className="bg-bg min-h-[50vh] p-4 md:p-6 flex items-center justify-center">
      <p className="text-text-dim mono text-center">Carregant...</p>
    </div>
  )

  const vacunesNaixement = vacunes.filter(v => v.via?.toLowerCase().startsWith('naix'))

  const destinacionsFiltrades = destinacions.filter(d =>
    nomDestinacio(d).toLowerCase().includes(cercaDestinacio.toLowerCase()) ||
    (d.poblacio || '').toLowerCase().includes(cercaDestinacio.toLowerCase())
  )

  // Maquila: ous entrats (del client) i pollets nascuts dels seus ous.
  // No hi ha previsió calculada — el que neix va a la seva granja; si en falten s'hi afegeixen pollets nostres.
  const ousMaquilaEntrats = (full.assignacions || []).reduce(
    (s, a) => s + (a.es_maquila ? (a.carros_estoc?.quantitat_ous || 0) : 0), 0
  )
  const maquilaNascuts = (full.assignacions || []).reduce(
    (s, a) => a.es_maquila
      ? s + (a.transferencies?.reduce((tA, t) => tA + (t.resultats_naix?.reduce((rA, r) => rA + (r.pollets_nascuts || 0), 0) || 0), 0) || 0)
      : s,
    0
  )

  // Comandes ordenades: pollets primer, maquila sempre al final (abans de SOBRANTS)
  const comandesMaquila = full.comandes.filter(c => c.tipus === 'Maquila')
  const comandesOrdenades = [
    ...full.comandes.filter(c => c.tipus === 'Pollets'),
    ...comandesMaquila,
  ]
  const nMaquila = comandesMaquila.length

  const polletsPerComanda: Record<number, { objectiu: number; assignats: number; maquila: boolean }> = {}
  comandesOrdenades.forEach(c => {
    const esMaquila = c.tipus === 'Maquila'
    polletsPerComanda[c.id] = {
      // Per maquila l'objectiu de referència són els pollets nascuts dels seus ous (repartits si n'hi ha més d'una)
      objectiu: esMaquila ? (nMaquila > 0 ? Math.round(maquilaNascuts / nMaquila) : 0) : (c.quantitat_pollets || 0),
      assignats: 0,
      maquila: esMaquila,
    }
  })
  expedicions.forEach(e => {
    const cid = e.comandes?.id
    if (cid && polletsPerComanda[cid]) polletsPerComanda[cid].assignats += e.pollets_comanda || 0
  })

  const totalNascuts = full.assignacions?.reduce((acc, a) => {
    return acc + (a.transferencies?.reduce((tAcc, t) => {
      return tAcc + (t.resultats_naix?.reduce((rAcc, r) => rAcc + (r.pollets_nascuts || 0), 0) || 0)
    }, 0) || 0)
  }, 0) || 0

  const totalAssignats = Object.values(polletsPerComanda).reduce((s, c) => s + c.assignats, 0)
  const sobrants = totalNascuts - totalAssignats

  const comandaSel = comandaId ? full.comandes.find(c => c.id === parseInt(comandaId)) : undefined
  const comandaSelMaquila = comandaSel?.tipus === 'Maquila'

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

  const inputClasses = "bg-surface border border-border rounded-lg p-2.5 text-text text-sm outline-none font-sans w-full focus:border-accent focus:ring-1 focus:ring-accent transition-all"
  const labelClasses = "block text-[11px] mono text-text-dim uppercase tracking-wider mb-1.5"

  return (
    <div className="bg-bg min-h-full p-4 md:p-6 pb-20">
      <div className="max-w-3xl mx-auto w-full space-y-4 md:space-y-6">

        {/* Capçalera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <Link href={`/carrega/${full.id}`} className="hidden md:block text-text-dim no-underline text-sm mono hover:text-accent transition-colors">← Càrrega #{full.num_carrega}</Link>
            <div>
              <p className="text-accent mono text-[11px] tracking-wider uppercase m-0">Expedicions</p>
              <h1 className="text-xl md:text-2xl font-bold m-0">Repartiment de pollets</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/carrega/${params.id}/expedicions/naixement`} className="no-underline flex-1 md:flex-none">
              <button className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-text font-bold text-sm cursor-pointer hover:bg-surface transition-colors shadow-sm">
                Dia del naixement
              </button>
            </Link>
            <Link href={`/carrega/${params.id}/expedicions/etiquetes-pollets`} className="no-underline flex-1 md:flex-none">
              <button className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-text font-bold text-sm cursor-pointer hover:bg-surface transition-colors shadow-sm">
                🏷 Etiquetes
              </button>
            </Link>
            <Link href={`/carrega/${params.id}/expedicions/imprimir-granges`} target="_blank" className="no-underline flex-1 md:flex-none">
              <button className="w-full px-4 py-2.5 bg-bg border border-border rounded-lg text-text font-bold text-sm cursor-pointer hover:bg-surface transition-colors shadow-sm">
                📄 Full granges
              </button>
            </Link>
            <button onClick={() => setMostrarForm(!mostrarForm)} className="w-full md:w-auto px-4 py-2.5 bg-accent border-none rounded-lg text-white font-bold text-sm cursor-pointer hover:bg-accent-dim transition-colors shadow-sm">
              + Nova expedició
            </button>
          </div>
        </div>

        {/* Resum per comanda */}
        <div className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm">
          <div className="text-[11px] mono text-text-dim uppercase tracking-wider mb-3">Resum comandes</div>
          {comandesOrdenades.map(c => {
            const { objectiu, assignats, maquila } = polletsPerComanda[c.id] || { objectiu: 0, assignats: 0, maquila: false }
            const diff = objectiu - assignats
            return (
              <div key={c.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-border text-sm gap-1 sm:gap-0">
                <span className="font-semibold flex items-center gap-2">
                  {c.clients.nom}
                  {maquila && (
                    <span className="text-[10px] mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 uppercase tracking-wider">
                      Maquila
                    </span>
                  )}
                </span>
                <div className="text-left sm:text-right mono text-sm">
                  <span className={assignats === objectiu ? 'text-success' : 'text-accent'}>
                    {assignats.toLocaleString()} / {objectiu.toLocaleString()}
                  </span>
                  {maquila ? (
                    <span className="ml-2 text-xs text-text-dim">nascuts dels seus ous</span>
                  ) : diff !== 0 && (
                    <span className={`ml-2 text-xs ${diff > 0 ? 'text-danger' : 'text-text-dim'}`}>
                      {diff > 0 ? `−${diff.toLocaleString()} pendent` : `+${Math.abs(diff).toLocaleString()} excés`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {ousMaquilaEntrats > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-border text-sm">
              <span className="text-purple-600 dark:text-purple-400 mono text-xs uppercase tracking-wider">Ous de maquila entrats</span>
              <span className="mono text-sm text-purple-600 dark:text-purple-400 font-bold">{ousMaquilaEntrats.toLocaleString()} ous</span>
            </div>
          )}
          {totalNascuts > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', marginTop: '0.5rem', borderTop: '2px solid var(--border)', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 700 }}>SOBRANTS</span>
              <div style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: '0.85rem', fontWeight: 700, color: sobrants > 0 ? 'var(--success)' : sobrants < 0 ? 'var(--danger)' : 'var(--text-dim)' }}>
                {sobrants.toLocaleString()} pollets
              </div>
            </div>
          )}
        </div>

        {/* Formulari nova expedició */}
        {mostrarForm && (
          <div className="bg-surface border border-accent/30 shadow-md rounded-xl p-4 md:p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="text-sm font-bold">Nova expedició</div>

            <div>
              <label className={labelClasses}>Comanda (client)</label>
              <select value={comandaId} onChange={e => { setComandaId(e.target.value); setDestinacioId(''); setCercaDestinacio('') }} className={inputClasses}>
                <option value="">Selecciona client...</option>
                {comandesOrdenades.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.tipus === 'Maquila'
                      ? `${c.clients.nom} — MAQUILA (${(c.quantitat_ous_maquila || 0).toLocaleString()} ous)`
                      : `${c.clients.nom} — ${(c.quantitat_pollets || 0).toLocaleString()} pollets`}
                  </option>
                ))}
              </select>
            </div>

            {comandaId && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`${labelClasses} !mb-0`}>Destinació</label>
                  <button
                    type="button"
                    onClick={() => { setMostrarNovaGranja(!mostrarNovaGranja); setErrorGranja('') }}
                    className={`text-xs px-2.5 py-1 rounded-md cursor-pointer border font-mono transition-colors ${
                      mostrarNovaGranja 
                        ? 'border-accent bg-accent/10 text-accent' 
                        : 'border-border bg-bg text-text-dim hover:text-text'
                    }`}
                  >
                    + Nova granja
                  </button>
                </div>

                {mostrarNovaGranja && (
                  <div style={{ background: 'rgba(240,180,41,0.07)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.72rem', fontFamily: 'IBM Plex Mono', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nova granja</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label className={labelClasses}>Nom granja *</label>
                        <input
                          type="text"
                          value={novaGranjaNom}
                          onChange={e => setNovaGranjaNom(e.target.value)}
                          placeholder="Ex: Can Puig"
                          className={inputClasses}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className={labelClasses}>Nau</label>
                        <input
                          type="text"
                          value={novaGranjaNau}
                          onChange={e => setNovaGranjaNau(e.target.value)}
                          placeholder="Ex: A"
                          className={inputClasses}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label className={labelClasses}>Població</label>
                        <input
                          type="text"
                          value={novaGranjaPoblacio}
                          onChange={e => setNovaGranjaPoblacio(e.target.value)}
                          placeholder="Ex: Girona"
                          className={inputClasses}
                        />
                      </div>
                      <div>
                        <label className={labelClasses}>Codi REGA</label>
                        <input
                          type="text"
                          value={novaGranjaRega}
                          onChange={e => setNovaGranjaRega(e.target.value)}
                          placeholder="Ex: ES170120000012"
                          className={inputClasses}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClasses}>Telèfon</label>
                      <input
                        type="tel"
                        value={novaGranjaTelefon}
                        onChange={e => setNovaGranjaTelefon(e.target.value)}
                        placeholder="Ex: 600 123 456"
                        className={inputClasses}
                      />
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

                <input type="text" placeholder="Cerca granja..." value={cercaDestinacio} onChange={e => setCercaDestinacio(e.target.value)} className={`${inputClasses} mb-1.5`} />
                <select value={destinacioId} onChange={e => setDestinacioId(e.target.value)} className={inputClasses} size={5}>
                  <option value="">Selecciona destinació...</option>
                  {destinacionsFiltrades.map(d => (
                    <option key={d.id} value={d.id}>{nomDestinacio(d)}{d.poblacio ? ` — ${d.poblacio}` : ''}</option>
                  ))}
                </select>

                {destinacioId && (
                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <label className={labelClasses}>Telèfon de la granja</label>
                      <input
                        type="tel"
                        value={editTelefon}
                        onChange={e => setEditTelefon(e.target.value)}
                        placeholder="Sense telèfon"
                        className={inputClasses}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={guardarTelefonDestinacio}
                      disabled={guardantTelefon}
                      className="px-3 py-2.5 rounded-lg border border-border bg-bg text-text-dim text-sm cursor-pointer hover:text-text hover:border-accent transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {guardantTelefon ? 'Desant...' : 'Desar telèfon'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Toggle sexat */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className={`${labelClasses} !m-0`}>Sexat</span>
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
                  <label className={labelClasses}>Pollets previstos</label>
                  <input type="number" value={polletsComanda} onChange={e => setPolletsComanda(e.target.value)} placeholder="0" className={inputClasses} />
                  {comandaSelMaquila && (
                    <p className="text-[10px] mono text-purple-600 dark:text-purple-400 mt-1 mb-0">
                      Maquila: {ousMaquilaEntrats.toLocaleString()} ous entrats · {maquilaNascuts.toLocaleString()} nascuts. Si en falten, afegeix-hi pollets nostres el dia del naixement.
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClasses}>Hora prevista</label>
                  <input type="text" value={horaPrevist} onChange={e => setHoraPrevist(e.target.value)} placeholder="8:00" className={inputClasses} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className={labelClasses}>♂ Mascles</label>
                  <input type="number" value={polletsM} onChange={e => setPolletsM(e.target.value)} placeholder="0" className={inputClasses} />
                </div>
                <div>
                  <label className={labelClasses}>♀ Femelles</label>
                  <input type="number" value={polletsF} onChange={e => setPolletsF(e.target.value)} placeholder="0" className={inputClasses} />
                </div>
                <div>
                  <label className={labelClasses}>Hora prevista</label>
                  <input type="text" value={horaPrevist} onChange={e => setHoraPrevist(e.target.value)} placeholder="8:00" className={inputClasses} />
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className={labelClasses}>Transportista</label>
                <select value={transportistaId} onChange={e => setTransportistaId(e.target.value)} className={inputClasses}>
                  <option value="">Cap / per definir</option>
                  {transportistes.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Matrícula</label>
                <input type="text" value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="0000 AAA" className={inputClasses} />
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
        <div className="flex flex-col gap-3">
          {expedicions.length === 0 && (
            <p className="text-text-dim text-sm text-center p-8 mono">Sense expedicions</p>
          )}
          {expedicions.map(e => (
            <div key={e.id} className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {e.ordre && <span className="mono text-[11px] text-text-dim min-w-[1.5rem]">#{e.ordre}</span>}
                    <span className="font-bold text-[15px]">{nomDestinacio(e.destinacions)}</span>
                    <span className="text-xs text-text-dim mono">{e.comandes?.clients?.nom}</span>
                    {e.sexe && (
                      <span className={`text-[11px] mono font-bold px-2 py-0.5 rounded ${
                        e.sexe === 'F' 
                          ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400' 
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {etiquetaSexe(e.sexe)}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-text-dim mono flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={e.pollets_comanda ?? ''}
                        onChange={ev => setExpedicions(prev => prev.map(x => x.id === e.id ? { ...x, pollets_comanda: ev.target.value === '' ? null : parseInt(ev.target.value) } : x))}
                        onBlur={ev => actualitzarPolletsComanda(e.id, ev.target.value)}
                        placeholder="0"
                        className="bg-bg border border-border rounded px-1.5 py-0.5 w-20 text-text mono text-[12px] outline-none focus:border-accent transition-colors"
                      />
                      pollets previstos
                    </span>
                    {e.hora_prevista_naixement && <span>· {e.hora_prevista_naixement}</span>}
                    {e.transportistes && <span>· {e.transportistes.nom}</span>}
                    {e.matricula && <span>· {e.matricula}</span>}
                  </div>
                  {e.expedicio_lots.length > 0 && (
                    <div className="mt-1.5 text-[12px] mono text-success">
                      {e.expedicio_lots.map(el => {
                        const granja = el.lots_reproductores.granges_reproductores.nom_informal || el.lots_reproductores.granges_reproductores.granja
                        return `${el.pollets.toLocaleString()} de ${granja}${el.lots_reproductores.estirp ? ` ${el.lots_reproductores.estirp}` : ''}`
                      }).join(' + ')}
                    </div>
                  )}

                  {/* Selectors xofer + viatge */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] mono text-text-dim uppercase tracking-wider">Xofer</span>
                      <select
                        value={e.transportistes?.id ?? ''}
                        onChange={ev => actualitzarTransportista(e.id, ev.target.value === '' ? null : parseInt(ev.target.value))}
                        className={`bg-surface border border-border rounded-lg px-2 py-1 text-[12px] mono outline-none cursor-pointer ${e.transportistes ? 'text-text font-bold' : 'text-text-dim font-normal'}`}
                      >
                        <option value="">Cap / per definir</option>
                        {transportistes.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] mono text-text-dim uppercase tracking-wider">Viatge</span>
                      <select
                        value={e.num_viatge ?? ''}
                        onChange={ev => actualitzarNumViatge(e.id, ev.target.value === '' ? null : parseInt(ev.target.value))}
                        className={`bg-surface border border-border rounded-lg px-2 py-1 text-[12px] mono outline-none cursor-pointer ${e.num_viatge ? 'text-accent font-bold' : 'text-text-dim font-normal'}`}
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Vacunes naixement */}
                  <div className="mt-3 p-3 bg-accent/5 border border-accent/20 rounded-lg">
                    <div className="text-[10px] mono text-accent uppercase tracking-wider mb-2">
                      Vacunes naixement ({vacunesNaixement.length})
                    </div>
                    {vacunesNaixement.length === 0 ? (
                      <span className="text-[11px] mono text-text-dim">Cap vacuna de via Naixement a la BD</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {vacunesNaixement.map(v => {
                          const activa = e.expedicio_vacunes.some(ev => ev.vacuna_id === v.id)
                          return (
                            <button key={v.id} onClick={() => toggleVacunaExpedicio(e.id, v.id, activa)} className={`
                              px-3 py-1.5 text-[12px] mono rounded-lg border transition-colors
                              ${activa ? 'bg-success/10 border-success text-success font-bold' : 'bg-bg border-border text-text hover:bg-surface'}
                            `}>
                              {activa ? '✓ ' : ''}{v.nom}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => eliminarExpedicio(e.id)} className="bg-transparent border-none text-danger cursor-pointer text-sm p-1 ml-2 hover:bg-danger/10 rounded">✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Distribució de carros per viatge */}
        {grupsViatge.length > 0 && (
          <div className="mt-8">
            <div className="text-[11px] mono text-text-dim uppercase tracking-wider mb-4">
              Distribució de carros per viatge
            </div>
            <div className="flex flex-col gap-4">
              {grupsViatge.map(g => {
                const opcions = opcionsPerViatge[g.key]
                const selIdx = opcioSeleccionada[g.key] ?? -1
                const teParametres = !!(g.transportista.alcada_min && g.transportista.alcada_max &&
                  g.transportista.pollets_caixa_min && g.transportista.pollets_caixa_max && g.transportista.max_carros)

                return (
                  <div key={g.key} className="bg-surface border border-border rounded-xl p-4 md:p-5 shadow-sm">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                      <div>
                        <span className="font-bold text-[15px]">{g.transportista.nom}</span>
                        <span className="ml-2 mono text-xs text-accent font-bold">Viatge {g.num_viatge}</span>
                        {g.transportista.max_carros && (
                          <span className="ml-2 mono text-[11px] text-text-dim">(màx. {g.transportista.max_carros} carros)</span>
                        )}
                        {full.distribucio_carros?.[g.key] && (
                          <span className="ml-2 mono text-[11px] text-success">✓ aplicada: {full.distribucio_carros[g.key].alcada} cx · {full.distribucio_carros[g.key].pollets_caixa} p/cx</span>
                        )}
                      </div>
                      <div className="flex flex-wrap md:flex-nowrap gap-2 items-center">
                        <div className="flex gap-1 items-center flex-1 md:flex-none">
                          <span className="text-xs mono text-text-dim">Alçada:</span>
                          <input type="number" placeholder="Auto" min="1"
                            value={filtresGrup[g.key]?.alcada || ''} 
                            onChange={e => setFiltresGrup(prev => ({ ...prev, [g.key]: { ...(prev[g.key] || {pc: ''}), alcada: e.target.value } }))} 
                            className="bg-bg border border-border rounded-lg px-2 py-1 text-xs w-full md:w-16 outline-none focus:border-accent"
                          />
                        </div>
                        <div className="flex gap-1 items-center flex-1 md:flex-none">
                          <span className="text-xs mono text-text-dim">Pollets/cx:</span>
                          <input type="number" placeholder="Auto" min="1"
                            value={filtresGrup[g.key]?.pc || ''} 
                            onChange={e => setFiltresGrup(prev => ({ ...prev, [g.key]: { ...(prev[g.key] || {alcada: ''}), pc: e.target.value } }))} 
                            className="bg-bg border border-border rounded-lg px-2 py-1 text-xs w-full md:w-16 outline-none focus:border-accent"
                          />
                        </div>
                        <button onClick={() => calcularGrup(g.key, g.exps, g.transportista)} disabled={!teParametres}
                          title={!teParametres ? 'El transportista no té els paràmetres de carro configurats' : undefined}
                          className={`w-full md:w-auto px-4 py-1.5 text-xs mono rounded-lg border font-bold transition-colors ${
                            teParametres 
                              ? 'border-accent bg-bg text-accent cursor-pointer hover:bg-accent/10' 
                              : 'border-border bg-bg text-text-dim cursor-not-allowed opacity-50'
                          }`}>
                          Calcular opcions
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 space-y-1">
                      {g.exps.map(e => (
                        <div key={e.id} className="flex justify-between text-sm py-1 border-b border-border">
                          <span>{e.comandes?.clients?.nom} — {nomDestinacio(e.destinacions)}</span>
                          <span className="mono text-text-dim text-xs mt-1">
                            {e.pollets_comanda ? e.pollets_comanda.toLocaleString() : '—'} pollets
                          </span>
                        </div>
                      ))}
                    </div>

                    {opcions !== undefined && opcions.length === 0 && (
                      <div className="p-2 mono text-xs text-danger bg-danger/10 rounded-md">
                        Cap combinació vàlida amb els paràmetres actuals.
                      </div>
                    )}

                    {opcions && opcions.length > 0 && (
                      <div className="flex flex-col gap-2.5">
                        {opcions.map((opcio, idx) => {
                          const sel = selIdx === idx
                          return (
                            <div key={idx} className={`border rounded-lg p-3 md:p-4 transition-colors ${sel ? 'border-success bg-success/5' : 'border-border bg-bg'}`}>
                              <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-2 md:mb-3">
                                <div className="mono text-xs">
                                  <span className="font-bold">Alçada: {opcio.alcada} cx · Pollets/caixa: {opcio.pollets_caixa}</span>
                                  <span className="block md:inline md:ml-2.5 text-text-dim mt-1 md:mt-0 font-normal">
                                    {opcio.total_carros} carros
                                    {opcio.carros_compartits.filter(cc => cc.items.length > 1).length > 0 && (
                                      <span className="text-accent">{' '}({opcio.carros_compartits.filter(cc => cc.items.length > 1).length} compartit{opcio.carros_compartits.filter(cc => cc.items.length > 1).length > 1 ? 's' : ''})</span>
                                    )}
                                  </span>
                                </div>
                                <button onClick={() => triarOpcio(g.key, idx, opcio, g.transportista, g.num_viatge)}
                                  disabled={aplicantDist !== null}
                                  className={`w-full md:w-auto px-3 py-1.5 text-xs mono rounded-md border font-bold transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed ${
                                    sel
                                      ? 'border-success bg-success/20 text-success'
                                      : 'border-border bg-bg text-text hover:border-text-dim'
                                  }`}>
                                  {aplicantDist === g.key && sel ? 'Aplicant...' : sel ? '✓ Triada' : 'Triar aquesta opció'}
                                </button>
                              </div>
                              <div className={`flex flex-col gap-1 ${opcio.carros_compartits.some(cc => cc.items.length > 1) ? 'mb-3' : ''}`}>
                                {opcio.resultats.map(r => (
                                  <div key={r.expedicio_id} className="flex justify-between text-xs mono py-0.5">
                                    <span className="text-text">{r.client}</span>
                                    <span className="text-right">
                                      <span className="text-text">{r.carros_sencers}c</span>
                                      {r.pico_caixes > 0 && <span className="text-accent"> + {r.pico_caixes} cx pico</span>}
                                      <span className="text-text-dim"> · {r.pollets_reals.toLocaleString()} pollets</span>
                                      {r.diferencia > 0 && <span className={r.diferencia >= 50 ? 'text-danger' : 'text-text-dim'}> (Δ{r.diferencia})</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {opcio.carros_compartits.some(cc => cc.items.length > 1) && (
                                <div className="p-2 bg-accent/5 rounded border border-accent/20 mt-1">
                                  <div className="text-[10px] mono text-accent uppercase tracking-wider mb-1">Carros compartits</div>
                                  {opcio.carros_compartits.filter(cc => cc.items.length > 1).map((cc, ci) => (
                                    <div key={ci} className="text-[11px] mono text-text-dim leading-relaxed">
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
    </div>
  )
}
