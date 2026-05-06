'use client'

import { useRouter, usePathname } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const pathname = usePathname()

  if (pathname === '/login') return null

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={logout}
      title="Tancar sessió"
      style={{
        position: 'fixed',
        top: '0.75rem',
        right: '0.75rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '0.4rem 0.8rem',
        color: 'var(--text-dim)',
        fontFamily: 'IBM Plex Mono',
        fontSize: '0.72rem',
        cursor: 'pointer',
        zIndex: 9999,
        letterSpacing: '0.05em',
      }}
    >
      Sortir
    </button>
  )
}
