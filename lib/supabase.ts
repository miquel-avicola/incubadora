import { createClient, SupabaseClient } from '@supabase/supabase-js'

// IMPORTANT: Next.js intercepta el `fetch` global i, en producció (`next build`),
// emmagatzema les respostes al seu Data Cache (persistit a .next/cache). Això feia
// que les consultes de Supabase servissin dades antigues malgrat `force-dynamic` i
// la capçalera Cache-Control no-store (que només afecta el navegador, no el cache
// del servidor). Forcem `cache: 'no-store'` a totes les peticions del client perquè
// cada consulta llegeixi sempre l'estat actual de la base de dades.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' })

let _client: SupabaseClient | undefined

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    _client = createClient(url, key, {
      auth: { persistSession: false },
      global: { fetch: noStoreFetch },
    })
  }
  return _client
}

// Proxy lazy: el client no es crea fins que s'usa per primer cop,
// evitant errors durant el build si les variables d'entorn no estan disponibles.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
