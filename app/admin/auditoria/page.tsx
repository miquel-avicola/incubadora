'use client'

import { useState, useEffect, useCallback } from 'react'

interface AuditEntry {
  id: string
  ts: string
  user_id: string | null
  username: string | null
  role: string
  ip: string | null
  method: string
  path: string
  payload: unknown
  status_code: number | null
}

const PAGE_SIZE = 50

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filtres
  const [pathLike, setPathLike] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchEntries = useCallback(async (newOffset = 0) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(newOffset),
      })
      if (pathLike.trim()) params.set('path_like', pathLike.trim())
      if (from) params.set('from', from)
      if (to) params.set('to', to + 'T23:59:59Z')

      const res = await fetch(`/api/admin/auditoria?${params}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json = await res.json()
      setEntries(newOffset === 0 ? json.data : prev => [...prev, ...json.data])
      setTotal(json.total)
      setOffset(newOffset + json.data.length)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconegut')
    } finally {
      setLoading(false)
    }
  }, [pathLike, from, to])

  useEffect(() => {
    fetchEntries(0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setEntries([])
    setOffset(0)
    fetchEntries(0)
  }

  function methodColor(method: string): string {
    switch (method) {
      case 'POST': return '#2563eb'
      case 'PATCH': return '#d97706'
      case 'PUT': return '#7c3aed'
      case 'DELETE': return '#dc2626'
      default: return '#6b7280'
    }
  }

  function statusColor(code: number | null): string {
    if (!code) return '#6b7280'
    if (code < 300) return '#16a34a'
    if (code < 400) return '#d97706'
    return '#dc2626'
  }

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'var(--font-ibm-plex-sans, sans-serif)', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Registre d'auditoria
      </h1>

      {/* Filtres */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
          Ruta (conté)
          <input
            type="text"
            value={pathLike}
            onChange={e => setPathLike(e.target.value)}
            placeholder="/api/carrega"
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem', width: '200px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
          Des de
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
          Fins a
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '0.375rem 1rem', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer', height: '34px', alignSelf: 'flex-end' }}
        >
          {loading ? 'Cercant…' : 'Cercar'}
        </button>
        {(pathLike || from || to) && (
          <button
            type="button"
            onClick={() => { setPathLike(''); setFrom(''); setTo(''); setEntries([]); setOffset(0); }}
            style={{ padding: '0.375rem 0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer', height: '34px', alignSelf: 'flex-end' }}
          >
            Netejar
          </button>
        )}
      </form>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: '0.375rem', color: '#dc2626', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Taula */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Data / hora</th>
              <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Usuari</th>
              <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Mètode</th>
              <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Ruta</th>
              <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Estat</th>
              <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>IP</th>
              <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: '#475569' }}>Payload</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <>
                <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                  <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: '#64748b' }}>
                    {new Date(e.ts).toLocaleString('ca-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>
                    {e.username ?? '—'}
                    {e.role !== 'admin' && (
                      <span style={{ marginLeft: '0.375rem', fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '0.1rem 0.3rem', color: '#64748b' }}>
                        {e.role}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span style={{ background: methodColor(e.method), color: '#fff', borderRadius: '0.25rem', padding: '0.15rem 0.4rem', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {e.method}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', color: '#334155', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.path}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span style={{ color: statusColor(e.status_code), fontWeight: 600 }}>
                      {e.status_code ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {e.ip ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {e.payload ? (
                      <button
                        onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                        style={{ fontSize: '0.75rem', background: 'none', border: '1px solid #cbd5e1', borderRadius: '0.25rem', padding: '0.1rem 0.5rem', cursor: 'pointer', color: '#475569' }}
                      >
                        {expandedId === e.id ? 'Amagar' : 'Veure'}
                      </button>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>buit</span>
                    )}
                  </td>
                </tr>
                {expandedId === e.id && e.payload && (
                  <tr key={`${e.id}-payload`} style={{ background: '#f8fafc' }}>
                    <td colSpan={7} style={{ padding: '0.5rem 1rem 0.75rem 2rem' }}>
                      <pre style={{ fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#334155', margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                  Cap entrada trobada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: '#64748b' }}>
        <span>
          {entries.length} de {total} entrades
        </span>
        {entries.length < total && (
          <button
            onClick={() => fetchEntries(offset)}
            disabled={loading}
            style={{ padding: '0.375rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.375rem', cursor: 'pointer' }}
          >
            {loading ? 'Carregant…' : 'Carregar més'}
          </button>
        )}
      </div>
    </div>
  )
}
