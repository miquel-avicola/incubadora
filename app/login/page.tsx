'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error desconegut')
      setLoading(false)
      return
    }
    router.push('/')
  }

  const inputStyle = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    color: 'var(--text)',
    fontSize: '1rem',
    outline: 'none',
    fontFamily: 'IBM Plex Sans',
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--accent)', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Miquel Avícola
          </p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Sala d&apos;incubació
          </h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="username" style={{ display: 'block', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
              Usuari
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
              Contrasenya
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', background: 'rgba(240,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'IBM Plex Mono', fontSize: '0.8rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.85rem',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontFamily: 'IBM Plex Sans',
              fontSize: '1rem',
              cursor: loading ? 'default' : 'pointer',
              background: loading ? 'var(--border)' : 'var(--accent)',
              color: loading ? 'var(--text-dim)' : '#0f1117',
              marginTop: '0.25rem',
            }}
          >
            {loading ? 'Entrant...' : 'Entrar'}
          </button>
        </form>

      </div>
    </main>
  )
}
