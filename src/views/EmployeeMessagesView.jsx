import { useMemo, useState } from 'react'
import { usePortalDb } from '../state/portalDb.js'
import {
  employeeMarkMessageRead,
  employeeReplyToMessage,
  listMessagesForEmployee,
  listNotifications,
  markNotificationRead,
} from '../state/storage.js'
import { fmtDateTime } from '../utils/format.js'

export function EmployeeMessagesView({ session }) {
  const { version } = usePortalDb()
  const [replyText, setReplyText] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)

  const messages = useMemo(
    () => listMessagesForEmployee(session.id),
    [session.id, version],
  )

  const notifications = useMemo(
    () => listNotifications('employee', session.id),
    [session.id, version],
  )

  const selected = messages.find((m) => m.id === selectedId) || messages[0]

  async function openMessage(m) {
    setSelectedId(m.id)
    await employeeMarkMessageRead(m.id, session.id)
  }

  async function sendReply() {
    if (!selected || replyText.trim().length < 2) return
    setBusy(true)
    try {
      await employeeReplyToMessage({
        messageId: selected.id,
        empId: session.id,
        empName: session.name,
        body: replyText.trim(),
      })
      setReplyText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div className="cardHeaderTitle">Notifications</div>
          <span className="pill">{notifications.filter((n) => !n.readAt).length} unread</span>
        </div>
        <div className="cardBody">
          {notifications.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className="card"
                  style={{ boxShadow: 'none', opacity: n.readAt ? 0.7 : 1 }}
                >
                  <div className="cardBody" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>{n.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{n.body}</div>
                    <div className="row rowKeep" style={{ marginTop: 8, justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDateTime(n.createdAt)}</span>
                      {!n.readAt ? (
                        <button type="button" className="btn" onClick={() => markNotificationRead(n.id)}>
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No notifications yet.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div className="cardHeaderTitle">Messages from admin</div>
          <span className="pill">{messages.length}</span>
        </div>
        <div className="cardBody">
          {messages.length ? (
            <div className="grid2">
              <div>
                {messages.map((m) => {
                  const unread = !m.recipients?.find((r) => r.empId === session.id)?.readAt
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`btn${selected?.id === m.id ? ' navLinkActive' : ''}`}
                      style={{ width: '100%', marginBottom: 8, textAlign: 'left' }}
                      onClick={() => openMessage(m)}
                    >
                      {unread ? '● ' : ''}
                      [{m.priority}] {m.title}
                    </button>
                  )
                })}
              </div>
              {selected ? (
                <div>
                  <h3 style={{ margin: '0 0 8px' }}>{selected.title}</h3>
                  <span className="pill">{selected.priority}</span>
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{selected.body}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDateTime(selected.createdAt)}</p>
                  {(selected.replies || []).map((r) => (
                    <div key={r.id} className="card" style={{ boxShadow: 'none', marginTop: 10 }}>
                      <div className="cardBody" style={{ padding: 10 }}>
                        <b>{r.empName}</b>: {r.body}
                      </div>
                    </div>
                  ))}
                  <div className="label" style={{ marginTop: 14 }}>
                    Reply to admin
                  </div>
                  <textarea
                    className="textarea"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Your reply…"
                  />
                  <button type="button" className="btn btnPrimary" style={{ marginTop: 8 }} disabled={busy} onClick={sendReply}>
                    Send reply
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No messages yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
