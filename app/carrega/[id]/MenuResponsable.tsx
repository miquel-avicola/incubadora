'use client'

import Link from 'next/link'

interface Full {
  id: number
  num_carrega: number
}

interface Props {
  full: Full
}

export default function MenuResponsable({ full }: Props) {
  return (
    <main className="bg-bg min-h-screen p-6 md:p-12">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <Link href="/carrega" className="text-text-dim no-underline text-sm font-mono hover:text-text transition-colors">← Càrregues</Link>
          <div>
            <p className="text-accent font-mono text-xs tracking-widest uppercase m-0 mb-1">Càrrega</p>
            <h1 className="text-3xl font-bold m-0 text-text">#{full.num_carrega}</h1>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Link href={`/carrega/${full.id}/transferencia`} className="no-underline">
            <div className="bg-surface hover:bg-surface-hover border border-border hover:border-accent transition-all rounded-xl p-8 cursor-pointer flex flex-col items-center justify-center gap-3 text-center shadow-sm">
              <span className="text-4xl">🥚</span>
              <span className="text-text font-bold text-xl">Transferència</span>
            </div>
          </Link>

          <Link href={`/carrega/${full.id}/naixement`} className="no-underline">
            <div className="bg-surface hover:bg-surface-hover border border-border hover:border-accent transition-all rounded-xl p-8 cursor-pointer flex flex-col items-center justify-center gap-3 text-center shadow-sm">
              <span className="text-4xl">🐣</span>
              <span className="text-text font-bold text-xl">Naixement</span>
            </div>
          </Link>

          <Link href={`/carrega/${full.id}/expedicions/naixement`} className="no-underline">
            <div className="bg-surface hover:bg-surface-hover border border-border hover:border-accent transition-all rounded-xl p-8 cursor-pointer flex flex-col items-center justify-center gap-3 text-center shadow-sm">
              <span className="text-4xl">📝</span>
              <span className="text-text font-bold text-xl">Dia de naixement</span>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}
