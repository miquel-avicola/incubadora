import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface HubCard {
  href: string
  icon: string
  title: string
  subtitle: string
  desc: string
}

const CARDS: HubCard[] = [
  {
    href: '/estadistiques/setmanal',
    icon: '📈',
    title: 'Setmanal',
    subtitle: 'Estadístiques Jordi',
    desc: 'Resum per setmana: ous nostres i de maquila, pollets servits i sexats, desglossat per dilluns i dijous, per lot i per client.',
  },
  {
    href: '/estadistiques/mensual',
    icon: '📊',
    title: 'Mensual',
    subtitle: 'Estadístiques Anna',
    desc: 'Resum per mes: ous entrats, pollets nascuts i pollets servits, amb repartiment dins i fora de Catalunya.',
  },
  {
    href: '/estadistiques/anual',
    icon: '📅',
    title: 'Anual',
    subtitle: 'Resum de l’any',
    desc: 'Ous totals i pollets nascuts, desglossat per mesos i per lot, amb fertilitat i naixement mitjans per màquina.',
  },
  {
    href: '/lots',
    icon: '🐔',
    title: 'Per lot',
    subtitle: 'Lots de reproductores',
    desc: 'Evolució de cada lot a través de totes les càrregues: fertilitat, eclosió i naixement amb el seu històric.',
  },
]

export default function EstadistiquesHub() {
  return (
    <main className="min-h-screen bg-bg p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <p className="text-accent mono text-xs uppercase tracking-widest mb-1">Estadístiques</p>
          <h1 className="text-2xl font-bold text-text">Totes les estadístiques</h1>
          <p className="text-text-dim text-sm mt-1">Tria el tipus de resum que vols consultar.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group block bg-surface border border-border rounded-xl p-5 transition-all duration-200 hover:border-accent hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl shrink-0">{c.icon}</span>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-lg font-bold text-text group-hover:text-accent transition-colors">{c.title}</h2>
                    <span className="text-xs text-text-dim mono uppercase tracking-wider">{c.subtitle}</span>
                  </div>
                  <p className="text-sm text-text-dim mt-1.5 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
