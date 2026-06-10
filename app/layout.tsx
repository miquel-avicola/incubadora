import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import AppLayout from './components/AppLayout'
import { cookies, headers } from 'next/headers'
import { verifySession } from '@/lib/auth'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Miquel Avícola — Incubadora',
  description: 'Gestió de la sala d\'incubació',
  viewport: 'width=device-width, initial-scale=1',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  const session = token ? await verifySession(token) : null
  const role = session?.role ?? 'recepcio'

  const headersList = headers()
  const nonce = headersList.get('x-nonce') ?? undefined

  return (
    <html lang="ca" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`} nonce={nonce}>
      <body>
        <AppLayout role={role}>
          {children}
        </AppLayout>
      </body>
    </html>
  )
}
