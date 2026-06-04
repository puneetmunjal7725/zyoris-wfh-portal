import { useMemo, useState } from 'react'
import { usePortalDb } from '../state/portalDb.js'
import {
  adminSendMessage,
  ensureDbSeeded,
  listNotifications,
  markNotificationRead,
} from '../state/storage.js'
import { fmtDateTime } from '../utils/format.js'

export function AdminMessagesView() {
  const { db, version } = usePortalDb()
  const employees = useMemo(() => ensureDbSeeded().employees, [db, version])
  const messages = useMemo(() => db.messages || [], [db, version])
  const notifications = useMemo(() => listNotifications('admin', 'admin'), [db, version])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [scope, setScope] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  function toggleEmp(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function send() {
    setMsg('')
    if (!title.trim() || !body.trim()) {
      setMsg('Title and message are required.')
      return
    }
    const recipientEmpIds =
      scope === 'all' ? employees.map((e) => e.id) : selectedIds
    if (!recipientEmpIds.length) {
      setMsg('Select at least one employee.')
      return
    }
    setBusy(true)
    try {
      await adminSendMessage({
        title: title.trim(),
        body: body.trim(),
        priority,
        recipientEmpIds,
      })
      setTitle('')
      setBody('')
      setMsg('Message sent to cloud — all devices will receive it.')
    } catch (err) {
      setMsg(err?.message || 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div className="cardHeaderTitle">Send message</div>
        </div>
        <div className="cardBody">
          <div className="grid2">
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="label">Title</div>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="label">Message</div>
              <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div>
              <div className="label">Priority</div>
              <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option>Normal</option>
                <option>Important</option>
                <option>Critical</option>
              </select>
            </div>
            <div>
              <div className="label">Send to</div>
              <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">Entire organization</option>
                <option value="selected">Selected employees</option>
              </select>
            </div>
          </div>
          {scope === 'selected' ? (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {employees.map((e) => (
                <label key={e.id} className="pill" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(e.id)}
                    onChange={() => toggleEmp(e.id)}
                    style={{ marginRight: 6 }}
                  />
                  {e.name}
                </label>
              ))}
            </div>
          ) : null}
          <button type="button" className="btn btnPrimary" style={{ marginTop: 14 }} disabled={busy} onClick={send}>
            Send message
          </button>
          {msg ? <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-h)' }}>{msg}</p> : null}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div className="cardHeaderTitle">Admin notifications</div>
        </div>
        <div className="cardBody">
          {notifications.slice(0, 15).map((n) => (
            <div key={n.id} className="card" style={{ boxShadow: 'none', marginBottom: 8 }}>
              <div className="cardBody" style={{ padding: 10 }}>
                <b>{n.title}</b>
                <div style={{ fontSize: 13 }}>{n.body}</div>
                {!n.readAt ? (
                  <button type="button" className="btn" style={{ marginTop: 6 }} onClick={() => markNotificationRead(n.id)}>
                    Mark read
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div className="cardHeaderTitle">Sent messages</div>
          <span className="pill">{messages.length}</span>
        </div>
        <div className="cardBody">
          {messages.length ? (
            messages.map((m) => (
              <div key={m.id} className="card" style={{ boxShadow: 'none', marginBottom: 10 }}>
                <div className="cardBody" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 650 }}>{m.title}</div>
                  <span className="pill">{m.priority}</span>
                  <span className="pill">{m.recipients?.length || 0} recipients</span>
                  <p style={{ fontSize: 13, marginTop: 8 }}>{m.body.slice(0, 120)}…</p>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDateTime(m.createdAt)}</div>
                  {(m.replies || []).length ? (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      Replies: {(m.replies || []).map((r) => r.empName).join(', ')}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No messages sent yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
