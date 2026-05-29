import { isSupabaseConfigured } from '../lib/supabase.js'
import { normalizeDateStr } from '../utils/date.js'
import { countRecords, mergeDatabases, mergeForAdminView } from './mergeDb.js'
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
let syncInFlight = false

function safeParse(json, fallback) {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

function emptyDb() {
  return { employees: [], attendance: [], leaves: [] }
}

/** Always read from browser storage first — never show blank while cloud loads. */
export function loadLocalDb() {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return emptyDb()
  return safeParse(raw, emptyDb()) || emptyDb()
}

function saveLocalDb(db) {
  dbCache = db
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db))
  } catch {
    /* quota */
  }
  notifyPortalDbChanged()
}

export function getDbMode() {
  return isSupabaseConfigured() ? 'cloud' : 'local'
}

export function getLastSyncError() {
  return lastSyncError
}

export function readLocalBackupDb() {
  return loadLocalDb()
}

export async function pushAllLocalToCloud() {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Cloud is not configured.' }
  }
  const local = loadLocalDb()
  if (countRecords(local) === 0) {
    return { ok: false, message: 'No data in this browser to upload.' }
  }
  syncInFlight = true
  try {
    await migrateLocalDbToSupabase(local)
    lastSyncError = null
    return {
      ok: true,
      message: `Uploaded ${local.employees.length} employees, ${local.attendance.length} attendance days to cloud.`,
    }
  } catch (err) {
    lastSyncError = err?.message || 'Upload failed'
    return { ok: false, message: lastSyncError }
  } finally {
    syncInFlight = false
    notifyPortalDbChanged()
  }
}

export async function restoreBrowserBackupToCloud() {
  return pushAllLocalToCloud()
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
  return dbCache || loadLocalDb()
}

export function writeDb(db) {
  saveLocalDb(db)
}

export function ensureDbSeeded() {
  if (!dbCache) dbCache = loadLocalDb()
  return dbCache
}

async function pullCloudAndMerge({ adminView = false } = {}) {
  if (!isSupabaseConfigured() || (syncInFlight && !adminView)) return dbCache || loadLocalDb()
  const local = loadLocalDb()
  let cloud
  try {
    cloud = await loadAllFromSupabase()
  } catch (err) {
    lastSyncError = err?.message || 'Could not load cloud'
    notifyPortalDbChanged()
    return local
  }

  if (countRecords(cloud) === 0 && countRecords(local) > 0 && !adminView) {
    return local
  }

  const merged = adminView ? mergeForAdminView(local, cloud) : mergeDatabases(local, cloud)
  saveLocalDb(merged)
  lastSyncError = null
  return merged
}

/** Admin: fetch latest punches from Supabase (call on overview + every few seconds). */
export async function refreshFromCloud() {
  if (!isSupabaseConfigured()) return ensureDbSeeded()
  return pullCloudAndMerge({ adminView: true })
}

export async function initPortalDb() {
  if (unsubscribeRealtime) {
    unsubscribeRealtime()
    unsubscribeRealtime = null
  }

  dbCache = loadLocalDb()
  notifyPortalDbChanged()

  if (!isSupabaseConfigured()) {
    return dbCache
  }

  try {
    const cloud = await loadAllFromSupabase()
    const merged = mergeDatabases(dbCache, cloud)
    saveLocalDb(merged)

    if (countRecords(cloud) < countRecords(merged)) {
      syncInFlight = true
      try {
        await migrateLocalDbToSupabase(merged)
        lastSyncError = null
      } catch (err) {
        lastSyncError = err?.message || 'Cloud upload failed — data safe on this device.'
      } finally {
        syncInFlight = false
      }
    }
  } catch (err) {
    lastSyncError = err?.message || 'Cloud unavailable — using data saved on this device.'
  }

  unsubscribeRealtime = subscribeSupabaseRealtime(() => {
    void pullCloudAndMerge({ adminView: false })
  })

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
  saveLocalDb(db)
}

function runCloudSync(promise) {
  if (!isSupabaseConfigured()) return
  void promise
    .then(() => {
      lastSyncError = null
      notifyPortalDbChanged()
    })
    .catch((err) => {
      const msg = err?.message || String(err)
      lastSyncError = msg.includes('foreign key')
        ? 'Cloud sync failed: employee not on server. Admin → Upload all data to cloud, then punch again.'
        : msg || 'Cloud sync failed. Data is saved on this device.'
      console.error('[Zyoris cloud sync]', err)
      notifyPortalDbChanged()
    })
}

export function upsertAttendanceForToday({ empId, empName }) {
  const db = ensureDbSeeded()
  const date = todayStr()
  const idx = db.attendance.findIndex(
    (a) => a.empId === empId && normalizeDateStr(a.date) === date,
  )
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
  if (isSupabaseConfigured()) runCloudSync(syncAttendanceWithEmployee(record))
  return { db, record, index: 0 }
}

export function readAttendanceRecord(empId, date = todayStr()) {
  const db = ensureDbSeeded()
  return (
    db.attendance.find((a) => a.empId === empId && normalizeDateStr(a.date) === date) || null
  )
}

export function updateAttendance(empId, date, updater) {
  const db = ensureDbSeeded()
  const idx = db.attendance.findIndex(
    (a) => a.empId === empId && normalizeDateStr(a.date) === date,
  )
  if (idx < 0) return null
  const next = updater({
    ...db.attendance[idx],
    checks: [...(db.attendance[idx].checks || [])],
    events: [...(db.attendance[idx].events || [])],
  })
  db.attendance[idx] = next
  persistDb(db)
  if (isSupabaseConfigured()) runCloudSync(syncAttendanceWithEmployee(next))
  return next
}

export function syncEmployeeToCloud(emp) {
  if (!isSupabaseConfigured() || !emp) return
  runCloudSync(syncEmployeeRow(emp))
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

function syncAttendanceWithEmployee(record) {
  const emp = getEmployeeById(record.empId)
  return syncAttendanceRow(record, { employee: emp || undefined })
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
