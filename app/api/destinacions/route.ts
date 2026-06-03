import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, DestinacionsGetQuery, DestinacioPostBody } from '@/lib/schemas'
import { withAudit } from '@/lib/audit'

export async function GET(request: Request) {
  const qp = parseBody(
    DestinacionsGetQuery,
    Object.fromEntries(new URL(request.url).searchParams)
  )
  if (!qp.ok) return qp.response
  const { client_id } = qp.data

  let query = supabase
    .from('destinacions')
    .select('id, nom_granja, nau, poblacio, codi_rega, telefon, client_id')
    .order('nom_granja')

  if (client_id !== undefined) {
    // client_id és un enter validat per zod: segur per inserir al filtre PostgREST
    query = query.or(`client_id.eq.${client_id},client_id.is.null`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export const POST = withAudit(async (request: Request) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(DestinacioPostBody, raw)
  if (!parsed.ok) return parsed.response
  const { nom_granja, nau, poblacio, codi_rega, telefon, client_id } = parsed.data

  const { data, error } = await supabase
    .from('destinacions')
    .insert({
      nom_granja,
      nau: nau || null,
      poblacio: poblacio || null,
      codi_rega: codi_rega || null,
      telefon: telefon || null,
      client_id: client_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
})
