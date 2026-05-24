import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, CarroPostBody, CarroDeleteBody } from '@/lib/schemas'

export async function GET() {
  const { data, error } = await supabase
    .from('carros_estoc')
    .select(`
      id,
      posta,
      quantitat_ous,
      estat,
      recepcio,
      lots_reproductores (
        id,
        data_naixement,
        estirp,
        granges_reproductores (
          granja,
          nom_informal
        )
      )
    `)
    .eq('estat', 'Disponible')
    .order('recepcio', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(CarroPostBody, raw)
  if (!parsed.ok) return parsed.response
  const { lot_id, posta, quantitat_ous, nombre_carros: n } = parsed.data

  const carros = Array.from({ length: n }, () => ({
    lot_id,
    posta,
    quantitat_ous: quantitat_ous ?? 4800,
    recepcio: new Date().toISOString().split('T')[0],
    estat: 'Disponible',
  }))

  const { data, error } = await supabase
    .from('carros_estoc')
    .insert(carros)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: data?.length, carros: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(CarroDeleteBody, raw)
  if (!parsed.ok) return parsed.response
  const { lot_id, posta, quantitat_ous } = parsed.data

  // Buscar un carro disponible d'aquest grup (lot + posta + quantitat)
  const { data, error } = await supabase
    .from('carros_estoc')
    .select('id')
    .eq('lot_id', lot_id)
    .eq('posta', posta)
    .eq('quantitat_ous', quantitat_ous)
    .eq('estat', 'Disponible')
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No s\'ha trobat cap carro disponible per eliminar' }, { status: 404 })
  }

  const { error: deleteError } = await supabase
    .from('carros_estoc')
    .delete()
    .eq('id', data.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: data.id })
}
