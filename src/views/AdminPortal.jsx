import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { PortalShell } from '../ui/PortalShell.jsx'
import {
  computeScore,
  ensureDbSeeded,
  nowIso,
  readSession,
  removeEmployee,
  todayStr,
  updateLeave,
  writeDb,
  writeSession,
} from '../state/storage.js'
import { ScoreBadge } from '../ui/ScoreBadge.jsx'

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

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
  const [refresh, setRefresh] = useState(0)
  const date = todayStr()

  // refresh exists only to force a rerender when user clicks Refresh
  // eslint-disable-next-line no-unused-vars
  const _ = refresh

  const db = ensureDbSeeded()
  const employees = db.employees
  const todayAttendance = db.attendance.filter((a) => a.date === date)

  const punchIns = todayAttendance.filter((a) => a.punchIn)

  const byEmp = new Map()
  for (const a of todayAttendance) byEmp.set(a.empId, a)

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div>
            <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Today’s punch-ins</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{date}</div>
          </div>
          <span className="pill">{punchIns.length} active/finished</span>
        </div>
        <div className="cardBody">
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
          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>WFH check log (Today)</div>
          <span className="pill">All employees</span>
        </div>
        <div className="cardBody">
          {todayAttendance.some((a) => (a.checks?.length || 0) > 0) ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {todayAttendance
                  .flatMap((a) =>
                    (a.checks || []).map((c, idx) => ({
                      key: `${a.empId}-${c.time}-${idx}`,
                      empId: a.empId,
                      empName: a.empName,
                      time: c.time,
                      responded: c.responded,
                      update: c.update,
                    })),
                  )
                  .sort((x, y) => (x.time < y.time ? 1 : -1))
                  .map((r) => (
                    <tr key={r.key}>
                      <td>
                        <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{r.empName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{r.empId}</div>
                      </td>
                      <td>{fmtTime(r.time)}</td>
                      <td>
                        <span className="pill">{r.responded ? 'Responded' : 'Missed'}</span>
                      </td>
                      <td style={{ color: r.update ? 'var(--text-h)' : 'var(--text)' }}>
                        {r.update || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No checks recorded today.</div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text)' }}>
            Note: Score = (responded / total) × 100. Green ≥80%, amber ≥50%, red below.
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setRefresh((x) => x + 1)}>
              Refresh
            </button>
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

function Employees() {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('Engineer')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  // eslint-disable-next-line no-unused-vars
  const _ = refresh
  const employees = ensureDbSeeded().employees

  function add() {
    setError('')
    const nextId = id.trim()
    if (!nextId || !name.trim() || !password) {
      setError('ID, name, and password are required.')
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
    db.employees.unshift({ id: nextId, name: name.trim(), role, password })
    writeDb(db)
    setId('')
    setName('')
    setPassword('')
    setRefresh((x) => x + 1)
  }

  function del(empId) {
    removeEmployee(empId)
    setRefresh((x) => x + 1)
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div className="cardHeaderTitle">Add employee</div>
        </div>
        <div className="cardBody">
          <div className="grid2">
            <div>
              <div className="label">Employee ID</div>
              <input className="input" value={id} onChange={(e) => setId(e.target.value)} placeholder="E1050" />
            </div>
            <div>
              <div className="label">Name</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <div className="label">Role</div>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option>Engineer</option>
                <option>QA</option>
                <option>Intern</option>
                <option>HR</option>
                <option>Manager</option>
              </select>
            </div>
            <div>
              <div className="label">Password</div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set password"
              />
            </div>
            <div className="row" style={{ gridColumn: '1 / -1', justifyContent: 'space-between' }}>
              <button className="btn btnPrimary" onClick={add}>
                Add employee
              </button>
              {error ? <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Employees</div>
          <span className="pill">{employees.length}</span>
        </div>
        <div className="cardBody">
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
                  </td>
                  <td>{e.role}</td>
                  <td>
                    <button className="btn btnDanger" onClick={() => del(e.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Leaves() {
  const [refresh, setRefresh] = useState(0)
  // eslint-disable-next-line no-unused-vars
  const _ = refresh
  const leaves = ensureDbSeeded().leaves

  function decide(leaveId, status) {
    updateLeave(leaveId, (l) => ({
      ...l,
      status,
      decidedAt: nowIso(),
      decidedBy: 'Admin',
    }))
    setRefresh((x) => x + 1)
  }

  const pending = leaves.filter((l) => l.status === 'PENDING')

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
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </PortalShell>
  )
}

