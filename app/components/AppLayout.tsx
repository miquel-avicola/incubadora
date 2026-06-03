'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import LogoutButton from './LogoutButton'

interface NavLink { name: string; href: string; icon: string }

function NavContent({
  isCarrega,
  numCarrega,
  carregaId,
  navLinks,
  pathname,
  onLinkClick,
}: {
  isCarrega: boolean
  numCarrega: string | null
  carregaId: string | undefined
  navLinks: NavLink[]
  pathname: string
  onLinkClick: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <h2 className="text-xl font-bold text-text mb-1">Miquel Avícola</h2>
        <p className="text-sm text-text-dim mono uppercase tracking-wider">
          {isCarrega ? `Càrrega #${numCarrega || carregaId}` : 'Incubadora'}
        </p>
      </div>

      {isCarrega && (
        <div className="px-4 mb-4">
          <Link href="/carrega" className="text-sm text-text-dim hover:text-accent transition-colors flex items-center gap-2 px-2">
            <span>←</span> Tornar a l&apos;inici
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
              onClick={onLinkClick}
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
}

const CARREGA_LINKS_BASE: Omit<NavLink, 'href'>[] = [
  { name: 'Vista General',   icon: '🏠' },
  { name: 'Assignacions',    icon: '📋' },
  { name: 'Transferència',   icon: '🥚' },
  { name: 'Naixement',       icon: '🐣' },
  { name: 'Expedicions',     icon: '🚚' },
  { name: 'Dia de Naixement',icon: '📝' },
  { name: 'Estadístiques',   icon: '📊' },
]

const CARREGA_LINK_SUFFIXES = ['', '/assignacions', '/transferencia', '/naixement', '/expedicions', '/expedicions/naixement', '/estadistiques']

const GLOBAL_LINKS: NavLink[] = [
  { name: 'Càrregues',                  href: '/carrega',                           icon: '🗓️' },
  { name: 'Assignacions',               href: '/carrega/seleccionar/assignacions',   icon: '📋' },
  { name: 'Transferència',              href: '/carrega/seleccionar/transferencia',  icon: '🥚' },
  { name: 'Naixement',                  href: '/carrega/seleccionar/naixement',      icon: '🐣' },
  { name: 'Expedicions',                href: '/carrega/seleccionar/expedicions',    icon: '🚚' },
  { name: 'Dia de Naixement',           href: '/carrega/seleccionar/dia-naixement',  icon: '📝' },
  { name: 'Estoc carros',               href: '/estoc',                             icon: '📦' },
  { name: 'Recepció',                   href: '/recepcio',                          icon: '📥' },
  { name: 'Instal·lacions',             href: '/instalacions',                      icon: '🏭' },
  { name: 'Lots de reproductores',      href: '/lots',                              icon: '🐔' },
  { name: 'Impressions',                href: '/impressions',                       icon: '📄' },
  { name: 'Previsió comercial',         href: '/previsio-comercial',                icon: '📅' },
  { name: 'Estadístiques globals',      href: '/estadistiques',                     icon: '📊' },
  { name: 'Estadística setmanal Jordi', href: '/estadistiques-setmanal',            icon: '📈' },
]

export default function AppLayout({ children, role }: { children: React.ReactNode; role?: string }) {
  const pathname = usePathname()
  const params = useParams()
  const [menuOpen, setMenuOpen] = useState(false)

  const carregaId = params?.id as string | undefined

  const [numCarrega, setNumCarrega] = useState<string | null>(null)

  useEffect(() => {
    if (carregaId) {
      fetch(`/api/carrega/${carregaId}`)
        .then(r => r.json())
        .then(d => { if (d?.num_carrega) setNumCarrega(d.num_carrega) })
        .catch(console.error)
    } else {
      setNumCarrega(null)
    }
  }, [carregaId])

  if (pathname === '/login') return <>{children}</>

  const isCarrega = !!carregaId

  if (role === 'responsable') {
    return (
      <div className="flex flex-col h-screen bg-bg overflow-hidden text-text font-sans">
        <div className="h-14 bg-surface border-b border-border z-20 flex items-center justify-between px-6 shadow-sm print:hidden shrink-0">
          <div className="font-bold text-text truncate">
            {isCarrega ? `Càrrega #${numCarrega || carregaId}` : 'Miquel Avícola'}
          </div>
          <LogoutButton />
        </div>
        <main className="flex-1 relative overflow-y-auto pb-safe print:overflow-visible">
          <div className="min-h-full">{children}</div>
        </main>
      </div>
    )
  }

  const navLinks: NavLink[] = isCarrega
    ? CARREGA_LINKS_BASE.map((l, i) => ({ ...l, href: `/carrega/${carregaId}${CARREGA_LINK_SUFFIXES[i]}` }))
    : GLOBAL_LINKS

  const navProps = { isCarrega, numCarrega, carregaId, navLinks, pathname, onLinkClick: () => setMenuOpen(false) }

  return (
    <div className="flex h-screen bg-bg overflow-hidden text-text font-sans">

      {/* Sidebar Desktop */}
      <aside className="hidden md:block w-64 bg-surface border-r border-border shrink-0 shadow-sm z-10 print:hidden">
        <NavContent {...navProps} />
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
          <NavContent {...navProps} />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto pt-14 md:pt-0 pb-safe print:overflow-visible print:pt-0">
        <div className="min-h-full">{children}</div>
      </main>

    </div>
  )
}
