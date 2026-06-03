import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseBody, DestinacioIdPatchBody } from '@/lib/schemas'
import { withAudit } from '@/lib/audit'

export const PATCH = withAudit(async (request: Request, { params }: { params: { id: string } }) => {
  const raw = await request.json().catch(() => null)
  if (raw === null) return NextResponse.json({ error: 'Body JSON invàlid' }, { status: 400 })
  const parsed = parseBody(DestinacioIdPatchBody, raw)
  if (!parsed.ok) return parsed.response
  const { nom_granja, nau, poblacio, codi_rega, telefon } = parsed.data

  const updates: Record<string, unknown> = {}
  if (nom_granja !== undefined) updates.nom_granja = nom_granja
  if (nau !== undefined) updates.nau = nau || null
  if (poblacio !== undefined) updates.poblacio = poblacio || null
  if (codi_rega !== undefined) updates.codi_rega = codi_rega || null
  if (telefon !== undefined) updates.telefon = telefon || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Cap camp per actualitzar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('destinacions')
    .update(updates)
    .eq('id', params.id)
    .select('id, nom_granja, nau, poblacio, codi_rega, telefon, client_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
})
