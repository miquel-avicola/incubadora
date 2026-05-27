import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ZonaMS, SubTipus, Dia, Fase, CarroEstoc, Incubadora, AssignacioActual, Full, CarroInst, IncInst, EstatInst, ssPosToCell, MS_ZONES_ESQ, MS_ZONES_DRE, subtipus, diaDeFull, nomCarroCurt, keyCell, diesEstoc, setmanesLot, offsetPerDia, polletsCarro, optimitzarZonesTermiques, projectarEstatInst, CellaSel, ordreCellesSS, preSuggerit, ECLOSIO_EST, suggerirAssignacioCompleta } from '@/lib/assignacions'

export interface UseAssignacionsProps {
  initialFull: Full | null;
  initialDisponibles: CarroEstoc[];
  initialIncs: Incubadora[];
  initialEstatInst: EstatInst | null;
}

export function useAssignacions({ initialFull, initialDisponibles, initialIncs, initialEstatInst }: UseAssignacionsProps) {
  const params = useParams()
  const router = useRouter()

  const [full, setFull] = useState<Full | null>(initialFull)
  const [disponibles, setDisponibles] = useState<CarroEstoc[]>(initialDisponibles)
  const [incs, setIncs] = useState<Incubadora[]>(initialIncs)
  const [estatInst, setEstatInst] = useState<EstatInst | null>(initialEstatInst)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [guardant, setGuardant] = useState(false)
  const [resultatGuardar, setResultatGuardar] = useState<string>('')

  // Mapa: carro_id → posició planificada (incId+posicio+zona)
  const [colocats, setColocats] = useState<Map<number, { incId: number; pos: number; zona: ZonaMS | null }>>(() => {
    const mapaInicial = new Map<number, { incId: number; pos: number; zona: ZonaMS | null }>()
    if (initialFull && Array.isArray(initialFull.assignacions)) {
      for (const a of initialFull.assignacions) {
        if (a.posicio === null || a.posicio === undefined) continue
        mapaInicial.set(a.carros_estoc.id, {
          incId: a.incubadora_id,
          pos: a.posicio,
          zona: a.zona,
        })
      }
    }
    return mapaInicial
  })
  const colocatsRef = useRef(colocats)
  useEffect(() => { colocatsRef.current = colocats }, [colocats])
  
  // Set de claus 'incId|pos|zona' marcades com a destí del pre-suggerit
  const [seleccionades, setSeleccionades] = useState<Set<string>>(new Set())

  const [dia, setDia] = useState<Dia>(() => {
    if (initialFull?.carrega) {
      const d = diaDeFull(initialFull.carrega)
      if (d) return d
    }
    return 'dijous'
  })
  const [mspOrdre, setMspOrdre] = useState<number[]>(() => {
    if (initialFull?.carrega) {
      const d = diaDeFull(initialFull.carrega)
      if (d === 'dilluns') return [9, 10, 8]
    }
    return [8, 9, 10]
  })
  const [mostrarProjectat, setMostrarProjectat] = useState(true)
  // Pre-selecció d'incubadores per al suggeriment (buit = totes)
  const [incsFiltrades, setIncsFiltrades] = useState<Set<number>>(new Set())
  // Flux de dos passos: selecció de carros → assignació visual
  const [carrosSeleccionats, setCarrosSeleccionats] = useState<Set<number>>(() => {
    return new Set<number>((initialFull?.assignacions ?? []).map((a: any) => a.carros_estoc.id))
  })
  const [fase, setFase] = useState<Fase>(() => {
    const idsAssignats = new Set<number>((initialFull?.assignacions ?? []).map((a: any) => a.carros_estoc.id))
    return idsAssignats.size > 0 ? 'assignacio' : 'seleccio'
  })

  function toggleIncFiltrada(incId: number) {
    setIncsFiltrades(prev => {
      const s = new Set(prev)
      if (s.has(incId)) s.delete(incId)
      else s.add(incId)
      return s
    })
  }

  // ── Càrrega inicial gestionada per Server Components

  // ── Derivacions
  const incsById = useMemo(() => new Map(incs.map(i => [i.id, i])), [incs])

  // Carros que es poden col·locar: disponibles + els assignats al full
  // (perquè si tornes a la pàgina i en treus algun, ha de tornar a la safata)
  const carrosLot = useMemo<CarroEstoc[]>(() => {
    const ja: Map<number, CarroEstoc> = new Map()
    for (const c of disponibles) ja.set(c.id, c)
    if (full) {
      for (const a of full.assignacions) {
        const ce = a.carros_estoc
        if (!ja.has(ce.id)) {
          ja.set(ce.id, {
            id: ce.id,
            posta: ce.posta,
            quantitat_ous: ce.quantitat_ous,
            estat: 'Assignat',
            lots_reproductores: ce.lots_reproductores,
          } as CarroEstoc)
        }
      }
    }
    return Array.from(ja.values())
  }, [disponibles, full])

  // En fase 2, limitar al pool de carros seleccionats a la fase 1
  const carrosLotFiltrats = useMemo<CarroEstoc[]>(() => {
    if (carrosSeleccionats.size === 0) return carrosLot
    return carrosLot.filter(c => carrosSeleccionats.has(c.id))
  }, [carrosLot, carrosSeleccionats])

  // Carros que encara NO estan col·locats al mapa (limitats als seleccionats)
  const carrosPendents = useMemo<CarroEstoc[]>(() => {
    return carrosLotFiltrats.filter(c => !colocats.has(c.id))
  }, [carrosLotFiltrats, colocats])

  // Número SS principal per al dia (mínim numero de SS en colocats, com fa la BD)
  const ssPrincipalNum = useMemo<number | null>(() => {
    const ssNums: number[] = []
    colocats.forEach((p) => {
      const inc = incsById.get(p.incId)
      if (inc && inc.tipus === 'Singlestage') ssNums.push(inc.numero)
    })
    return ssNums.length > 0 ? Math.min(...ssNums) : null
  }, [colocats, incsById])

  // Mapa keyCell → num_carro_full potencial (mostra #N a cada slot)
  const numCarroPerCella = useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>()
    for (const inc of incs) {
      const sub = subtipus(inc.tipus, inc.capacitat_carros)
      const offset = offsetPerDia(dia, inc.tipus, inc.capacitat_carros, inc.numero, ssPrincipalNum, mspOrdre)
      if (offset === null) continue
      if (sub === 'SS') {
        for (let pos = 1; pos <= 24; pos++) m.set(keyCell(inc.id, pos, null), offset + pos)
      } else if (sub === 'MSG') {
        for (const z of ['central', 'paret', 'pulsator'] as ZonaMS[])
          for (let pos = 1; pos <= 8; pos++) m.set(keyCell(inc.id, pos, z), offset + pos)
      } else { // MSP
        for (const z of ['central', 'paret', 'pulsator'] as ZonaMS[])
          for (let pos = 1; pos <= 4; pos++) m.set(keyCell(inc.id, pos, z), offset + pos)
      }
    }
    return m
  }, [incs, dia, mspOrdre, ssPrincipalNum])

  // Map de cel·la → carro_id col·locat
  const carroPerCella = useMemo(() => {
    const m = new Map<string, number>()
    colocats.forEach((p, cid) => {
      m.set(keyCell(p.incId, p.pos, p.zona), cid)
    })
    return m
  }, [colocats])

  // Té carros MS col·locats al full actual?
  const hiHaMsColocats = useMemo(() => {
    let found = false
    colocats.forEach((p) => {
      const inc = incsById.get(p.incId)
      if (inc && inc.tipus === 'Multistage') found = true
    })
    return found
  }, [colocats, incsById])

  // Estat projectat: aplica transferències pendents fins a la data del load actual
  // i les rotacions MSG que se'n derivin. Sempre es calcula; el toggle
  // `mostrarProjectat` decideix si la UI l'utilitza o veu l'estat real.
  const estatInstProjectat = useMemo<EstatInst | null>(() => {
    if (!estatInst || !full) return null
    const assignacioIdsDelFull = new Set<number>(full.assignacions.map((a) => a.id))
    return projectarEstatInst(estatInst, full.carrega, assignacioIdsDelFull)
  }, [estatInst, full])

  // Quin estat utilitzem per pintar les cel·les "altres fulls" depèn del toggle.
  const estatInstEffectiu = (mostrarProjectat ? estatInstProjectat : estatInst) ?? estatInst

  // Ocupació "altres fulls" (per pintar de gris a la cel·la) — deriva de l'estat efectiu
  const ocupatsAltresFullsPerCella = useMemo(() => {
    const m = new Map<string, { num_carro_full: number; num_carrega: number; estirp: string | null; data_transferencia_full: string | null }>()
    if (!estatInstEffectiu || !full) return m
    for (const inc of estatInstEffectiu.incubadores) {
      for (const c of inc.carros) {
        if (c.posicio === null || c.posicio === undefined) continue
        // Si aquest carro és del full actual, no compta com a "altres fulls"
        const esDelFullActual = full.assignacions.some(a => a.id === c.assignacio_id)
        if (esDelFullActual) continue
        m.set(keyCell(inc.id, c.posicio, c.zona), {
          num_carro_full: c.num_carro_full,
          num_carrega: c.num_carrega,
          estirp: c.estirp,
          data_transferencia_full: c.data_transferencia_full ?? null,
        })
      }
    }
    return m
  }, [estatInstEffectiu, full])

  // Diferències entre estat real i projectat (per al banner de toggle).
  // Útil per saber si hi ha alguna cosa a projectar tot i estar en mode
  // projectat (en el qual lliureAviatPerCella ja és buit).
  const nCanvisProjeccio = useMemo(() => {
    if (!estatInst || !estatInstProjectat) return 0
    const claus = (e: EstatInst) => {
      const s = new Set<string>()
      for (const inc of e.incubadores) {
        for (const c of inc.carros) {
          if (c.posicio === null || c.posicio === undefined) continue
          s.add(`${c.assignacio_id}|${inc.id}|${c.posicio}|${c.zona ?? '-'}`)
        }
      }
      return s
    }
    const a = claus(estatInst)
    const b = claus(estatInstProjectat)
    let diff = 0
    a.forEach((k) => { if (!b.has(k)) diff++ })
    b.forEach((k) => { if (!a.has(k)) diff++ })
    return diff
  }, [estatInst, estatInstProjectat])

  // Slots "lliure aviat":
  //  · En mode PROJECTAT, l'estat efectiu ja té les transferències i rotacions
  //    aplicades, així que les cel·les realment buides es renderitzen com a
  //    lliures normals — no cal cap remap. Per tant retornem un mapa buit.
  //  · En mode NO PROJECTAT (real), marquem amb badge verd les cel·les que
  //    estan ocupades ARA però buides al projectat (es buidaran a temps).
  const lliureAviatPerCella = useMemo(() => {
    const m = new Map<string, { diesFins: number; num_carro_full: number; num_carrega: number; data_transferencia_full: string }>()
    if (mostrarProjectat) return m
    if (!estatInst || !estatInstProjectat || !full) return m
    const avui = new Date(); avui.setHours(0, 0, 0, 0)
    // Mapa de cel·les ocupades al projectat (per saber quines s'han alliberat)
    const ocupadesProjectat = new Set<string>()
    for (const inc of estatInstProjectat.incubadores) {
      for (const c of inc.carros) {
        if (c.posicio === null || c.posicio === undefined) continue
        ocupadesProjectat.add(keyCell(inc.id, c.posicio, c.zona))
      }
    }
    for (const inc of estatInst.incubadores) {
      for (const c of inc.carros) {
        if (c.posicio === null || c.posicio === undefined) continue
        if (!c.data_transferencia_full) continue
        const esDelFullActual = full.assignacions.some(a => a.id === c.assignacio_id)
        if (esDelFullActual) continue
        const k = keyCell(inc.id, c.posicio, c.zona)
        if (ocupadesProjectat.has(k)) continue // encara ocupada al projectat (rotada)
        const dataTrans = new Date(c.data_transferencia_full + 'T00:00:00').getTime()
        const diesFins = Math.max(0, Math.floor((dataTrans - avui.getTime()) / 86400000))
        m.set(k, {
          diesFins,
          num_carro_full: c.num_carro_full,
          num_carrega: c.num_carrega,
          data_transferencia_full: c.data_transferencia_full,
        })
      }
    }
    return m
  }, [mostrarProjectat, estatInst, estatInstProjectat, full])

  // ── Handlers de cel·la
  const toggleSeleccio = useCallback((incId: number, pos: number, zona: ZonaMS | null) => {
    const k = keyCell(incId, pos, zona)
    if (ocupatsAltresFullsPerCella.has(k) && !lliureAviatPerCella.has(k)) return
    
    const cellaOcupada = Array.from(colocatsRef.current.values()).some(val => val.incId === incId && val.pos === pos && val.zona === zona)
    if (cellaOcupada) return

    setSeleccionades(prev => {
      const s = new Set(prev)
      if (s.has(k)) s.delete(k); else s.add(k)
      return s
    })
  }, [ocupatsAltresFullsPerCella, lliureAviatPerCella])

  const seleccionarLliuresInc = useCallback((inc: Incubadora) => {
    const sub = subtipus(inc.tipus, inc.capacitat_carros)
    setSeleccionades(prev => {
      const next = new Set(prev)
      const afegir = (pos: number, zona: ZonaMS | null) => {
        const k = keyCell(inc.id, pos, zona)
        const cellaOcupada = Array.from(colocatsRef.current.values()).some(val => val.incId === inc.id && val.pos === pos && val.zona === zona)
        if (!cellaOcupada && (!ocupatsAltresFullsPerCella.has(k) || lliureAviatPerCella.has(k))) next.add(k)
      }
      if (sub === 'SS') {
        for (let p = 1; p <= 24; p++) afegir(p, null)
      } else if (sub === 'MSG') {
        for (const z of ['central', 'paret', 'pulsator'] as ZonaMS[]) for (let p = 1; p <= 8; p++) afegir(p, z)
      } else if (sub === 'MSP') {
        for (const z of ['central', 'paret', 'pulsator'] as ZonaMS[]) for (let p = 1; p <= 4; p++) afegir(p, z)
      }
      return next
    })
  }, [ocupatsAltresFullsPerCella, lliureAviatPerCella])

  function netejarSeleccio() {
    setSeleccionades(new Set())
  }

  function reiniciar() {
    if (!confirm('Reiniciar tota la planificació? Es perdrà el que has marcat i col·locat.')) return
    setColocats(new Map())
    setSeleccionades(new Set())
  }

  // ── Drag-and-drop
  const onDragStartCarro = useCallback((e: React.DragEvent, carroId: number, origenCella: string | null) => {
    e.dataTransfer.setData('carro_id', String(carroId))
    e.dataTransfer.setData('origen', origenCella || 'safata')
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const onDragOverCell = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDropCell = useCallback((e: React.DragEvent, incId: number, pos: number, zona: ZonaMS | null) => {
    e.preventDefault()
    const carroId = parseInt(e.dataTransfer.getData('carro_id'), 10)
    if (!Number.isFinite(carroId)) return
    const k = keyCell(incId, pos, zona)
    if (ocupatsAltresFullsPerCella.has(k) && !lliureAviatPerCella.has(k)) return
    
    setColocats(prev => {
      const cellaOcupada = Array.from(prev.values()).some(val => val.incId === incId && val.pos === pos && val.zona === zona)
      if (cellaOcupada) return prev

      const m = new Map(prev)
      m.set(carroId, { incId, pos, zona })
      return m
    })
    
    setSeleccionades(prev => {
      if (!prev.has(k)) return prev
      const s = new Set(prev); s.delete(k); return s
    })
  }, [ocupatsAltresFullsPerCella, lliureAviatPerCella])

  const onDropSafata = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const carroId = parseInt(e.dataTransfer.getData('carro_id'), 10)
    if (!Number.isFinite(carroId)) return
    setColocats(prev => {
      const m = new Map(prev)
      m.delete(carroId)
      return m
    })
  }, [])

  const clicarCarroColocat = useCallback((carroId: number) => {
    setColocats(prev => {
      const m = new Map(prev)
      m.delete(carroId)
      return m
    })
  }, [])

  const onDropMSPGeneral = useCallback((e: React.DragEvent, incId: number) => {
    e.preventDefault()
    const carroId = parseInt(e.dataTransfer.getData('carro_id'), 10)
    if (!Number.isFinite(carroId)) return

    setColocats(prev => {
      const occupied = new Set<string>();
      for (const p of Array.from(prev.values())) {
        if (p.incId === incId && p.pos !== null) occupied.add(`${p.pos}|${p.zona}`);
      }
      for (const k of Array.from(ocupatsAltresFullsPerCella.keys())) {
        const parts = k.split('|');
        if (parseInt(parts[0], 10) === incId) occupied.add(`${parts[1]}|${parts[2]}`);
      }
      for (const k of Array.from(lliureAviatPerCella.keys())) {
        const parts = k.split('|');
        if (parseInt(parts[0], 10) === incId) occupied.delete(`${parts[1]}|${parts[2]}`);
      }
      
      let targetPos: number | null = null;
      let targetZona: ZonaMS | null = null;
      
      const zonesPref: ZonaMS[] = ['central', 'paret', 'pulsator'];
      for (const z of zonesPref) {
        for (let p = 1; p <= 4; p++) {
          if (!occupied.has(`${p}|${z}`)) {
            targetPos = p;
            targetZona = z;
            break;
          }
        }
        if (targetPos !== null) break;
      }
      
      if (targetPos === null) {
        alert('Incubadora MSP plena.');
        return prev;
      }
      
      const m = new Map(prev)
      m.set(carroId, { incId, pos: targetPos, zona: targetZona })
      return m
    })
  }, [ocupatsAltresFullsPerCella, lliureAviatPerCella])

  // ── Pre-suggerit
  function aplicarPreSuggerit() {
    if (!full || !estatInst) return
    // El suggeriment ha de raonar sobre l'estat post-transferència (rotacions
    // incloses). Si la projecció no es pot calcular, fem fallback a l'estat
    // real. En passar el projectat, els carros transferits ja no hi són i les
    // rotacions ja s'han aplicat, així que no cal el mapa lliureAviat.
    const estatPerSuggerir = estatInstProjectat ?? estatInst
    const lliureAviatBuit = new Map<string, { diesFins: number; num_carro_full: number; num_carrega: number; data_transferencia_full: string }>()
    const sug = suggerirAssignacioCompleta(
      carrosPendents,
      full,
      incs,
      estatPerSuggerir,
      dia,
      lliureAviatBuit,
      carroPerCella,
      incsFiltrades
    )
    if (sug.size === 0) return
    setColocats(prev => {
      const m = new Map(prev)
      sug.forEach((p, cid) => m.set(cid, p))
      return m
    })
    setSeleccionades(new Set())

    // Avís si pollets previstos per sota de la comanda
    const comandaPollets = full.comandes
      .filter(c => c.tipus !== 'maquila' && c.quantitat_pollets !== null && c.quantitat_pollets > 0)
      .reduce((s, c) => s + (c.quantitat_pollets ?? 0), 0)
    if (comandaPollets > 0) {
      const polletsSug = Array.from(sug.keys()).reduce((acc, cid) => {
        const c = carrosPendents.find(x => x.id === cid)
        if (!c) return acc
        const setm = setmanesLot(c.lots_reproductores.data_naixement)
        return acc + polletsCarro(c)
      }, 0)
      if (polletsSug < comandaPollets - 500) {
        setErrorMsg(
          `⚠️ Atenció: els ${sug.size} carros assignats preveuen ~${Math.round(polletsSug).toLocaleString('ca')} pollets, ` +
          `per sota de la comanda (${comandaPollets.toLocaleString('ca')}). ` +
          `Necessites seleccionar més incubadores o afegir carros.`
        )
      }
    }
  }

  // ── Optimització tèrmica de zones MS
  function aplicarOptimitzacioTermica() {
    if (!estatInst || !full) return
    const msColocats = Array.from(colocats.entries()).filter(([, p]) => {
      const inc = incsById.get(p.incId)
      return inc && inc.tipus === 'Multistage'
    })
    if (msColocats.length === 0) return
    if (!confirm(
      `Redistribuirà les zones (central/paret/pulsator) de ${msColocats.length} carro(s) a les Multistage\nbasat en l'equilibri de calor projectat a 21 dies.\n\nVols continuar?`
    )) return

    const assignacioIdsDelFull = new Set<number>(
      full.assignacions.map((a) => a.id)
    )
    // L'optimització ha de considerar només els carros que ENCARA hi seran
    // quan entri el load actual (post-transferències + rotacions).
    const estatPerOptimitzar = estatInstProjectat ?? estatInst
    const novaColocats = optimitzarZonesTermiques(
      colocats,
      carrosLot,
      estatPerOptimitzar,
      incsById,
      assignacioIdsDelFull
    )
    setColocats(novaColocats)
  }

  // ── Guardar
  async function guardar() {
    if (!full) return
    if (colocats.size === 0) {
      if (!confirm('No hi ha cap carro col·locat. Vols guardar igualment (buidaria el full)?')) return
    }
    setGuardant(true)
    setErrorMsg('')
    setResultatGuardar('')
    try {
      const items = Array.from(colocats.entries()).map(([carro_id, p]) => ({
        carro_id,
        incubadora_id: p.incId,
        posicio: p.pos,
        zona: p.zona,
      }))
      const res = await fetch(`/api/carrega/${full.id}/planificacio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dia, msp_ordre: mspOrdre, items }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.orfes_bloquejades) {
          const llista = data.orfes_bloquejades.map((o: { num_carro_full: number; te_transferencia: boolean; te_vacuna: boolean }) =>
            `· Carro #${o.num_carro_full}: ${o.te_transferencia ? 'té transferència' : ''}${o.te_transferencia && o.te_vacuna ? ' i ' : ''}${o.te_vacuna ? 'té vacunes' : ''}`
          ).join('\n')
          setErrorMsg(`No es pot guardar:\n${data.error}\n\n${llista}`)
        } else {
          setErrorMsg(data.error || 'Error desconegut al guardar')
        }
        return
      }
      setResultatGuardar(`Guardat: ${data.inserits} nous, ${data.actualitzats} mogudes, ${data.esborrats} esborrades`)
      // Recarregar dades reals
      router.refresh()
    } catch (e) {
      setErrorMsg('Error de xarxa: ' + String(e))
    } finally {
      setGuardant(false)
    }
  }


  return {
    params, router,
    full, disponibles, incs, estatInst,
    loading, errorMsg, setErrorMsg, guardant, resultatGuardar, setResultatGuardar,
    colocats, setColocats,
    seleccionades, setSeleccionades,
    dia, setDia, mspOrdre, setMspOrdre,
    mostrarProjectat, setMostrarProjectat,
    incsFiltrades, setIncsFiltrades, toggleIncFiltrada,
    carrosSeleccionats, setCarrosSeleccionats,
    fase, setFase,
    incsById, carrosLot, carrosLotFiltrats, carrosPendents,
    ssPrincipalNum, numCarroPerCella, carroPerCella, hiHaMsColocats,
    estatInstProjectat, estatInstEffectiu,
    ocupatsAltresFullsPerCella, nCanvisProjeccio, lliureAviatPerCella,
    toggleSeleccio, seleccionarLliuresInc, netejarSeleccio, reiniciar,
    onDragStartCarro, onDragOverCell, onDropCell, onDropSafata, clicarCarroColocat,
    onDropMSPGeneral,
    aplicarPreSuggerit, aplicarOptimitzacioTermica, guardar
  }
}
