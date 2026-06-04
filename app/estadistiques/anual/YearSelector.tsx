'use client'

import { useRouter, usePathname } from 'next/navigation'

export function YearSelector({ any, anysDisponibles }: { any: number; anysDisponibles: number[] }) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <select
      value={any}
      onChange={(e) => router.push(`${pathname}?any=${e.target.value}`)}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        fontFamily: 'IBM Plex Sans',
        outline: 'none',
      }}
    >
      {anysDisponibles.length === 0 && <option value={any}>{any}</option>}
      {anysDisponibles.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  )
}
