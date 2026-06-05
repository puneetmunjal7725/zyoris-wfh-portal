import { useEffect, useMemo, useState } from 'react'
import { usePortalDb } from '../state/portalDb.js'
import {
  adminDeleteMessage,
  adminSendMessage,
  ensureDbSeeded,
  listNotifications,
  markNotificationRead,
} from '../state/storage.js'
import { probeMessagesTable } from '../state/supabaseSync.js'
import { fmtDateTime } from '../utils/format.js'

const MESSAGES_SQL_HINT =
  'Open Supabase → SQL Editor → paste file supabase/migration-messages-only.sql → Run'

export function AdminMessagesView() {
  const { db, version } = usePortalDb()
  const employees = useMemo(
    () => [...ensureDbSeeded().employees].sort((a, b) => a.name.localeCompare(b.name)),
    [db, version],
  )
  const messages = useMemo(() => db.messages || [], [db, version])
  const notifications = useMemo(() => listNotifications('admin', 'admin'), [db, version])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [scope, setScope] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [messagesReady, setMessagesReady] = useState(null)

  useEffect(() => {
    let cancelled = false
    void probeMessagesTable().then((ok) => {
      if (!cancelled) setMessagesReady(ok)
    })
    return () => {
      cancelled = true
    }
  }, [version])

  async function send() {
    setMsg('')
    if (!title.trim() || !body.trim()) {
      setMsg('Title and message are required.')
      return
    }
    const recipientEmpIds =
      scope === 'all' ? employees.map((e) => e.id) : selectedIds
    if (!recipientEmpIds.length) {
      setMsg('Select at least one employee from the dropdown.')
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
      setSelectedIds([])
      setMsg('Message sent — all selected employees will see it on every device.')
      setMessagesReady(true)
    } catch (err) {
      if (err?.code === 'MESSAGES_SCHEMA_MISSING') {
        setMessagesReady(false)
      }
      setMsg(err?.message || 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  function onEmployeeSelectChange(e) {
    const ids = [...e.target.selectedOptions].map((o) => o.value)
    setSelectedIds(ids)
  }

  async function removeMessage(messageId, title) {
    if (!window.confirm(`Delete message "${title}"? Employees will no longer see it.`)) return
    setDeletingId(messageId)
    setMsg('')
    try {
      await adminDeleteMessage(messageId)
      setMsg('Message deleted.')
    } catch (err) {
      setMsg(err?.message || 'Could not delete message.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="container">
      {messagesReady === false ? (
        <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(239, 68, 68, 0.45)' }}>
          <div className="cardBody">
            <p className="formError" style={{ margin: '0 0 8px' }}>
              Messaging tables missing in Supabase — that is why send fails.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 10px' }}>
              {MESSAGES_SQL_HINT}
            </p>
            <a
              className="btn btnPrimary"
              href="https://supabase.com/dashboard/project/qbtzjpcdutjnjhpqqfwr/sql/new"
              target="_blank"
              rel="noreferrer"
            >
              Open SQL Editor
            </a>
            <button
              type="button"
              className="btn"
              style={{ marginLeft: 8 }}
              onClick={() => void probeMessagesTable().then(setMessagesReady)}
            >
              Check again
            </button>
          </div>
        </div>
      ) : null}

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
            <div style={{ marginTop: 14 }}>
              <div className="label">Employees (hold Ctrl / Cmd to select multiple)</div>
              <select
                className="select employeeMultiSelect"
                multiple
                size={Math.min(10, Math.max(4, employees.length))}
                value={selectedIds}
                onChange={onEmployeeSelectChange}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.id})
                  </option>
                ))}
              </select>
              {selectedIds.length ? (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text)' }}>
                  Selected: {selectedIds.length} employee{selectedIds.length === 1 ? '' : 's'}
                </p>
              ) : (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text)' }}>
                  Choose one or more employees from the list above.
                </p>
              )}
            </div>
          ) : null}

          <button type="button" className="btn btnPrimary" style={{ marginTop: 14 }} disabled={busy} onClick={send}>
            Send message
          </button>
          {msg ? (
            <p
              style={{
                marginTop: 10,
                fontSize: 13,
                color: msg.includes('saved on this device') ? '#f59e0b' : 'var(--text-h)',
              }}
            >
              {msg}
            </p>
          ) : null}
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
                  <div className="row rowKeep" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 650 }}>{m.title}</div>
                    <button
                      type="button"
                      className="btn"
                      disabled={deletingId === m.id}
                      onClick={() => void removeMessage(m.id, m.title)}
                    >
                      {deletingId === m.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                  <span className="pill">{m.priority}</span>
                  <span className="pill">{m.recipients?.length || 0} recipients</span>
                  <p style={{ fontSize: 13, marginTop: 8 }}>{m.body.slice(0, 120)}{m.body.length > 120 ? '…' : ''}</p>
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
