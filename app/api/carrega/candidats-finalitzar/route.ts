import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const LLINDAR_DIES = 7

export async function GET() {
  const { data, error } = await supabase.rpc('fulls_candidats_finalitzar', {
    p_llindar_dies: LLINDAR_DIES,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ candidats: data || [], llindar_dies: LLINDAR_DIES })
}
