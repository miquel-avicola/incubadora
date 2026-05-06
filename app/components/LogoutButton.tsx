'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <button
      onClick={logout}
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '0.4rem 0.75rem',
        color: 'var(--text-dim)',
        fontFamily: 'IBM Plex Mono',
        fontSize: '0.7rem',
        cursor: 'pointer',
        zIndex: 1000,
        letterSpacing: '0.05em',
      }}
    >
      Sortir
    </button>
  )
}
