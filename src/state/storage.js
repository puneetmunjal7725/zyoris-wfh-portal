import { isSupabaseConfigured } from '../lib/supabase.js'
import {
  deleteEmployeeRemote,
  loadAllFromSupabase,
  migrateLocalDbToSupabase,
  subscribeSupabaseRealtime,
  syncAttendanceRow,
  syncEmployeeRow,
  syncLeaveRow,
} from './supabaseSync.js'

const LS_KEY = 'zyoris_portal_v1'
export const PORTAL_DB_EVENT = 'zyoris-portal-db-changed'

export function notifyPortalDbChanged() {
  window.dispatchEvent(new CustomEvent(PORTAL_DB_EVENT))
}

let dbCache = null
let unsubscribeRealtime = null
let lastSyncError = null

function countRecords(db) {
  if (!db) return 0
  return (db.employees?.length || 0) + (db.attendance?.length || 0) + (db.leaves?.length || 0)
}

function backupDbToLocal(db) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db))
  } catch {
    /* storage full — ignore */
  }
}

export function getLastSyncError() {
  return lastSyncError
}

export function readLocalBackupDb() {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return null
  return safeParse(raw, null)
}

export async function restoreBrowserBackupToCloud() {
  if (!isSupabaseConfigured()) return { ok: false, message: 'Cloud mode is not enabled.' }
  const localDb = readLocalBackupDb()
  if (!localDb || countRecords(localDb) === 0) {
    return { ok: false, message: 'No backup found in this browser.' }
  }
  dbCache = await migrateLocalDbToSupabase(localDb)
  backupDbToLocal(dbCache)
  lastSyncError = null
  notifyPortalDbChanged()
  return {
    ok: true,
    message: `Restored ${dbCache.employees.length} employees to cloud.`,
  }
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

export function getDbMode() {
  return isSupabaseConfigured() ? 'cloud' : 'local'
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
  if (dbCache) return dbCache
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return null
  return safeParse(raw, null)
}

function writeDbLocal(db) {
  localStorage.setItem(LS_KEY, JSON.stringify(db))
  dbCache = db
  notifyPortalDbChanged()
}

export function writeDb(db) {
  if (isSupabaseConfigured()) {
    dbCache = db
    notifyPortalDbChanged()
    return
  }
  writeDbLocal(db)
}

function emptyDb() {
  return { employees: [], attendance: [], leaves: [] }
}

function ensureDbSeededLocal() {
  const existing = readDb()
  if (existing) {
    dbCache = existing
    return existing
  }
  const db = emptyDb()
  writeDbLocal(db)
  return db
}

export function ensureDbSeeded() {
  if (dbCache) return dbCache
  if (isSupabaseConfigured()) return emptyDb()
  return ensureDbSeededLocal()
}

export async function initPortalDb() {
  if (unsubscribeRealtime) {
    unsubscribeRealtime()
    unsubscribeRealtime = null
  }

  if (isSupabaseConfigured()) {
    const localRaw = localStorage.getItem(LS_KEY)
    const localDb = localRaw ? safeParse(localRaw, null) : null
    const hasLocal =
      localDb &&
      ((localDb.employees?.length || 0) > 0 ||
        (localDb.attendance?.length || 0) > 0 ||
        (localDb.leaves?.length || 0) > 0)

    try {
      dbCache = await loadAllFromSupabase()
    } catch (err) {
      if (hasLocal) {
        dbCache = localDb
        backupDbToLocal(dbCache)
        lastSyncError = err?.message || 'Could not load cloud data. Using browser backup.'
      } else {
        throw err
      }
    }

    const cloudEmpty = countRecords(dbCache) === 0
    const localRicher = hasLocal && countRecords(localDb) > countRecords(dbCache)

    if (hasLocal && (cloudEmpty || localRicher)) {
      dbCache = await migrateLocalDbToSupabase(localDb)
      backupDbToLocal(dbCache)
      lastSyncError = null
    }

    unsubscribeRealtime = subscribeSupabaseRealtime(async () => {
      try {
        const next = await loadAllFromSupabase()
        const prevCount = countRecords(dbCache)
        const nextCount = countRecords(next)
        if (nextCount === 0 && prevCount > 0) return
        dbCache = next
        backupDbToLocal(dbCache)
        notifyPortalDbChanged()
      } catch {
        /* ignore transient network errors */
      }
    })

    notifyPortalDbChanged()
    return dbCache
  }

  dbCache = ensureDbSeededLocal()
  notifyPortalDbChanged()
  return dbCache
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

function persistDb(db) {
  dbCache = db
  backupDbToLocal(db)
  if (isSupabaseConfigured()) notifyPortalDbChanged()
  else notifyPortalDbChanged()
}

function runCloudSync(promise) {
  if (!isSupabaseConfigured()) return
  void promise
    .then(() => {
      lastSyncError = null
    })
    .catch((err) => {
      lastSyncError = err?.message || 'Cloud save failed. Data is kept in this browser.'
      console.error('[Zyoris cloud sync]', err)
      notifyPortalDbChanged()
    })
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
    events: [],
  }
  db.attendance.unshift(record)
  persistDb(db)
  if (isSupabaseConfigured()) runCloudSync(syncAttendanceRow(record))
  return { db, record, index: 0 }
}

export function readAttendanceRecord(empId, date = todayStr()) {
  const db = ensureDbSeeded()
  if (!db?.attendance) return null
  return db.attendance.find((a) => a.empId === empId && a.date === date) || null
}

export function updateAttendance(empId, date, updater) {
  const db = ensureDbSeeded()
  const idx = db.attendance.findIndex((a) => a.empId === empId && a.date === date)
  if (idx < 0) return null
  const next = updater({
    ...db.attendance[idx],
    checks: [...(db.attendance[idx].checks || [])],
    events: [...(db.attendance[idx].events || [])],
  })
  db.attendance[idx] = next
  persistDb(db)
  if (isSupabaseConfigured()) runCloudSync(syncAttendanceRow(next))
  return next
}

export function addLeave(leave) {
  const db = ensureDbSeeded()
  db.leaves.unshift(leave)
  persistDb(db)
  if (isSupabaseConfigured()) runCloudSync(syncLeaveRow(leave))
  return leave
}

export function listLeavesForEmployee(empId) {
  const db = ensureDbSeeded()
  return db.leaves.filter((l) => l.empId.toUpperCase() === empId.toUpperCase())
}

export function updateLeave(leaveId, updater) {
  const db = ensureDbSeeded()
  const idx = db.leaves.findIndex((l) => l.id === leaveId)
  if (idx < 0) return null
  db.leaves[idx] = updater({ ...db.leaves[idx] })
  persistDb(db)
  if (isSupabaseConfigured()) runCloudSync(syncLeaveRow(db.leaves[idx]))
  return db.leaves[idx]
}

export function defaultEmployeeFields(overrides = {}) {
  return {
    email: '',
    address: '',
    compensation: '',
    compensationType: 'Salary',
    photo: '',
    ...overrides,
  }
}

export function getEmployeeById(empId) {
  const db = ensureDbSeeded()
  return db.employees.find((e) => e.id.toUpperCase() === empId.toUpperCase()) || null
}

export function findEmployeeForLogin(empId) {
  return getEmployeeById(empId)
}

export function updateEmployee(empId, updater) {
  const db = ensureDbSeeded()
  const idx = db.employees.findIndex((e) => e.id.toUpperCase() === empId.toUpperCase())
  if (idx < 0) return null
  const next = updater({ ...db.employees[idx] })
  db.employees[idx] = next
  persistDb(db)
  if (isSupabaseConfigured()) runCloudSync(syncEmployeeRow(next))
  return next
}

export function addEmployee(emp) {
  const db = ensureDbSeeded()
  const row = { ...defaultEmployeeFields(), ...emp }
  db.employees.unshift(row)
  persistDb(db)
  if (isSupabaseConfigured()) runCloudSync(syncEmployeeRow(row))
  return row
}

export function removeEmployee(empId) {
  const db = ensureDbSeeded()
  db.employees = db.employees.filter((e) => e.id !== empId)
  db.attendance = db.attendance.filter((a) => a.empId !== empId)
  db.leaves = db.leaves.filter((l) => l.empId !== empId)
  persistDb(db)
  if (isSupabaseConfigured()) runCloudSync(deleteEmployeeRemote(empId))
  return db
}

export function listAttendanceForEmployee(empId) {
  const db = ensureDbSeeded()
  return db.attendance
    .filter((a) => a.empId.toUpperCase() === empId.toUpperCase())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}
