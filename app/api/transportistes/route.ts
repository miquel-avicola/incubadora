import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('transportistes')
    .select('id, nom, empresa, max_carros, tipus_carro, alcada_min, alcada_max, pollets_caixa_min, pollets_caixa_max')
    .order('nom')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}