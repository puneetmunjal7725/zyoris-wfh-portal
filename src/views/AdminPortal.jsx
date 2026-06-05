import { useEffect, useMemo, useState } from 'react'
import { usePortalDb } from '../state/portalDb.js'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { PortalShell } from '../ui/PortalShell.jsx'
import { DEFAULT_EMPLOYEE_PASSWORD } from '../config/portal.js'
import {
  addEmployee,
  computeScore,
  ensureDbSeeded,
  getEmployeeById,
  nowIso,
  readSession,
  getDbMode,
  getLastSyncError,
  pushAllLocalToCloud,
  refreshFromCloud,
  removeEmployee,
  resetAllEmployeePasswords,
  todayStr,
  updateLeave,
  writeSession,
} from '../state/storage.js'
import { buildMergedActivityRows } from '../state/activityLog.js'
import { ShiftActivityBlock } from '../ui/ShiftActivityBlock.jsx'
import { ScoreBadge } from '../ui/ScoreBadge.jsx'
import { EmployeeProfileEditor } from '../ui/EmployeeProfileEditor.jsx'
import { RoleInput } from '../ui/RoleInput.jsx'
import { fmtDate, fmtTime } from '../utils/format.js'
import { isValidEmail } from '../utils/employee.js'
import { normalizeDateStr } from '../utils/date.js'
import { AdminAttendanceHistory } from './AdminAttendanceHistory.jsx'
import { AdminMessagesView } from './AdminMessagesView.jsx'
import { AdminMessageAlert } from '../ui/PortalNotifications.jsx'

function AdminNav() {
  const navigate = useNavigate()
  const linkClass = ({ isActive }) => `btn${isActive ? ' navLinkActive' : ''}`

  return (
    <>
      <NavLink className={linkClass} to="/admin" end>
        Overview
      </NavLink>
      <NavLink className={linkClass} to="/admin/employees">
        Employees
      </NavLink>
      <NavLink className={linkClass} to="/admin/leaves">
        Leaves
      </NavLink>
      <NavLink className={linkClass} to="/admin/attendance-history">
        Attendance
      </NavLink>
      <NavLink className={linkClass} to="/admin/messages">
        Messages <AdminMessageAlert />
      </NavLink>
      <button
        className="btn"
        type="button"
        onClick={() => {
          writeSession(null)
          navigate('/login', { replace: true })
        }}
      >
        Logout
      </button>
    </>
  )
}

