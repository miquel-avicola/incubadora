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

  // Validar capacitat de la naixedora (només carros actius, sense resultats de naixement)
  const { data: naixedora } = await supabase
    .from('naixedores')
    .select('capacitat, numero')
    .eq('id', naixedora_id)
    .single()

  if (naixedora) {
    const { data: transferenciesExistents } = await supabase
      .from('transferencies')
      .select('id, resultats_naix(id)')
      .eq('naixedora_id', naixedora_id)

    const carrosActius = transferenciesExistents?.filter(t =>
      Array.isArray(t.resultats_naix) && t.resultats_naix.length === 0
    ).length || 0

    if (carrosActius >= naixedora.capacitat) {
      return NextResponse.json({
        error: `La naixedora ${naixedora.numero} és plena. Capacitat: ${naixedora.capacitat} carros, ja ocupats: ${carrosActius}`,
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

  // Disparar rotacio automatica de zones si toca. La RPC valida internament
  // que sigui MS gran (cap 24) i que el pulsator d'aquesta Inc hagi quedat
  // buit; si no toca, retorna {ok:false, motiu:...} sense modificar res.
  // Silencios: no bloqueja la resposta ni mostra avis a l'usuari.
  const { data: assigInc } = await supabase
    .from('assignacions')
    .select('incubadora_id')
    .eq('id', assignacio_id)
    .single()

  if (assigInc?.incubadora_id) {
    await supabase.rpc('rotar_zones_ms_gran', { p_incubadora_id: assigInc.incubadora_id })
  }

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
