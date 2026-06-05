import { DEFAULT_EMPLOYEE_PASSWORD } from '../config/portal.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { normalizeDateStr } from '../utils/date.js'
import {
  addMessageReply,
  emptyCloudDb,
  fetchAttendanceRange,
  loadAllFromSupabase,
  markMessageRead,
  migrateLocalDbToSupabase,
  sendAdminMessage,
  isMessagesSchemaError,
  subscribeSupabaseRealtime,
  syncAttendanceRow,
  syncEmployeeRow,
  syncLeaveRow,
  syncNotificationRow,
} from './supabaseSync.js'

const LS_KEY = 'zyoris_portal_v1'
export const PORTAL_DB_EVENT = 'zyoris-portal-db-changed'

export function notifyPortalDbChanged() {
  window.dispatchEvent(new CustomEvent(PORTAL_DB_EVENT))
}

let dbCache = null
let unsubscribeRealtime = null
let lastSyncError = null
let cloudReady = false
let refreshTimer = null

function safeParse(json, fallback) {
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

function emptyDb() {
  return emptyCloudDb()
}

function loadLocalDb() {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return emptyDb()
  const parsed = safeParse(raw, emptyDb()) || emptyDb()
  return {
    ...emptyDb(),
    ...parsed,
    messages: parsed.messages || [],
    notifications: parsed.notifications || [],
  }
}

let lastSavedDbJson = null

function saveLocalDb(db) {
  const json = JSON.stringify(db)
  if (json === lastSavedDbJson) return
  lastSavedDbJson = json
  dbCache = db
  try {
    localStorage.setItem(LS_KEY, json)
  } catch {
    /* quota */
  }
  notifyPortalDbChanged()
}

export function getDbMode() {
  return isSupabaseConfigured() ? 'cloud' : 'local'
}

export function isCloudReady() {
  return !isSupabaseConfigured() || cloudReady
}

export function getLastSyncError() {
  return lastSyncError
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

export function ensureDbSeeded() {
  if (!dbCache) dbCache = loadLocalDb()
  return dbCache
}

async function replaceFromCloud() {
  const cloud = await loadAllFromSupabase()
  saveLocalDb(cloud)
  lastSyncError = null
  cloudReady = true
  return cloud
}

export async function refreshFromCloud() {
  if (!isSupabaseConfigured()) return ensureDbSeeded()
  try {
    return await replaceFromCloud()
  } catch (err) {
    lastSyncError = err?.message || 'Could not refresh from cloud'
    notifyPortalDbChanged()
    return ensureDbSeeded()
  }
}

export async function initPortalDb() {
  if (unsubscribeRealtime) {
    unsubscribeRealtime()
    unsubscribeRealtime = null
  }
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }

  dbCache = loadLocalDb()
  notifyPortalDbChanged()

  if (!isSupabaseConfigured()) {
    cloudReady = true
    return dbCache
  }

  try {
    const local = loadLocalDb()
    const hasLocal =
      (local.employees?.length || 0) + (local.attendance?.length || 0) + (local.leaves?.length || 0) > 0

    await replaceFromCloud()

    const cloudEmpty =
      !dbCache.employees.length && !dbCache.attendance.length && !dbCache.leaves.length
    if (hasLocal && cloudEmpty) {
      await migrateLocalDbToSupabase(local)
      await replaceFromCloud()
    }
  } catch (err) {
    lastSyncError = err?.message || 'Cloud unavailable'
    cloudReady = false
  }

  unsubscribeRealtime = subscribeSupabaseRealtime(() => {
    void refreshFromCloud()
  })

  refreshTimer = window.setInterval(() => {
    void refreshFromCloud()
  }, 8000)

  notifyPortalDbChanged()
  return dbCache
}

export async function pushAllLocalToCloud() {
  if (!isSupabaseConfigured()) return { ok: false, message: 'Cloud is not configured.' }
  const local = loadLocalDb()
  try {
    await migrateLocalDbToSupabase(local)
    await replaceFromCloud()
    return {
      ok: true,
      message: `Synced ${local.employees.length} employees, ${local.attendance.length} attendance records.`,
    }
  } catch (err) {
    lastSyncError = err?.message || 'Upload failed'
    return { ok: false, message: lastSyncError }
  }
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

function syncAttendanceWithEmployee(record) {
  const emp = getEmployeeById(record.empId)
  return syncAttendanceRow(record, { employee: emp || undefined })
}

async function cloudWrite(fn) {
  if (!isSupabaseConfigured()) return
  await fn()
  lastSyncError = null
}

export async function createNotification(n) {
  const db = ensureDbSeeded()
  db.notifications.unshift(n)
  saveLocalDb(db)
  if (isSupabaseConfigured()) {
    try {
      await syncNotificationRow(n)
    } catch (err) {
      console.error('[notification sync]', err)
    }
  }
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
  saveLocalDb(db)
  return { db, record, index: 0 }
}

export function readAttendanceRecord(empId, date = todayStr()) {
  const db = ensureDbSeeded()
  return (
    db.attendance.find((a) => a.empId === empId && normalizeDateStr(a.date) === date) || null
  )
}

/** Cloud-first: writes to Supabase then updates cache */
export async function updateAttendance(empId, date, updater) {
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

  if (isSupabaseConfigured()) {
    try {
      await syncAttendanceWithEmployee(next)
      await replaceFromCloud()
    } catch (err) {
      lastSyncError = err?.message || 'Attendance sync failed'
      db.attendance[idx] = next
      saveLocalDb(db)
      throw err
    }
  } else {
    db.attendance[idx] = next
    saveLocalDb(db)
  }

  return readAttendanceRecord(empId, date) || next
}

export async function queryAttendanceHistory({ fromDate, toDate, empId = null }) {
  if (isSupabaseConfigured()) {
    try {
      return await fetchAttendanceRange({ fromDate, toDate, empId })
    } catch {
      /* fallback local */
    }
  }
  const db = ensureDbSeeded()
  const from = normalizeDateStr(fromDate)
  const to = normalizeDateStr(toDate)
  return db.attendance.filter((a) => {
    const d = normalizeDateStr(a.date)
    if (d < from || d > to) return false
    if (empId && a.empId.toUpperCase() !== empId.toUpperCase()) return false
    return true
  })
}

export function syncEmployeeToCloud(emp) {
  if (!isSupabaseConfigured() || !emp) return Promise.resolve()
  return cloudWrite(() => syncEmployeeRow(emp)).catch((err) => {
    lastSyncError = err?.message
  })
}

export async function addLeave(leave) {
  const db = ensureDbSeeded()
  db.leaves.unshift(leave)
  saveLocalDb(db)
  if (isSupabaseConfigured()) {
    await cloudWrite(() => syncLeaveRow(leave))
    await replaceFromCloud()
    await createNotification({
      id: `N-leave-${leave.id}`,
      userKind: 'admin',
      userId: 'admin',
      type: 'LEAVE_REQUEST',
      title: `Leave request: ${leave.empName}`,
      body: `${leave.type} (${leave.from} → ${leave.to})`,
      readAt: null,
      createdAt: leave.appliedAt,
      meta: { leaveId: leave.id },
    })
  }
  return leave
}

export function listLeavesForEmployee(empId) {
  const db = ensureDbSeeded()
  return db.leaves.filter((l) => l.empId.toUpperCase() === empId.toUpperCase())
}

export async function updateLeave(leaveId, updater) {
  const db = ensureDbSeeded()
  const idx = db.leaves.findIndex((l) => l.id === leaveId)
  if (idx < 0) return null
  const prev = db.leaves[idx]
  db.leaves[idx] = updater({ ...prev })
  const updated = db.leaves[idx]
  saveLocalDb(db)

  if (isSupabaseConfigured()) {
    await cloudWrite(() => syncLeaveRow(updated))
    await replaceFromCloud()
    if (prev.status === 'PENDING' && updated.status !== 'PENDING') {
      await createNotification({
        id: `N-leave-${leaveId}-${updated.status}`,
        userKind: 'employee',
        userId: updated.empId,
        type: updated.status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        title: `Leave ${updated.status.toLowerCase()}`,
        body: `Your ${updated.type} request was ${updated.status.toLowerCase()}.`,
        readAt: null,
        createdAt: nowIso(),
        meta: { leaveId },
      })
    }
  }
  return updated
}

export function defaultEmployeeFields(overrides = {}) {
  return {
    password: DEFAULT_EMPLOYEE_PASSWORD,
    email: '',
    address: '',
    compensation: '',
    compensationType: 'Salary',
    photo: '',
    ...overrides,
  }
}

/** Set every employee password to the portal default and sync to cloud. */
export async function resetAllEmployeePasswords(password = DEFAULT_EMPLOYEE_PASSWORD) {
  const db = ensureDbSeeded()
  if (!db.employees.length) return { count: 0, password }

  for (const e of db.employees) {
    e.password = password
  }
  saveLocalDb(db)

  if (isSupabaseConfigured()) {
    for (const e of db.employees) {
      await syncEmployeeRow(e)
    }
    await replaceFromCloud()
  }

  return { count: db.employees.length, password }
}

export function getEmployeeById(empId) {
  const db = ensureDbSeeded()
  return db.employees.find((e) => e.id.toUpperCase() === empId.toUpperCase()) || null
}

export function findEmployeeForLogin(empId) {
  return getEmployeeById(empId)
}

export async function updateEmployee(empId, updater) {
  const db = ensureDbSeeded()
  const idx = db.employees.findIndex((e) => e.id.toUpperCase() === empId.toUpperCase())
  if (idx < 0) return null
  const next = updater({ ...db.employees[idx] })
  db.employees[idx] = next
  saveLocalDb(db)
  if (isSupabaseConfigured()) {
    await cloudWrite(() => syncEmployeeRow(next))
    await replaceFromCloud()
  }
  return next
}

export async function addEmployee(emp) {
  const db = ensureDbSeeded()
  const row = { ...defaultEmployeeFields(), ...emp }
  db.employees.unshift(row)
  saveLocalDb(db)
  if (isSupabaseConfigured()) {
    await cloudWrite(() => syncEmployeeRow(row))
    await replaceFromCloud()
  }
  return row
}

export async function removeEmployee(empId) {
  const db = ensureDbSeeded()
  db.employees = db.employees.filter((e) => e.id !== empId)
  db.attendance = db.attendance.filter((a) => a.empId !== empId)
  db.leaves = db.leaves.filter((l) => l.empId !== empId)
  saveLocalDb(db)
  if (isSupabaseConfigured()) {
    const { deleteEmployeeRemote } = await import('./supabaseSync.js')
    await cloudWrite(() => deleteEmployeeRemote(empId))
    await replaceFromCloud()
  }
  return db
}

export function listAttendanceForEmployee(empId) {
  const db = ensureDbSeeded()
  return db.attendance
    .filter((a) => a.empId.toUpperCase() === empId.toUpperCase())
    .sort((a, b) => (normalizeDateStr(a.date) < normalizeDateStr(b.date) ? 1 : -1))
}

export function listMessagesForEmployee(empId) {
  const db = ensureDbSeeded()
  return db.messages.filter((m) =>
    m.recipients?.some((r) => r.empId.toUpperCase() === empId.toUpperCase()),
  )
}

export function unreadMessageCount(empId) {
  return listMessagesForEmployee(empId).filter((m) => {
    const r = m.recipients?.find((x) => x.empId.toUpperCase() === empId.toUpperCase())
    return r && !r.readAt
  }).length
}

export function listNotifications(userKind, userId) {
  const db = ensureDbSeeded()
  return db.notifications.filter(
    (n) => n.userKind === userKind && n.userId.toUpperCase() === userId.toUpperCase(),
  )
}

export function unreadNotificationCount(userKind, userId) {
  return listNotifications(userKind, userId).filter((n) => !n.readAt).length
}

export async function adminSendMessage({ title, body, priority, recipientEmpIds }) {
  const message = {
    id: `MSG-${Date.now()}`,
    title: title.trim(),
    body: body.trim(),
    priority,
    scope: recipientEmpIds.length === ensureDbSeeded().employees.length ? 'all' : 'selected',
    sender: 'Admin',
    createdAt: nowIso(),
    recipients: recipientEmpIds.map((empId) => ({ empId, readAt: null })),
    replies: [],
  }

  if (isSupabaseConfigured()) {
    try {
      await sendAdminMessage({ message, recipientEmpIds })
      await replaceFromCloud()
    } catch (err) {
      if (isMessagesSchemaError(err)) {
        const db = ensureDbSeeded()
        db.messages.unshift(message)
        for (const empId of recipientEmpIds) {
          if (priority === 'Normal') continue
          db.notifications.unshift({
            id: `N-msg-${message.id}-${empId}`,
            userKind: 'employee',
            userId: empId,
            type: 'ADMIN_MESSAGE',
            title: message.title,
            body: message.body.slice(0, 200),
            readAt: null,
            createdAt: message.createdAt,
            meta: { messageId: message.id, priority },
          })
        }
        saveLocalDb(db)
        const setupErr = new Error(
          'Messaging tables are not set up in Supabase yet. Message saved on this device only. Run supabase/migration-messages-only.sql in the SQL Editor (see banner above), then send again.',
        )
        setupErr.code = 'MESSAGES_SCHEMA_MISSING'
        throw setupErr
      }
      throw err
    }
  } else {
    const db = ensureDbSeeded()
    db.messages.unshift(message)
    saveLocalDb(db)
  }
  return message
}

export async function employeeMarkMessageRead(messageId, empId) {
  if (isSupabaseConfigured()) await markMessageRead(messageId, empId)
  const db = ensureDbSeeded()
  const msg = db.messages.find((m) => m.id === messageId)
  if (msg) {
    const r = msg.recipients?.find((x) => x.empId.toUpperCase() === empId.toUpperCase())
    if (r) r.readAt = nowIso()
    saveLocalDb(db)
  }
  await replaceFromCloud()
}

export async function employeeReplyToMessage({ messageId, empId, empName, body }) {
  const reply = {
    id: `R-${Date.now()}`,
    messageId,
    empId,
    empName,
    body: body.trim(),
    createdAt: nowIso(),
  }
  if (isSupabaseConfigured()) {
    await addMessageReply(reply)
    await replaceFromCloud()
  } else {
    const db = ensureDbSeeded()
    const msg = db.messages.find((m) => m.id === messageId)
    if (msg) {
      msg.replies = msg.replies || []
      msg.replies.push(reply)
      saveLocalDb(db)
    }
  }
  return reply
}

export async function markNotificationRead(notifId) {
  const db = ensureDbSeeded()
  const n = db.notifications.find((x) => x.id === notifId)
  if (n) {
    n.readAt = nowIso()
    saveLocalDb(db)
    if (isSupabaseConfigured()) await syncNotificationRow(n)
  }
}

export async function notifyPunch(empId, empName, kind) {
  await createNotification({
    id: `N-punch-${empId}-${todayStr()}-${kind}-${Date.now()}`,
    userKind: 'admin',
    userId: 'admin',
    type: kind === 'in' ? 'PUNCH_IN' : 'PUNCH_OUT',
    title: `${empName} punched ${kind}`,
    body: `${empId} · ${todayStr()}`,
    readAt: null,
    createdAt: nowIso(),
    meta: { empId },
  })
}
