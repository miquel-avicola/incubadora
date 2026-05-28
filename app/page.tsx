import Link from 'next/link'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/auth'

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySession(token) : null
  const role = session?.role ?? 'recepcio'

  const showLots = role === 'admin'
  const showCarrega = role === 'carregues' || role === 'admin'
  const showCarregaList = showCarrega || role === 'responsable'

  return (
    <main className="bg-bg min-h-screen py-8 px-6">
      <div className="max-w-[480px] mx-auto">

        <div className="mb-12">
          <p className="text-accent font-mono text-[0.75rem] tracking-[0.15em] uppercase mb-2">
            Miquel Avícola
          </p>
          <h1 className="text-[1.75rem] font-bold text-text m-0">
            Sala d&apos;incubació
          </h1>
        </div>

        <div className="flex flex-col gap-4">

          <Link href="/estoc" className="no-underline">
            <div className="bg-accent rounded-xl p-6 cursor-pointer">
              <div className="text-[1.5rem] mb-2">📋</div>
              <div className="font-bold text-[1.1rem] text-[#0f1117] mb-1">Estoc de carros</div>
              <div className="text-[0.85rem] text-[#3a2e00]">Consultar carros disponibles i registrar recepcions</div>
            </div>
          </Link>

          {showLots && (
            <Link href="/lots" className="no-underline">
              <div className="bg-surface border border-border rounded-xl p-6 cursor-pointer">
                <div className="text-[1.5rem] mb-2">🐔</div>
                <div className="font-bold text-[1.1rem] text-text mb-1">Lots de reproductores</div>
                <div className="text-[0.85rem] text-text-dim">Gestionar lots i granges</div>
              </div>
            </Link>
          )}

          {showCarregaList && (
            <Link href="/carrega" className="no-underline">
              <div className="bg-surface border border-border rounded-xl p-6 cursor-pointer">
                <div className="text-[1.5rem] mb-2">🗓️</div>
                <div className="font-bold text-[1.1rem] text-text mb-1">Càrregues</div>
                <div className="text-[0.85rem] text-text-dim">Gestionar fulls de càrrega i assignacions</div>
              </div>
            </Link>
          )}

          {showCarrega && (
            <Link href="/impressions" className="no-underline">
              <div className="bg-surface border border-border rounded-xl p-6 cursor-pointer relative overflow-hidden">
                <div className="absolute right-[-15px] top-[-15px] text-[6rem] opacity-5">🖨️</div>
                <div className="text-[1.5rem] mb-2">📄</div>
                <div className="font-bold text-[1.1rem] text-text mb-1">Documents i Impressions</div>
                <div className="text-[0.85rem] text-text-dim">Central de generació d&apos;etiquetes, fulls de treball i expedició</div>
              </div>
            </Link>
          )}

          {role === 'admin' && (
            <Link href="/previsio-comercial" className="no-underline">
              <div className="bg-surface border border-border rounded-xl p-6 cursor-pointer">
                <div className="text-[1.5rem] mb-2">📅</div>
                <div className="font-bold text-[1.1rem] text-text mb-1">Previsió comercial</div>
                <div className="text-[0.85rem] text-text-dim">Planificar pollets per client i estimar carros necessaris</div>
              </div>
            </Link>
          )}

          {role === 'admin' && (
            <Link href="/estadistiques" className="no-underline">
              <div className="bg-surface border border-border rounded-xl p-6 cursor-pointer">
                <div className="text-[1.5rem] mb-2">📊</div>
                <div className="font-bold text-[1.1rem] text-text mb-1">Estadístiques mensuals</div>
                <div className="text-[0.85rem] text-text-dim">Rendiment d&apos;incubació, fertilitat i comercialització</div>
              </div>
            </Link>
          )}

          {showCarrega && (
            <Link href="/instalacions" className="no-underline">
              <div className="bg-surface border border-border rounded-xl p-6 cursor-pointer">
                <div className="text-[1.5rem] mb-2">🏭</div>
                <div className="font-bold text-[1.1rem] text-text mb-1">Instal·lacions</div>
                <div className="text-[0.85rem] text-text-dim">Veure carros a cada incubadora i naixedora en temps real</div>
              </div>
            </Link>
          )}

        </div>
      </div>
    </main>
  )
}
