import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { usePortalDb } from '../state/portalDb.js'
import {
  listMessagesForEmployee,
  readSession,
  unreadMessageCount,
  unreadNotificationCount,
} from '../state/storage.js'

export function EmployeeNavExtras() {
  const session = readSession()
  const { version } = usePortalDb()
  const unread = useMemo(() => {
    if (!session?.id) return 0
    return unreadMessageCount(session.id) + unreadNotificationCount('employee', session.id)
  }, [session?.id, version])

  const linkClass = ({ isActive }) => `btn${isActive ? ' navLinkActive' : ''}`

  return (
    <>
      <NavLink className={linkClass} to="/employee/history">
        History
      </NavLink>
      <NavLink className={linkClass} to="/employee/messages">
        Messages{unread > 0 ? ` (${unread})` : ''}
      </NavLink>
      <NavLink className={linkClass} to="/employee/profile">
        My Profile
      </NavLink>
    </>
  )
}

export function AdminMessageAlert() {
  const { version } = usePortalDb()
  const [count, setCount] = useState(0)
  useEffect(() => {
    setCount(unreadNotificationCount('admin', 'admin'))
  }, [version])
  if (!count) return null
  return <span className="pill scoreAmber">{count} new</span>
}

export function EmployeeImportantMessageModal({ session }) {
  const { db, version } = usePortalDb()
  const [shown, setShown] = useState(null)

  const urgent = useMemo(() => {
    if (!session?.id) return null
    const msgs = listMessagesForEmployee(session.id)
    return msgs.find((m) => {
      if (m.priority !== 'Important' && m.priority !== 'Critical') return false
      const r = m.recipients?.find((x) => x.empId.toUpperCase() === session.id.toUpperCase())
      return r && !r.readAt
    })
  }, [session?.id, db, version])

  useEffect(() => {
    if (urgent && urgent.id !== shown) {
      setShown(urgent.id)
      import('../utils/notifySound.js').then(({ playActivityCheckBell }) => playActivityCheckBell())
    }
  }, [urgent, shown])

  if (!urgent || shown !== urgent.id) return null

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal modalAlert">
        <div className="cardHeader">
          <div>
            <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>IMPORTANT MESSAGE FROM ADMIN</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{urgent.priority} priority</div>
          </div>
        </div>
        <div className="cardBody">
          <h3 style={{ margin: '0 0 10px', color: 'var(--text-h)' }}>{urgent.title}</h3>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text)' }}>{urgent.body}</p>
          <div className="row rowKeep" style={{ marginTop: 16, gap: 10 }}>
            <NavLink className="btn btnPrimary" to="/employee/messages" onClick={() => setShown(null)}>
              Go To Message
            </NavLink>
            <button type="button" className="btn" onClick={() => setShown(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
