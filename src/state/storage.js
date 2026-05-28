const LS_KEY = 'zyoris_portal_v1'

function safeParse(json, fallback) {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

export function todayStr(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function nowIso(d = new Date()) {
  return d.toISOString()
}

export function readDb() {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return null
  return safeParse(raw, null)
}

export function writeDb(db) {
  localStorage.setItem(LS_KEY, JSON.stringify(db))
}

export function ensureDbSeeded() {
  const existing = readDb()
  if (existing) return existing

  const db = {
    employees: [],
    attendance: [],
    leaves: [],
  }
  writeDb(db)
  return db
}

export function readSession() {
  const raw = localStorage.getItem('zyoris_session_v1')
  return raw ? safeParse(raw, null) : null
}

export function writeSession(session) {
  if (!session) localStorage.removeItem('zyoris_session_v1')
  else localStorage.setItem('zyoris_session_v1', JSON.stringify(session))
}

export function computeScore(checks) {
  const total = checks?.length || 0
  if (!total) return { score: 0, responded: 0, total: 0 }
  const responded = checks.filter((c) => c.responded).length
  return { score: Math.round((responded / total) * 100), responded, total }
}

export function scoreTone(score) {
  if (score >= 80) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}

export function upsertAttendanceForToday({ empId, empName }) {
  const db = ensureDbSeeded()
  const date = todayStr()
  const idx = db.attendance.findIndex((a) => a.empId === empId && a.date === date)
  if (idx >= 0) return { db, record: db.attendance[idx], index: idx }

  const record = {
    empId,
    empName,
    date,
    punchIn: null,
    punchOut: null,
    tasks: '',
    plan: '',
    blocker: '',
    checks: [],
  }
  db.attendance.unshift(record)
  writeDb(db)
  return { db, record, index: 0 }
}

export function readAttendanceRecord(empId, date = todayStr()) {
  const db = readDb()
  if (!db?.attendance) return null
  return db.attendance.find((a) => a.empId === empId && a.date === date) || null
}

export function updateAttendance(empId, date, updater) {
  const db = ensureDbSeeded()
  const idx = db.attendance.findIndex((a) => a.empId === empId && a.date === date)
  if (idx < 0) return null
  const next = updater({ ...db.attendance[idx] })
  db.attendance[idx] = next
  writeDb(db)
  return next
}

export function addLeave(leave) {
  const db = ensureDbSeeded()
  db.leaves.unshift(leave)
  writeDb(db)
  return leave
}

export function updateLeave(leaveId, updater) {
  const db = ensureDbSeeded()
  const idx = db.leaves.findIndex((l) => l.id === leaveId)
  if (idx < 0) return null
  db.leaves[idx] = updater({ ...db.leaves[idx] })
  writeDb(db)
  return db.leaves[idx]
}

export function addEmployee(emp) {
  const db = ensureDbSeeded()
  db.employees.unshift(emp)
  writeDb(db)
  return emp
}

export function removeEmployee(empId) {
  const db = ensureDbSeeded()
  db.employees = db.employees.filter((e) => e.id !== empId)
  writeDb(db)
  return db
}

