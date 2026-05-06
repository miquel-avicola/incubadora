import type { Metadata } from 'next'
import './globals.css'
import LogoutButton from './components/LogoutButton'

export const metadata: Metadata = {
  title: 'Miquel Avícola — Incubadora',
  description: 'Gestió de la sala d\'incubació',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>
        {children}
        <LogoutButton />
      </body>
    </html>
  )
}
