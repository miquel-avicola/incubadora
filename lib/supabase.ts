import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// IMPORTANT: Next.js intercepta el `fetch` global i, en producció (`next build`),
// emmagatzema les respostes al seu Data Cache (persistit a .next/cache). Això feia
// que les consultes de Supabase servissin dades antigues malgrat `force-dynamic` i
// la capçalera Cache-Control no-store (que només afecta el navegador, no el cache
// del servidor). Forcem `cache: 'no-store'` a totes les peticions del client perquè
// cada consulta llegeixi sempre l'estat actual de la base de dades.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' })

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  global: { fetch: noStoreFetch },
})
