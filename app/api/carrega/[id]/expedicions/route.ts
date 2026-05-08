import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { data: comandes } = await supabase
    .from('comandes')
    .select('id')
    .eq('full_carrega_id', params.id)

  if (!comandes || comandes.length === 0) return NextResponse.json([])
  const comandaIds = comandes.map(c => c.id)

  const { data, error } = await supabase
    .from('expedicions')
    .select(`
      id, ordre, pollets_comanda, pollets_servits, matricula, num_viatge,
      hora_prevista_naixement, hora_sortida_camio, hora_arribada_camio, observacions,
      comandes (id, clients (id, nom)),
      destinacions (id, nom_granja, nau, poblacio),
      transportistes (id, nom),
      expedicio_lots (
        id, pollets,
        lots_reproductores (id, data_naixement, estirp, granges_reproductores (granja, nom_informal))
      ),
      expedicio_vacunes (vacuna_id, vacunes (id, nom, via))
    `)
    .in('comanda_id', comandaIds)
    .order('ordre', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { comanda_id, destinacio_id, transportista_id, matricula, hora_prevista_naixement, pollets_comanda, observacions } = body

  if (!comanda_id || !destinacio_id) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  // Obtenir l'ordre màxim actual per aquest full
 const { data: comandesOrdre } = await supabase
  .from('comandes')
  .select('id')
  .eq('full_carrega_id', params.id)

const comandaIdsOrdre = comandesOrdre?.map(c => c.id) || []

const { data: existing } = await supabase
  .from('expedicions')
  .select('ordre')
  .in('comanda_id', comandaIdsOrdre)
  .order('ordre', { ascending: false })
  .limit(1)

  const nextOrdre = existing && existing.length > 0 && existing[0].ordre
    ? existing[0].ordre + 1
    : 1

  const { data, error } = await supabase
    .from('expedicions')
    .insert({
      comanda_id,
      destinacio_id,
      transportista_id: transportista_id || null,
      matricula: matricula || null,
      hora_prevista_naixement: hora_prevista_naixement || null,
      pollets_comanda: pollets_comanda || null,
      pollets_servits: null,
      ordre: nextOrdre,
      observacions: observacions || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Autocompletar client_id a la destinació si encara no en té
if (data) {
  const comanda = await supabase
    .from('comandes')
    .select('full_carrega_id, clients(id)')
    .eq('id', comanda_id)
    .single()
  
  const client = (comanda.data?.clients as unknown as { id: number } | null)
  if (client?.id) {
    await supabase
      .from('destinacions')
      .update({ client_id: client.id })
      .eq('id', destinacio_id)
      .is('client_id', null)
  }
}
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const { expedicio_id } = await request.json()

  const { error } = await supabase
    .from('expedicions')
    .delete()
    .eq('id', expedicio_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
