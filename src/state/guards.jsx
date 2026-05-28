import { Navigate, useLocation } from 'react-router-dom'
import { readSession } from './storage.js'

export function RequireUser({ children }) {
  const location = useLocation()
  const s = readSession()
  if (!s || s.kind !== 'employee') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export function RequireAdmin({ children }) {
  const location = useLocation()
  const s = readSession()
  if (!s || s.kind !== 'admin') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

