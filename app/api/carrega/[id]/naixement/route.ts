import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()
  const { carros, total_pollets, sexat } = body

  // carros és un array de { assignacio_id, transferencia_id, ous_fertils_vacunats }
  if (!carros?.length || total_pollets === undefined) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  // Calcular total d'ous fèrtils del grup per fer el repartiment proporcional
  const totalOusFertils = carros.reduce((s: number, c: { ous_fertils_vacunats: number }) => s + c.ous_fertils_vacunats, 0)

  if (totalOusFertils === 0) {
    return NextResponse.json({ error: 'Els carros seleccionats no tenen ous fèrtils registrats' }, { status: 400 })
  }

  if (total_pollets > totalOusFertils) {
    return NextResponse.json({
      error: `Els pollets nascuts (${total_pollets.toLocaleString()}) no poden superar els ous fèrtils del lot (${totalOusFertils.toLocaleString()})`,
    }, { status: 400 })
  }

  const inserts = carros.map((c: { transferencia_id: number; ous_fertils_vacunats: number }) => ({
    transferencia_id: c.transferencia_id,
    naixement: dateStr,
    pollets_nascuts: Math.round(total_pollets * (c.ous_fertils_vacunats / totalOusFertils)),
    sexat: sexat || false,
  }))

  const { data, error } = await supabase
    .from('resultats_naix')
    .insert(inserts)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: data?.length, resultats: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const { transferencia_ids } = await request.json()

  if (!transferencia_ids?.length) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  const { error } = await supabase
    .from('resultats_naix')
    .delete()
    .in('transferencia_id', transferencia_ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
