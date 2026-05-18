import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const { data, error } = await supabase.rpc('estat_instalacions')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    data ?? { incubadores: [], naixedores: [], generat_a: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  )
}
