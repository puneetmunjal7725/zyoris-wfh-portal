import { useEffect, useState } from 'react'
import { ensureDbSeeded, PORTAL_DB_EVENT } from './storage.js'

const LS_KEY = 'zyoris_portal_v1'

export function subscribePortalDb(onChange) {
  const onStorage = (e) => {
    if (e.key === LS_KEY) onChange()
  }
  window.addEventListener(PORTAL_DB_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(PORTAL_DB_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** Re-render when local DB changes (same tab or other tabs). */
export function usePortalDb() {
  const [version, setVersion] = useState(0)

  useEffect(() => subscribePortalDb(() => setVersion((v) => v + 1)), [])

  const db = ensureDbSeeded()
  return { db, version }
}
