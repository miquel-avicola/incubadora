import { NextResponse } from 'next/server'
import { obtenirEclosio } from '@/lib/eclosio'

export const dynamic = 'force-dynamic'

// ============================================================
// GET /api/eclosio-referencia?estirp=X&setmanes=Y&tipus=Z
// Retorna la taxa d'eclosió esperada amb cascada de fonts.
// La lògica viu a lib/eclosio.ts perquè la pugui reutilitzar
// /api/previsio-post-transferencia sense haver de fer fetch.
// ============================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const estirp = searchParams.get('estirp')
  const setmanesStr = searchParams.get('setmanes')
  const tipus = searchParams.get('tipus')

  if (!estirp || !setmanesStr || !tipus) {
    return NextResponse.json(
      { error: 'Falten paràmetres obligatoris: estirp, setmanes, tipus' },
      { status: 400 }
    )
  }
  if (!['Ross', 'Cobb'].includes(estirp)) {
    return NextResponse.json({ error: `Estirp no reconegut: ${estirp}` }, { status: 400 })
  }
  if (!['Singlestage', 'Multistage'].includes(tipus)) {
    return NextResponse.json({ error: `Tipus d'incubadora no reconegut: ${tipus}` }, { status: 400 })
  }
  const setmanes = parseInt(setmanesStr, 10)
  if (isNaN(setmanes) || setmanes < 1 || setmanes > 100) {
    return NextResponse.json({ error: `Setmanes invàlides: ${setmanesStr}` }, { status: 400 })
  }

  try {
    const result = await obtenirEclosio(estirp, setmanes, tipus)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error intern' }, { status: 500 })
  }
}
