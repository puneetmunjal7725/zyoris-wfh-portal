import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { getDbMode, initPortalDb } from '../state/storage.js'

export function PortalBootstrap({ children }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    initPortalDb()
      .then(() => {
        if (!cancelled) setStatus('ready')
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Could not connect to server.')
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="container" style={{ paddingTop: 48, textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
          <div className="cardBody">
            <div style={{ fontWeight: 650, color: 'var(--text-h)', marginBottom: 8 }}>Loading portal…</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              {isSupabaseConfigured() ? 'Connecting to Zyoris cloud database' : 'Starting local mode'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="cardBody">
            <div style={{ fontWeight: 650, color: '#ef4444', marginBottom: 8 }}>Server connection failed</div>
            <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 12px' }}>{error}</p>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>
              Check <code>SUPABASE-SETUP.md</code> — URL and anon key in <code>.env.production</code>, then run{' '}
              <code>supabase/schema.sql</code> in your Supabase project.
            </p>
            <button type="button" className="btn btnPrimary" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const mode = getDbMode()
  return (
    <>
      {mode === 'cloud' ? (
        <div className="cloudBadge" title="Data is stored on Supabase (shared for all devices)">
          Cloud sync on
        </div>
      ) : null}
      {children}
    </>
  )
}
