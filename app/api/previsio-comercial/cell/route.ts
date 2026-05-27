import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAudit } from '@/lib/audit'
import { parseBody, PrevioCellPutBody } from '@/lib/schemas'

// PUT /api/previsio-comercial/cell
// Body: { data: 'YYYY-MM-DD', client_id: number, tipus: 'Pollets' | 'Maquila', quantitat: number }
// Crea o actualitza una comanda preliminar (sense full_carrega_id).
// Si quantitat <= 0, elimina la comanda preliminar.
// No permet modificar comandes reals (amb full_carrega_id).

export const PUT = withAudit(async (request: Request) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(PrevioCellPutBody, raw)
  if (!parsed.ok) return parsed.response
  const { data, client_id, tipus, quantitat: q } = parsed.data

  // Buscar comanda existent (sense full_carrega_id) per a aquesta data + client + tipus
  const { data: existents, error: errBuscar } = await supabase
    .from('comandes')
    .select('id, full_carrega_id')
    .eq('data_prevista_naixement', data)
    .eq('client_id', client_id)
    .eq('tipus', tipus)
  if (errBuscar) return NextResponse.json({ error: errBuscar.message }, { status: 500 })

  // Si n'hi ha una de real (amb full_carrega_id), no la toquem
  const real = (existents || []).find(c => c.full_carrega_id != null)
  if (real) {
    return NextResponse.json({
      error: 'Aquesta data ja té una comanda confirmada lligada a una càrrega. Edita-la des de la pàgina de comandes.',
    }, { status: 409 })
  }

  const preliminar = (existents || []).find(c => c.full_carrega_id == null)

  // Si quantitat 0 i hi ha preliminar, eliminar
  if (q <= 0) {
    if (preliminar) {
      const { error: errDel } = await supabase.from('comandes').delete().eq('id', preliminar.id)
      if (errDel) return NextResponse.json({ error: errDel.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, accio: 'eliminat' })
  }

  // Preparar camps a guardar
  const camps: any = {
    client_id,
    tipus,
    data_prevista_naixement: data,
  }
  if (tipus === 'Pollets') {
    camps.quantitat_pollets = q
    camps.quantitat_ous_maquila = null
  } else {
    camps.quantitat_ous_maquila = q
    camps.quantitat_pollets = null
  }

  if (preliminar) {
    // Actualitzar
    const { error: errUp } = await supabase.from('comandes').update(camps).eq('id', preliminar.id)
    if (errUp) return NextResponse.json({ error: errUp.message }, { status: 500 })
    return NextResponse.json({ ok: true, accio: 'actualitzat', id: preliminar.id })
  } else {
    // Crear nova
    const { data: creada, error: errIns } = await supabase
      .from('comandes')
      .insert(camps)
      .select('id')
      .single()
    if (errIns) return NextResponse.json({ error: errIns.message }, { status: 500 })
    return NextResponse.json({ ok: true, accio: 'creat', id: creada?.id })
  }
})
