import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const LLINDAR_DIES = 7

interface Resultat {
  id: number | null
}

interface Transferencia {
  id: number
  resultats_naix: Resultat[] | null
}

interface Assignacio {
  id: number
  transferencies: Transferencia[] | null
}

interface FullRow {
  id: number
  num_carrega: number
  carrega: string
  estat: string
  assignacions: Assignacio[] | null
}

export async function GET() {
  const { data, error } = await supabase
    .from('fulls_carrega')
    .select(`
      id,
      num_carrega,
      carrega,
      estat,
      assignacions (
        id,
        transferencies (
          id,
          resultats_naix (id, naixement)
        )
      )
    `)
    .eq('estat', 'Planificat')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const avui = new Date()
  avui.setHours(0, 0, 0, 0)

  const candidats = (data as unknown as FullRow[])
    .map(full => {
      const assigs = full.assignacions || []
      if (assigs.length === 0) return null

      const totsAmbNaixement = assigs.every(a =>
        (a.transferencies || []).some(t => (t.resultats_naix || []).length > 0)
      )
      if (!totsAmbNaixement) return null

      // Trobar la data del darrer naixement
      let darrer: string | null = null
      for (const a of assigs) {
        for (const t of (a.transferencies || [])) {
          for (const rn of (t.resultats_naix || []) as Array<Resultat & { naixement?: string }>) {
            if (rn.naixement && (!darrer || rn.naixement > darrer)) {
              darrer = rn.naixement
            }
          }
        }
      }
      if (!darrer) return null

      const dataDarrer = new Date(darrer)
      dataDarrer.setHours(0, 0, 0, 0)
      const diesSenseActivitat = Math.floor((avui.getTime() - dataDarrer.getTime()) / 86400000)

      if (diesSenseActivitat < LLINDAR_DIES) return null

      return {
        id: full.id,
        num_carrega: full.num_carrega,
        carrega: full.carrega,
        darrer_naixement: darrer,
        dies_sense_activitat: diesSenseActivitat,
        n_carros: assigs.length,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.dies_sense_activitat - a.dies_sense_activitat)

  return NextResponse.json({ candidats, llindar_dies: LLINDAR_DIES })
}
