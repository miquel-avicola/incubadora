import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Miquel Avícola — Incubadora',
  description: 'Gestió de la sala d\'incubació',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  )
}
