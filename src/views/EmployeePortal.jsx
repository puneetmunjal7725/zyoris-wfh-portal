import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { PortalShell } from '../ui/PortalShell.jsx'
import {
  ensureDbSeeded,
  nowIso,
  readSession,
  todayStr,
  updateAttendance,
  upsertAttendanceForToday,
  writeDb,
  writeSession,
} from '../state/storage.js'
import { appendAttendanceEvent } from '../state/activityLog.js'
import { ScoreBadge } from '../ui/ScoreBadge.jsx'
import { WfhActivityLog } from '../ui/WfhActivityLog.jsx'

const DEMO_CHECK_MS_MIN = 3 * 60 * 1000
const DEMO_CHECK_MS_MAX = 5 * 60 * 1000
const PROD_CHECK_MS_MIN = 45 * 60 * 1000
const PROD_CHECK_MS_MAX = 90 * 60 * 1000
const FIRST_CHECK_MS = 2 * 60 * 1000
const USE_DEMO_TIMINGS = false

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function EmployeeNav() {
  const navigate = useNavigate()
  const linkClass = ({ isActive }) => `btn${isActive ? ' navLinkActive' : ''}`

  return (
    <>
      <NavLink className={linkClass} to="/employee" end>
        Attendance
      </NavLink>
      <NavLink className={linkClass} to="/employee/leaves">
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

function ActivityCheckModal({ open, secondsLeft, value, onChange, onSubmit }) {
  if (!open) return null
  return (
    <div className="modalOverlay">
      <div className="modal">
        <div className="cardHeader">
          <div>
            <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>
              Activity Check (WFH Proof)
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              What are you working on right now? Reply within <b>{secondsLeft}s</b>.
            </div>
          </div>
          <span className="pill">3:00 countdown</span>
        </div>
        <div className="cardBody">
          <div className="label">Update (min 5 characters)</div>
          <textarea
            className="textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Example: fixing login bug, writing tests, reviewing PR..."
          />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>
              Tip: keep it short but specific.
            </span>
            <button className="btn btnPrimary" onClick={onSubmit} disabled={value.trim().length < 5}>
              Submit update
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AttendanceView({ session }) {
  const [tick, setTick] = useState(0)
  const [punchOutTasks, setPunchOutTasks] = useState('')
  const [punchOutPlan, setPunchOutPlan] = useState('')
  const [punchOutBlocker, setPunchOutBlocker] = useState('')
  const [error, setError] = useState('')

  const [checkOpen, setCheckOpen] = useState(false)
  const [checkSeconds, setCheckSeconds] = useState(180)
  const [checkText, setCheckText] = useState('')
  const checkTimerRef = useRef(null)
  const nextCheckTimeoutRef = useRef(null)
  const checkActiveRef = useRef(false)
  const shiftActiveRef = useRef(false)

  const date = todayStr()
  const getTodayRecord = useMemo(
    () => () => {
      const db = ensureDbSeeded()
      const existing = db.attendance.find((a) => a.empId === session.id && a.date === date)
      if (existing) return existing
      return upsertAttendanceForToday({ empId: session.id, empName: session.name }).record
    },
    [date, session.id, session.name],
  )
  const [current, setCurrent] = useState(() => getTodayRecord())

  function syncCurrent() {
    setCurrent(getTodayRecord())
  }

  const isActiveShift = Boolean(current.punchIn && !current.punchOut)

  useEffect(() => {
    // Avoid synchronous setState in effect body (eslint react-hooks/set-state-in-effect)
    setTimeout(() => setTick(Date.now()), 0)
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    syncCurrent()
  }, [getTodayRecord])

  function scheduleNextCheck({ first = false } = {}) {
    const min = USE_DEMO_TIMINGS ? DEMO_CHECK_MS_MIN : PROD_CHECK_MS_MIN
    const max = USE_DEMO_TIMINGS ? DEMO_CHECK_MS_MAX : PROD_CHECK_MS_MAX
    const delay = first ? FIRST_CHECK_MS : randBetween(min, max)
    window.clearTimeout(nextCheckTimeoutRef.current)
    nextCheckTimeoutRef.current = window.setTimeout(() => {
      openCheck()
    }, delay)
  }

  function openCheck() {
    if (checkActiveRef.current) return
    checkActiveRef.current = true
    setCheckText('')
    setCheckSeconds(180)
    setCheckOpen(true)

    // Add check entry immediately; will be marked responded on submit
    const at = nowIso()
    updateAttendance(session.id, date, (a) => {
      const checks = Array.isArray(a.checks) ? a.checks.slice() : []
      checks.push({ time: at, responded: false, update: '' })
      let next = { ...a, checks }
      next = appendAttendanceEvent(next, {
        type: 'WFH_CHECK',
        time: at,
        status: 'Pending',
        detail: 'Waiting for your work update',
      })
      return next
    })
    syncCurrent()

    window.clearInterval(checkTimerRef.current)
    checkTimerRef.current = window.setInterval(() => {
      setCheckSeconds((s) => {
        if (s <= 1) {
          setCheckOpen(false)
          window.clearInterval(checkTimerRef.current)
          checkTimerRef.current = null
          checkActiveRef.current = false
          updateAttendance(session.id, date, (a) => {
            const checks = Array.isArray(a.checks) ? a.checks.slice() : []
            let missedTime = null
            for (let i = checks.length - 1; i >= 0; i--) {
              if (!checks[i].responded && !checks[i].update) {
                missedTime = checks[i].time
                break
              }
            }
            if (!missedTime) return a
            let next = { ...a, checks }
            const events = Array.isArray(next.events) ? next.events.slice() : []
            const idx = events.findIndex(
              (e) => e.type === 'WFH_CHECK' && e.time === missedTime && e.status === 'Pending',
            )
            if (idx >= 0) {
              events[idx] = { ...events[idx], status: 'Missed', detail: 'No response in time' }
              next = { ...next, events }
            } else {
              next = appendAttendanceEvent(next, {
                type: 'WFH_CHECK',
                time: missedTime,
                status: 'Missed',
                detail: 'No response in time',
              })
            }
            return next
          })
          if (shiftActiveRef.current) scheduleNextCheck()
          syncCurrent()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  function closeCheckAndScheduleNext() {
    setCheckOpen(false)
    window.clearInterval(checkTimerRef.current)
    checkTimerRef.current = null
    checkActiveRef.current = false
    if (isActiveShift) scheduleNextCheck()
  }

  useEffect(() => {
    if (!isActiveShift) {
      window.clearTimeout(nextCheckTimeoutRef.current)
      window.clearInterval(checkTimerRef.current)
      checkActiveRef.current = false
      shiftActiveRef.current = false
      return
    }
    shiftActiveRef.current = true
    scheduleNextCheck({ first: true })
    return () => {
      window.clearTimeout(nextCheckTimeoutRef.current)
      window.clearInterval(checkTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActiveShift])

  function onSubmitCheck() {
    const txt = checkText.trim()
    if (txt.length < 5) return

    const updated = updateAttendance(session.id, date, (a) => {
      const checks = Array.isArray(a.checks) ? a.checks.slice() : []
      let matchedTime = nowIso()
      for (let i = checks.length - 1; i >= 0; i--) {
        if (!checks[i].responded && !checks[i].update) {
          checks[i] = { ...checks[i], responded: true, update: txt }
          matchedTime = checks[i].time
          break
        }
      }
      let next = { ...a, checks }
      const events = Array.isArray(next.events) ? next.events.slice() : []
      const pendingIdx = events.findIndex(
        (e) => e.type === 'WFH_CHECK' && e.time === matchedTime && e.status === 'Pending',
      )
      if (pendingIdx >= 0) {
        events[pendingIdx] = {
          ...events[pendingIdx],
          status: 'Responded',
          detail: txt,
        }
        next = { ...next, events }
      } else {
        next = appendAttendanceEvent(next, {
          type: 'WFH_CHECK',
          time: matchedTime,
          status: 'Responded',
          detail: txt,
        })
      }
      return next
    })

    if (!updated) return
    syncCurrent()
    closeCheckAndScheduleNext()
  }

  function punchIn() {
    setError('')
    const db = ensureDbSeeded()
    const { record: r } = upsertAttendanceForToday({ empId: session.id, empName: session.name })
    if (r.punchIn && !r.punchOut) {
      setError('You are already punched in.')
      return
    }
    const at = nowIso()
    const next = updateAttendance(session.id, date, (a) => {
      let nextRecord = { ...a, punchIn: at, punchOut: null }
      return appendAttendanceEvent(nextRecord, {
        type: 'PUNCH_IN',
        time: at,
        status: 'Done',
        detail: 'Work session started',
      })
    })
    if (!next) {
      // if record wasn't found (shouldn't happen), force insert by rewriting db from upsert
      writeDb(db)
    }
    syncCurrent()
  }

  function punchOut() {
    setError('')
    const tasks = punchOutTasks.trim()
    if (tasks.length < 1) {
      setError('Tasks completed today is required to punch out.')
      return
    }
    // close any open check UI cleanly
    window.clearTimeout(nextCheckTimeoutRef.current)
    window.clearInterval(checkTimerRef.current)
    checkTimerRef.current = null
    checkActiveRef.current = false
    shiftActiveRef.current = false
    setCheckOpen(false)
    const at = nowIso()
    const plan = punchOutPlan.trim()
    const blocker = punchOutBlocker.trim()
    const detailParts = [`Tasks completed: ${tasks}`]
    if (plan) detailParts.push(`Plan for tomorrow: ${plan}`)
    if (blocker) detailParts.push(`Blockers: ${blocker}`)

    const next = updateAttendance(session.id, date, (a) => {
      let nextRecord = {
        ...a,
        punchOut: at,
        tasks,
        plan,
        blocker,
      }
      return appendAttendanceEvent(nextRecord, {
        type: 'PUNCH_OUT',
        time: at,
        status: 'Done',
        detail: detailParts.join('\n'),
      })
    })
    if (!next) return
    syncCurrent()
  }

  const liveClock = new Date(tick).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="container">
      <ActivityCheckModal
        open={checkOpen}
        secondsLeft={checkSeconds}
        value={checkText}
        onChange={setCheckText}
        onSubmit={onSubmitCheck}
      />

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div>
            <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Today</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{date}</div>
          </div>
          <div className="row">
            <span className="pill">Live clock: {liveClock}</span>
            <ScoreBadge checks={current.checks} />
          </div>
        </div>
        <div className="cardBody">
          <div className="grid2">
            <div className="card" style={{ boxShadow: 'none' }}>
              <div className="cardBody">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="label">Punch In</div>
                    <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{fmtTime(current.punchIn)}</div>
                  </div>
                  <button className="btn btnPrimary" onClick={punchIn} disabled={isActiveShift}>
                    Punch In
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ boxShadow: 'none' }}>
              <div className="cardBody">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="label">Punch Out</div>
                    <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{fmtTime(current.punchOut)}</div>
                  </div>
                  <button className="btn btnDanger" onClick={punchOut} disabled={!isActiveShift}>
                    Punch Out
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18 }} className="card">
            <div className="cardHeader">
              <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Punch-out details</div>
              <span className="pill">Tasks required</span>
            </div>
            <div className="cardBody">
              <div className="grid2">
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="label">Tasks completed today (required)</div>
                  <textarea
                    className="textarea"
                    value={punchOutTasks}
                    onChange={(e) => setPunchOutTasks(e.target.value)}
                    placeholder="What did you complete today?"
                  />
                </div>
                <div>
                  <div className="label">Plan for tomorrow</div>
                  <textarea
                    className="textarea"
                    value={punchOutPlan}
                    onChange={(e) => setPunchOutPlan(e.target.value)}
                    placeholder="What will you work on tomorrow?"
                  />
                </div>
                <div>
                  <div className="label">Any blockers</div>
                  <textarea
                    className="textarea"
                    value={punchOutBlocker}
                    onChange={(e) => setPunchOutBlocker(e.target.value)}
                    placeholder="Any blockers you faced?"
                  />
                </div>
              </div>
              {error ? <div style={{ color: '#ef4444', marginTop: 10, fontSize: 13 }}>{error}</div> : null}
            </div>
          </div>
        </div>
      </div>

      <WfhActivityLog record={current} />
    </div>
  )
}

function LeavesView({ session }) {
  const [type, setType] = useState('Sick Leave')
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  // eslint-disable-next-line no-unused-vars
  const _ = refresh

  const leaves = useMemo(() => {
    const db = ensureDbSeeded()
    return db.leaves.filter((l) => l.empId === session.id)
  }, [session.id])

  function apply() {
    setError('')
    if (!reason.trim()) {
      setError('Reason is required.')
      return
    }
    const db = ensureDbSeeded()
    db.leaves.unshift({
      id: `L-${Date.now()}`,
      empId: session.id,
      empName: session.name,
      type,
      from,
      to,
      reason: reason.trim(),
      status: 'PENDING',
      appliedAt: nowIso(),
    })
    writeDb(db)
    setReason('')
    setRefresh((x) => x + 1)
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Apply for Leave</div>
          <span className="pill">Admin approval required</span>
        </div>
        <div className="cardBody">
          <div className="grid2">
            <div>
              <div className="label">Type</div>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                <option>Sick Leave</option>
                <option>Casual Leave</option>
                <option>Emergency Leave</option>
                <option>Half Day</option>
                <option>Intern Leave</option>
              </select>
            </div>
            <div />
            <div>
              <div className="label">From</div>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <div className="label">To</div>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="label">Reason</div>
              <textarea
                className="textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need leave?"
              />
            </div>
            <div className="row" style={{ gridColumn: '1 / -1', justifyContent: 'space-between' }}>
              <button className="btn btnPrimary" onClick={apply}>
                Submit leave request
              </button>
              {error ? <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>My Leave Requests</div>
          <span className="pill">{leaves.length}</span>
        </div>
        <div className="cardBody">
          {leaves.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>{l.type}</td>
                    <td>{l.from}</td>
                    <td>{l.to}</td>
                    <td>
                      <span className="pill">{l.status}</span>
                    </td>
                    <td>{l.reason}</td>
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

export function EmployeePortal() {
  const session = readSession()
  const navigate = useNavigate()
  useEffect(() => {
    if (!session || session.kind !== 'employee') navigate('/login', { replace: true })
  }, [navigate, session])
  if (!session || session.kind !== 'employee') return <Navigate to="/login" replace />

  return (
    <PortalShell
      subtitle={`${session.name} · ${session.id} · ${session.role}`}
      actions={<EmployeeNav />}
    >
      <Routes>
        <Route path="/" element={<AttendanceView session={session} />} />
        <Route path="/leaves" element={<LeavesView session={session} />} />
        <Route path="*" element={<Navigate to="/employee" replace />} />
      </Routes>
    </PortalShell>
  )
}

