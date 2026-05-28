/**
 * lib/ownership.ts
 *
 * Helpers per verificar que els recursos que es volen mutar pertanyen
 * al full de càrrega esperat. Evita que un usuari autenticat pugui
 * modificar dades d'un altre full passant IDs arbitraris.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Comprova que tots els registres `ids` de la taula `table` tenen
 * `ownerColumn === expectedOwnerId`.
 *
 * Retorna `null` si tot és correcte.
 * Retorna un `NextResponse` amb codi 404 o 403 si no.
 */
export async function assertOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  table: string,
  ids: number | number[],
  ownerColumn: string,
  expectedOwnerId: number
): Promise<NextResponse | null> {
  const idList = Array.isArray(ids) ? ids : [ids]
  if (idList.length === 0) return null

  const { data, error } = await supabase
    .from(table)
    .select(`id, ${ownerColumn}`)
    .in('id', idList)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length < idList.length) {
    return NextResponse.json({ error: 'Registre no trobat' }, { status: 404 })
  }

  for (const row of (data as any[])) {
    if (row[ownerColumn] !== expectedOwnerId) {
      return NextResponse.json(
        { error: 'No tens permís per modificar aquest recurs: pertany a un altre full de càrrega' },
        { status: 403 }
      )
    }
  }

  return null
}

/**
 * Comprova que tots els `transferenciaIds` pertanyen al full `fullId`
 * (via la seva assignació: transferencia → assignacio → full_carrega_id).
 *
 * Retorna `null` si tot és correcte.
 * Retorna un `NextResponse` amb codi 404 o 403 si no.
 */
export async function assertTransferenciesOwnership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  transferenciaIds: number[],
  fullId: number
): Promise<NextResponse | null> {
  if (transferenciaIds.length === 0) return null

  // Pas 1: obtenir les assignacio_id de les transferències
  const { data: transfs, error: errTransfs } = await supabase
    .from('transferencies')
    .select('id, assignacio_id')
    .in('id', transferenciaIds)

  if (errTransfs) return NextResponse.json({ error: errTransfs.message }, { status: 500 })

  if (!transfs || transfs.length < transferenciaIds.length) {
    return NextResponse.json({ error: 'Transferència no trobada' }, { status: 404 })
  }

  const assignacioIds = (transfs as { id: number; assignacio_id: number }[]).map(t => t.assignacio_id)

  // Pas 2: verificar que totes les assignacions pertanyen al full
  const { data: assignacioCheck, error: errAss } = await supabase
    .from('assignacions')
    .select('id')
    .in('id', assignacioIds)
    .eq('full_carrega_id', fullId)

  if (errAss) return NextResponse.json({ error: errAss.message }, { status: 500 })

  if (!assignacioCheck || assignacioCheck.length < assignacioIds.length) {
    return NextResponse.json(
      { error: 'No tens permís per modificar aquest recurs: les transferències no pertanyen a aquest full' },
      { status: 403 }
    )
  }

  return null
}
