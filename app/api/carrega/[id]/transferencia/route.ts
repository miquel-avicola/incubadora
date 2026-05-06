import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json()
  const { assignacio_id, naixedora_id, ous_explosius, ous_fertils_vacunats } = body

  if (!assignacio_id || !naixedora_id || ous_explosius === undefined || !ous_fertils_vacunats) {
    return NextResponse.json({ error: 'Falten camps obligatoris' }, { status: 400 })
  }

  if (ous_fertils_vacunats > 4800) {
    return NextResponse.json({ error: 'No es poden transferir més de 4.800 ous fèrtils per carro' }, { status: 400 })
  }

  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  // Obtenir el carro_id a partir de l'assignació
  const { data: assignacio, error: assignacioError } = await supabase
    .from('assignacions')
    .select('carro_id')
    .eq('id', assignacio_id)
    .single()

  if (assignacioError || !assignacio) {
    return NextResponse.json({ error: 'Assignació no trobada' }, { status: 404 })
  }

  // Validar capacitat de la naixedora
  const { data: naixedora } = await supabase
    .from('naixedores')
    .select('capacitat, numero')
    .eq('id', naixedora_id)
    .single()

  if (naixedora) {
    const { data: transferenciesExistents } = await supabase
      .from('transferencies')
      .select('ous_fertils_vacunats')
      .eq('naixedora_id', naixedora_id)

    const totalExistent = transferenciesExistents?.reduce((sum, t) => sum + (t.ous_fertils_vacunats || 0), 0) || 0
    const disponible = naixedora.capacitat - totalExistent

    if (ous_fertils_vacunats > disponible) {
      return NextResponse.json({
        error: `La naixedora ${naixedora.numero} no té prou capacitat. Disponible: ${disponible.toLocaleString()} ous (capacitat total: ${naixedora.capacitat.toLocaleString()})`,
      }, { status: 400 })
    }
  }

  // Crear la transferència
  const { data, error } = await supabase
    .from('transferencies')
    .insert({
      assignacio_id,
      carro_id: assignacio.carro_id,
      naixedora_id,
      transferencia: dateStr,
      ous_explosius,
      ous_fertils_vacunats,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Actualitzar estat del carro a Transferit
  await supabase
    .from('carros_estoc')
    .update({ estat: 'Transferit' })
    .eq('id', assignacio.carro_id)

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const { transferencia_id, carro_id } = await request.json()

  const { error } = await supabase
    .from('transferencies')
    .delete()
    .eq('id', transferencia_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase
    .from('carros_estoc')
    .update({ estat: 'Assignat' })
    .eq('id', carro_id)

  return NextResponse.json({ ok: true })
}
