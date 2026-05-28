'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import LogoutButton from './LogoutButton'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams()
  const [menuOpen, setMenuOpen] = useState(false)

  const carregaId = params?.id as string | undefined

  const [numCarrega, setNumCarrega] = useState<string | null>(null)

  useEffect(() => {
    if (carregaId) {
      fetch(`/api/carrega/${carregaId}`)
        .then(r => r.json())
        .then(d => {
          if (d?.num_carrega) setNumCarrega(d.num_carrega)
        })
        .catch(console.error)
    } else {
      setNumCarrega(null)
    }
  }, [carregaId])

  if (pathname === '/login') return <>{children}</>

  // Enllaços contextuals: si estem dins d'una càrrega, mostrem els menús de la càrrega.
  // Si no, mostrem el menú global.
  const isCarrega = !!carregaId
  
  const navLinks = isCarrega ? [
    { name: 'Vista General', href: `/carrega/${carregaId}`, icon: '🏠' },
    { name: 'Assignacions', href: `/carrega/${carregaId}/assignacions`, icon: '📋' },
    { name: 'Transferència', href: `/carrega/${carregaId}/transferencia`, icon: '🥚' },
    { name: 'Naixement', href: `/carrega/${carregaId}/naixement`, icon: '🐣' },
    { name: 'Expedicions', href: `/carrega/${carregaId}/expedicions`, icon: '🚚' },
    { name: 'Dia de Naixement', href: `/carrega/${carregaId}/expedicions/naixement`, icon: '📝' },
    { name: 'Estadístiques', href: `/carrega/${carregaId}/estadistiques`, icon: '📊' },
  ] : [
    { name: 'Càrregues', href: '/carrega', icon: '🗓️' },
    { name: 'Estoc carros', href: '/estoc', icon: '📋' },
    { name: 'Recepció', href: '/recepcio', icon: '📥' },
    { name: 'Instal·lacions', href: '/instalacions', icon: '🏭' },
    { name: 'Lots de reproductores', href: '/lots', icon: '🐔' },
    { name: 'Impressions', href: '/impressions', icon: '📄' },
    { name: 'Previsió comercial', href: '/previsio-comercial', icon: '📅' },
    { name: 'Estadístiques globals', href: '/estadistiques', icon: '📊' },
  ]

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <h2 className="text-xl font-bold text-text mb-1">Miquel Avícola</h2>
        <p className="text-sm text-text-dim mono uppercase tracking-wider">{isCarrega ? `Càrrega #${numCarrega || carregaId}` : 'Incubadora'}</p>
      </div>
      
      {isCarrega && (
        <div className="px-4 mb-4">
          <Link href="/carrega" className="text-sm text-text-dim hover:text-accent transition-colors flex items-center gap-2 px-2">
            <span>←</span> Tornar a l'inici
          </Link>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1">
        {navLinks.map((link) => {
          const active = pathname === link.href || (link.href !== '/carrega' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                active 
                  ? 'bg-accent/10 text-accent font-semibold shadow-sm' 
                  : 'text-text-dim hover:text-text hover:bg-surface'
              }`}
            >
              <span className="text-lg">{link.icon}</span>
              <span>{link.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <LogoutButton />
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-bg overflow-hidden text-text font-sans">
      
      {/* Sidebar Desktop */}
      <aside className="hidden md:block w-64 bg-surface border-r border-border shrink-0 shadow-sm z-10 print:hidden">
        <NavContent />
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-20 flex items-center justify-between px-4 shadow-sm print:hidden">
        <div className="font-bold text-text truncate">
          {isCarrega ? `Càrrega #${numCarrega || carregaId}` : 'Miquel Avícola'}
        </div>
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 -mr-2 text-text focus:outline-none"
        >
          <span className="text-2xl">{menuOpen ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-surface z-20 overflow-y-auto shadow-lg animate-in slide-in-from-top-2 duration-200">
          <NavContent />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto pt-14 md:pt-0 pb-safe print:overflow-visible print:pt-0">
        <div className="min-h-full">
          {children}
        </div>
      </main>
      
    </div>
  )
}
