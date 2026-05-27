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

  return (
    <main className="bg-bg min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[360px]">

        <div className="mb-10 text-center">
          <p className="text-accent font-mono text-[0.7rem] tracking-[0.15em] uppercase mb-2">
            Miquel Avícola
          </p>
          <h1 className="text-[1.5rem] font-bold text-text m-0">
            Sala d&apos;incubació
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="username" className="block text-[0.7rem] font-mono text-text-dim uppercase tracking-[0.1em] mb-[0.4rem]">
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
              className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-text text-base outline-none font-sans box-border"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[0.7rem] font-mono text-text-dim uppercase tracking-[0.1em] mb-[0.4rem]">
              Contrasenya
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-text text-base outline-none font-sans box-border"
            />
          </div>

          {error && (
            <div className="px-3 py-[0.6rem] rounded-md bg-danger/10 border border-danger text-danger font-mono text-[0.8rem]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={[
              'mt-1 py-[0.85rem] rounded-lg font-bold font-sans text-base',
              loading
                ? 'bg-border text-text-dim cursor-default'
                : 'bg-accent text-[#0f1117] cursor-pointer',
            ].join(' ')}
          >
            {loading ? 'Entrant...' : 'Entrar'}
          </button>
        </form>

      </div>
    </main>
  )
}