function Overview() {
  const { db, version } = usePortalDb()
  const date = todayStr()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (getDbMode() !== 'cloud') return undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshFromCloud()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const { employees, todayAttendance, punchIns, byEmp, activityRows } = useMemo(() => {
    const employees = db.employees
    const todayAttendance = db.attendance.filter((a) => normalizeDateStr(a.date) === date)
    const punchIns = todayAttendance.filter((a) => a.punchIn)
    const byEmp = new Map()
    for (const a of todayAttendance) byEmp.set(a.empId, a)
    const activityRows = todayAttendance
      .flatMap((a) => buildMergedActivityRows(a))
      .sort((x, y) => {
        const ta = x.shift?.punchIn || ''
        const tb = y.shift?.punchIn || ''
        return ta < tb ? 1 : -1
      })
    return { employees, todayAttendance, punchIns, byEmp, activityRows }
  }, [db, date, version])

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div>
            <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Today’s punch-ins</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{date}</div>
          </div>
          <div className="row rowKeep" style={{ gap: 8 }}>
            <span className="pill">{punchIns.length} active/finished</span>
            {getDbMode() === 'cloud' ? (
              <button
                type="button"
                className="btn"
                disabled={refreshing}
                onClick={() => {
                  setRefreshing(true)
                  void refreshFromCloud().finally(() => setRefreshing(false))
                }}
              >
                {refreshing ? 'Refreshing…' : 'Refresh from cloud'}
              </button>
            ) : null}
          </div>
        </div>
        <div className="cardBody">
          {getLastSyncError() ? (
            <p className="formError" style={{ marginBottom: 12 }}>
              {getLastSyncError()}
            </p>
          ) : null}
          {punchIns.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Punch in</th>
                  <th>Punch out</th>
                  <th>Activity score</th>
                </tr>
              </thead>
              <tbody>
                {punchIns.map((a) => (
                  <tr key={`${a.empId}-${a.date}`}>
                    <td>
                      <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{a.empName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{a.empId}</div>
                    </td>
                    <td>{fmtTime(a.punchIn)}</td>
                    <td>{fmtTime(a.punchOut)}</td>
                    <td>
                      <ScoreBadge checks={a.checks} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No one punched in yet.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="cardHeaderTitle">WFH activity log (Today)</div>
            <div className="cardHeaderSub">One row per shift — punch in/out with activity checks inside</div>
          </div>
          <span className="pill">All employees</span>
        </div>
        <div className="cardBody">
          {activityRows.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Shift &amp; activity</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{r.empName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{r.empId}</div>
                    </td>
                    <td>{fmtDate(r.date)}</td>
                    <td>
                      <ShiftActivityBlock shift={r.shift} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No activity recorded today.</div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text)' }}>
            Score = (responded / total) × 100. Use &quot;Refresh from cloud&quot; on Overview for latest
            punches. Attendance history has its own Refresh button.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="card">
        <div className="cardHeader">
          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Employee activity scores (Today)</div>
          <span className="pill">{employees.length} employees</span>
        </div>
        <div className="cardBody">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Score</th>
                <th>Checks</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const a = byEmp.get(e.id)
                const { responded, total } = computeScore(a?.checks || [])
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{e.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{e.id}</div>
                    </td>
                    <td>{e.role}</td>
                    <td>
                      <ScoreBadge checks={a?.checks || []} />
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text)' }}>
                      {responded}/{total}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function CloudSyncPanel() {
  const { db, version } = usePortalDb()
  const [msg, setMsg] = useState('')
  const syncErr = getLastSyncError()
  const isCloud = getDbMode() === 'cloud'
  const localCount = db.employees.length

  if (!isCloud) return null

  return (
    <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(41, 121, 255, 0.35)' }}>
      <div className="cardHeader">
        <div className="cardHeaderTitle">Cloud sync</div>
        <span className="pill">{localCount} employees on this device</span>
      </div>
      <div className="cardBody">
        <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 12px' }}>
          Supabase is the single source of truth. All devices load from the cloud every 8 seconds and on
          real-time updates.
        </p>
        {syncErr ? (
          <p style={{ fontSize: 13, color: '#fbbf24', margin: '0 0 10px' }}>
            {syncErr}
            <br />
            Run in Supabase SQL:{' '}
            <code style={{ fontSize: 12 }}>alter table employees add column if not exists email text;</code>
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--green, #4ade80)', margin: '0 0 10px' }}>
            Last sync OK (or pending).
          </p>
        )}
        <button
          type="button"
          className="btn btnPrimary"
          onClick={async () => {
            setMsg('Uploading to cloud…')
            const result = await pushAllLocalToCloud()
            setMsg(result.message)
          }}
        >
          Upload all data to cloud
        </button>
        {msg ? <p style={{ fontSize: 13, color: 'var(--text-h)', marginTop: 10 }}>{msg}</p> : null}
      </div>
    </div>
  )
}

function Employees() {
  const { db, version } = usePortalDb()
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Engineer')
  const [password, setPassword] = useState(DEFAULT_EMPLOYEE_PASSWORD)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [editingId, setEditingId] = useState(null)

  const employees = useMemo(() => db.employees, [db, version])
  const editingEmployee = editingId ? getEmployeeById(editingId) : null

  const [saving, setSaving] = useState(false)
  const [resettingPw, setResettingPw] = useState(false)

  async function add() {
    setError('')
    const nextId = id.trim()
    const nextRole = role.trim()
    if (!nextId || !name.trim() || !password || !nextRole) {
      setError('ID, name, role, and password are required.')
      return
    }
    if (nextId.toUpperCase() === 'ADMIN' || nextId.includes('@')) {
      setError('Enter a valid employee ID (not an email).')
      return
    }
    const db = ensureDbSeeded()
    if (db.employees.some((e) => e.id.toUpperCase() === nextId.toUpperCase())) {
      setError('Employee ID already exists.')
      return
    }
    const nextEmail = email.trim()
    if (!isValidEmail(nextEmail)) {
      setError('Enter a valid work email.')
      return
    }
    if (
      nextEmail &&
      db.employees.some((e) => e.email?.toLowerCase() === nextEmail.toLowerCase())
    ) {
      setError('This email is already used by another employee.')
      return
    }
    setSaving(true)
    try {
      await addEmployee({ id: nextId, name: name.trim(), email: nextEmail, role: nextRole, password })
      setId('')
      setName('')
      setEmail('')
      setPassword(DEFAULT_EMPLOYEE_PASSWORD)
    } catch (err) {
      setError(err?.message || 'Could not add employee.')
    } finally {
      setSaving(false)
    }
  }

  async function resetAllPasswords() {
    if (!window.confirm(`Set password "${DEFAULT_EMPLOYEE_PASSWORD}" for all ${employees.length} employees?`)) return
    setResettingPw(true)
    setError('')
    setInfo('')
    try {
      const { count, password: pw } = await resetAllEmployeePasswords()
      setInfo(`Password "${pw}" set for ${count} employees (synced to cloud).`)
    } catch (err) {
      setError(err?.message || 'Could not reset passwords.')
    } finally {
      setResettingPw(false)
    }
  }

  async function del(empId) {
    await removeEmployee(empId)
    if (editingId === empId) setEditingId(null)
  }

  return (
    <div className="container">
      <CloudSyncPanel key={version} />
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div className="cardHeaderTitle">Add employee</div>
        </div>
        <div className="cardBody">
          <div className="formSections">
            <section className="formSection">
              <div className="formSectionTitle">Employee details</div>
              <div className="grid2">
                <div>
                  <div className="label">Employee ID</div>
                  <input
                    className="input"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="E1050"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <div className="label">Full name</div>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                  />
                </div>
              </div>
            </section>

            <section className="formSection">
              <div className="formSectionTitle">Login credentials</div>
              <div className="grid2">
                <div>
                  <div className="label">Work email</div>
                  <input
                    className="input"
                    type="email"
                    name="employee-work-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@zyoris.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <div className="label">Password</div>
                  <input
                    className="input"
                    type="password"
                    name="employee-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </section>

            <section className="formSection">
              <div className="formSectionTitle">Role</div>
              <RoleInput value={role} onChange={setRole} placeholder="e.g. Engineer, Designer, Intern…" />
              <div className="formHint">Type any job title — pick a suggestion or write your own</div>
            </section>

            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <button type="button" className="btn btnPrimary" onClick={add} disabled={saving}>
                {saving ? 'Saving…' : 'Add employee'}
              </button>
              {error ? <span className="formError">{error}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Employees</div>
          <div className="row rowKeep" style={{ gap: 8 }}>
            <span className="pill">{employees.length}</span>
            <button
              type="button"
              className="btn"
              disabled={resettingPw || !employees.length}
              onClick={() => void resetAllPasswords()}
            >
              {resettingPw ? 'Updating…' : `Set all passwords to ${DEFAULT_EMPLOYEE_PASSWORD}`}
            </button>
          </div>
        </div>
        <div className="cardBody">
          {info ? <p style={{ fontSize: 13, color: 'var(--text-h)', margin: '0 0 12px' }}>{info}</p> : null}
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{e.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{e.id}</div>
                    {e.email?.trim() ? (
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{e.email}</div>
                    ) : null}
                  </td>
                  <td>{e.role}</td>
                  <td>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btnPrimary" type="button" onClick={() => setEditingId(e.id)}>
                        Edit profile
                      </button>
                      <button className="btn btnDanger" type="button" onClick={() => del(e.id)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingEmployee ? (
        <EmployeeProfileEditor
          employee={editingEmployee}
          onSaved={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      ) : null}
    </div>
  )
}

function Leaves() {
  const { db, version } = usePortalDb()
  const leaves = useMemo(() => db.leaves, [db, version])
  const pending = useMemo(() => leaves.filter((l) => l.status === 'PENDING'), [leaves])

  async function decide(leaveId, status) {
    await updateLeave(leaveId, (l) => ({
      ...l,
      status,
      decidedAt: nowIso(),
      decidedBy: 'Admin',
    }))
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Pending approvals</div>
          <span className="pill">{pending.length}</span>
        </div>
        <div className="cardBody">
          {pending.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{l.empName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{l.empId}</div>
                    </td>
                    <td>{l.type}</td>
                    <td>{l.from}</td>
                    <td>{l.to}</td>
                    <td>{l.reason}</td>
                    <td className="row">
                      <button className="btn btnPrimary" onClick={() => decide(l.id, 'APPROVED')}>
                        Approve
                      </button>
                      <button className="btn btnDanger" onClick={() => decide(l.id, 'REJECTED')}>
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No pending leave requests.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>All leave requests</div>
          <span className="pill">{leaves.length}</span>
        </div>
        <div className="cardBody">
          {leaves.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{l.empName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{l.empId}</div>
                    </td>
                    <td>{l.type}</td>
                    <td>{l.from}</td>
                    <td>{l.to}</td>
                    <td>
                      <span className="pill">{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No leave requests yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AdminPortal() {
  const session = readSession()
  if (!session || session.kind !== 'admin') return <Navigate to="/login" replace />

  return (
    <PortalShell subtitle="Admin Dashboard" actions={<AdminNav />}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/leaves" element={<Leaves />} />
        <Route path="/attendance-history" element={<AdminAttendanceHistory />} />
        <Route path="/messages" element={<AdminMessagesView />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </PortalShell>
  )
}

