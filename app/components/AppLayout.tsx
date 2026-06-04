'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import LogoutButton from './LogoutButton'

interface NavLink { name: string; href: string; icon: string }
interface NavNode { name: string; href: string; children?: NavNode[] }
interface NavGroup { name: string; href: string; icon: string; children?: NavNode[] }

// Sidebar amb grups i subgrups (global) + llista plana dins d'una càrrega.
// ---- Active-state helpers -------------------------------------------------
function pathMatches(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(href + '/')
}
function nodeActive(n: NavNode, pathname: string): boolean {
  return pathMatches(n.href, pathname) || (n.children ?? []).some((c) => nodeActive(c, pathname))
}
function groupActive(g: NavGroup, pathname: string): boolean {
  return pathMatches(g.href, pathname) || (g.children ?? []).some((c) => nodeActive(c, pathname))
}

// ---- Global sidebar: groups + subgroups -----------------------------------
const GLOBAL_GROUPS: NavGroup[] = [
  { name: 'Previsió comercial', href: '/previsio-comercial', icon: '📅' },
  {
    name: 'Estoc de carros', href: '/estoc', icon: '📦',
    children: [{ name: 'Recepció de carros', href: '/recepcio' }],
  },
  {
    name: 'Càrregues', href: '/carrega', icon: '🗓️',
    children: [
      { name: 'Assignacions',  href: '/carrega/seleccionar/assignacions' },
      { name: 'Pla vacunal',   href: '/carrega/seleccionar/vacunes' },
      { name: 'Transferència', href: '/carrega/seleccionar/transferencia' },
      { name: 'Naixement',     href: '/carrega/seleccionar/naixement' },
      {
        name: 'Expedicions', href: '/carrega/seleccionar/expedicions',
        children: [{ name: 'Dia del naixement', href: '/carrega/seleccionar/dia-naixement' }],
      },
    ],
  },
  { name: 'Documents', href: '/impressions', icon: '📄' },
  { name: 'Lots reproductores', href: '/lots', icon: '🐔' },
  { name: 'Instal·lacions', href: '/instalacions', icon: '🏭' },
  {
    name: 'Estadístiques', href: '/estadistiques', icon: '📊',
    children: [
      { name: 'Setmanal (Jordi)', href: '/estadistiques/setmanal' },
      { name: 'Mensual (Anna)',   href: '/estadistiques/mensual' },
      { name: 'Anual',            href: '/estadistiques/anual' },
      { name: 'Lot',              href: '/lots' },
    ],
  },
]

// ---- In-càrrega sidebar: flat list scoped to one càrrega ------------------
const CARREGA_LINKS_BASE: Omit<NavLink, 'href'>[] = [
  { name: 'Vista General',   icon: '🏠' },
  { name: 'Assignacions',    icon: '📋' },
  { name: 'Pla vacunal',     icon: '💉' },
  { name: 'Transferència',   icon: '🥚' },
  { name: 'Naixement',       icon: '🐣' },
  { name: 'Expedicions',     icon: '🚚' },
  { name: 'Dia de Naixement',icon: '📝' },
  { name: 'Estadístiques',   icon: '📊' },
]

const CARREGA_LINK_SUFFIXES = ['', '/assignacions', '/vacunes', '/transferencia', '/naixement', '/expedicions', '/expedicions/naixement', '/estadistiques']

function GroupNav({ pathname, onLinkClick }: { pathname: string; onLinkClick: () => void }) {
  return (
    <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
      {GLOBAL_GROUPS.map((g) => {
        const gActive = groupActive(g, pathname)
        return (
          <div key={g.name} className="mb-1.5">
            <Link
              href={g.href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                gActive ? 'text-accent font-semibold bg-accent/10' : 'text-text hover:bg-surface'
              }`}
            >
              <span className="text-lg">{g.icon}</span>
              <span className="font-semibold">{g.name}</span>
            </Link>

            {g.children && g.children.length > 0 && (
              <div className="ml-5 mt-0.5 border-l border-border pl-3 space-y-0.5">
                {g.children.map((c) => {
                  const cActive = nodeActive(c, pathname)
                  return (
                    <div key={c.href}>
                      <Link
                        href={c.href}
                        onClick={onLinkClick}
                        className={`block px-2 py-1.5 rounded-md text-sm transition-colors ${
                          cActive ? 'text-accent font-medium' : 'text-text-dim hover:text-text hover:bg-surface'
                        }`}
                      >
                        {c.name}
                      </Link>

                      {c.children && c.children.length > 0 && (
                        <div className="ml-3 mt-0.5 border-l border-border pl-3 space-y-0.5">
                          {c.children.map((cc) => {
                            const ccActive = pathMatches(cc.href, pathname)
                            return (
                              <Link
                                key={cc.href}
                                href={cc.href}
                                onClick={onLinkClick}
                                className={`block px-2 py-1 rounded-md text-[0.8rem] transition-colors ${
                                  ccActive ? 'text-accent font-medium' : 'text-text-dim hover:text-text hover:bg-surface'
                                }`}
                              >
                                {cc.name}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

function FlatNav({ navLinks, pathname, onLinkClick }: { navLinks: NavLink[]; pathname: string; onLinkClick: () => void }) {
  return (
    <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
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
  )
}

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

      {isCarrega
        ? <FlatNav navLinks={navLinks} pathname={pathname} onLinkClick={onLinkClick} />
        : <GroupNav pathname={pathname} onLinkClick={onLinkClick} />}

      <div className="p-4 border-t border-border">
        <LogoutButton />
      </div>
    </div>
  )
}

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
      <div className="flex flex-col h-screen bg-bg overflow-hidden text-text font-sans print:h-auto print:overflow-visible print:block">
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
    : []

  const navProps = { isCarrega, numCarrega, carregaId, navLinks, pathname, onLinkClick: () => setMenuOpen(false) }

  return (
    <div className="flex h-screen bg-bg overflow-hidden text-text font-sans print:h-auto print:overflow-visible print:block">

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
