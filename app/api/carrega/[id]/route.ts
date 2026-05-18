import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from('fulls_carrega')
    .select(`
      id,
      num_carrega,
      carrega,
      transferencia,
      estat,
      observacions,
      comandes (
        id,
        tipus,
        quantitat_pollets,
        quantitat_ous_maquila,
        previsio_naixement,
        sexat,
        observacions,
        clients (id, nom)
      ),
      assignacions (
        id,
        num_carro_full,
        hora_entrada,
        previsio_naixement,
        observacions,
        posicio,
        zona,
        incubadora_id,
        carros_estoc (
          id,
          posta,
          quantitat_ous,
          lots_reproductores (
            id,
            data_naixement,
            estirp,
            granges_reproductores (granja, nom_informal)
          )
        ),
        incubadores (id, numero, model, tipus),
        assignacio_vacunes (
          id,
          dosi,
          vacunes (id, nom, via)
        ),
        transferencies (
          id,
          ous_explosius,
          ous_fertils_vacunats,
          naixedora_id,
          naixedores (numero),
          resultats_naix (id, pollets_nascuts, sexat)
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { estat, observacions, transferencia } = body

  const updates: Record<string, unknown> = {}
  if (estat !== undefined) updates.estat = estat
  if (observacions !== undefined) updates.observacions = observacions
  if (transferencia !== undefined) updates.transferencia = transferencia

  const { data, error } = await supabase
    .from('fulls_carrega')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
