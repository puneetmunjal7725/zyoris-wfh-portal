import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { normalizeDateStr } from '../utils/date.js'

function employeeFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    password: r.password,
    email: r.email ?? '',
    address: r.address ?? '',
    compensation: r.compensation ?? '',
    compensationType: r.compensation_type ?? 'Salary',
    photo: r.photo ?? '',
  }
}

function employeeToRow(e) {
  return {
    id: e.id,
    name: e.name,
    role: e.role,
    password: e.password,
    email: e.email ?? '',
    address: e.address ?? '',
    compensation: e.compensation ?? '',
    compensation_type: e.compensationType ?? 'Salary',
    photo: e.photo ?? '',
  }
}

function attendanceFromRow(r) {
  return {
    empId: r.emp_id,
    empName: r.emp_name,
    date: normalizeDateStr(r.date),
    punchIn: r.punch_in,
    punchOut: r.punch_out,
    tasks: r.tasks ?? '',
    plan: r.plan ?? '',
    blocker: r.blocker ?? '',
    checks: Array.isArray(r.checks) ? r.checks : [],
    events: Array.isArray(r.events) ? r.events : [],
  }
}

function attendanceToRow(a) {
  return {
    emp_id: a.empId,
    emp_name: a.empName,
    date: normalizeDateStr(a.date),
    punch_in: a.punchIn,
    punch_out: a.punchOut,
    tasks: a.tasks ?? '',
    plan: a.plan ?? '',
    blocker: a.blocker ?? '',
    checks: a.checks ?? [],
    events: a.events ?? [],
  }
}

function leaveFromRow(r) {
  return {
    id: r.id,
    empId: r.emp_id,
    empName: r.emp_name,
    type: r.type,
    from: normalizeDateStr(r.from_date),
    to: normalizeDateStr(r.to_date),
    reason: r.reason ?? '',
    status: r.status,
    appliedAt: r.applied_at,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
  }
}

function leaveToRow(l) {
  return {
    id: l.id,
    emp_id: l.empId,
    emp_name: l.empName,
    type: l.type,
    from_date: l.from,
    to_date: l.to,
    reason: l.reason ?? '',
    status: l.status,
    applied_at: l.appliedAt,
    decided_at: l.decidedAt ?? null,
    decided_by: l.decidedBy ?? null,
  }
}

function messageFromRow(r, recipients = [], replies = []) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    priority: r.priority ?? 'Normal',
    scope: r.scope ?? 'all',
    sender: r.sender ?? 'Admin',
    createdAt: r.created_at,
    recipients,
    replies,
  }
}

function notificationFromRow(r) {
  return {
    id: r.id,
    userKind: r.user_kind,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    readAt: r.read_at,
    createdAt: r.created_at,
    meta: r.meta ?? {},
  }
}

function notificationToRow(n) {
  return {
    id: n.id,
    user_kind: n.userKind,
    user_id: n.userId,
    type: n.type,
    title: n.title,
    body: n.body,
    read_at: n.readAt ?? null,
    created_at: n.createdAt,
    meta: n.meta ?? {},
  }
}

export function isMessagesSchemaError(error) {
  const msg = String(error?.message || error || '')
  return /messages.*schema cache|relation.*messages|does not exist|not find the table/i.test(msg)
}

/** True when messages table is visible to the API (real select, not HEAD). */
export async function probeMessagesTable() {
  if (!supabase) return false
  const { error } = await supabase.from('messages').select('id').limit(1)
  return !error
}

export function emptyCloudDb() {
  return {
    employees: [],
    attendance: [],
    leaves: [],
    messages: [],
    notifications: [],
  }
}

export async function loadAllFromSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')

  const [empRes, attRes, leaveRes, msgRes, recipRes, replyRes, notifRes] = await Promise.all([
    supabase.from('employees').select('*'),
    supabase.from('attendance').select('*').order('date', { ascending: false }).limit(500),
    supabase.from('leaves').select('*').order('applied_at', { ascending: false }),
    supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('message_recipients').select('*'),
    supabase.from('message_replies').select('*').order('created_at', { ascending: true }),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(500),
  ])

  if (empRes.error) throw empRes.error
  if (attRes.error) throw attRes.error
  if (leaveRes.error) throw leaveRes.error

  const messages = (msgRes.error ? [] : msgRes.data || []).map((m) => {
    const recipients = (recipRes.error ? [] : recipRes.data || [])
      .filter((r) => r.message_id === m.id)
      .map((r) => ({ empId: r.emp_id, readAt: r.read_at }))
    const replies = (replyRes.error ? [] : replyRes.data || [])
      .filter((r) => r.message_id === m.id)
      .map((r) => ({
        id: r.id,
        empId: r.emp_id,
        empName: r.emp_name,
        body: r.body,
        createdAt: r.created_at,
      }))
    return messageFromRow(m, recipients, replies)
  })

  const notifications = notifRes.error
    ? []
    : (notifRes.data || []).map(notificationFromRow)

  return {
    employees: (empRes.data || []).map(employeeFromRow),
    attendance: (attRes.data || []).map(attendanceFromRow),
    leaves: (leaveRes.data || []).map(leaveFromRow),
    messages,
    notifications,
  }
}

export async function fetchAttendanceRange({ fromDate, toDate, empId = null }) {
  if (!supabase) return []
  let q = supabase
    .from('attendance')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: false })
  if (empId) q = q.eq('emp_id', empId)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(attendanceFromRow)
}

export function subscribeSupabaseRealtime(onChange) {
  if (!supabase) return () => {}

  let timer = null
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => onChange(), 200)
  }

  const tables = [
    'employees',
    'attendance',
    'leaves',
    'messages',
    'message_recipients',
    'message_replies',
    'notifications',
  ]

  const channel = supabase.channel('zyoris-portal-v2')
  for (const table of tables) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
  }
  channel.subscribe()

  return () => {
    window.clearTimeout(timer)
    void supabase.removeChannel(channel)
  }
}

export async function syncEmployeeRow(employee) {
  if (!supabase) return
  let { error } = await supabase.from('employees').upsert(employeeToRow(employee), { onConflict: 'id' })
  if (error && /email|column/i.test(String(error.message))) {
    const row = employeeToRow(employee)
    delete row.email
    const retry = await supabase.from('employees').upsert(row, { onConflict: 'id' })
    error = retry.error
  }
  if (error) throw error
}

export async function deleteEmployeeRemote(empId) {
  if (!supabase) return
  await supabase.from('leaves').delete().eq('emp_id', empId)
  await supabase.from('message_recipients').delete().eq('emp_id', empId)
  const { error } = await supabase.from('employees').delete().eq('id', empId)
  if (error) throw error
}

export async function syncAttendanceRow(record, { employee } = {}) {
  if (!supabase) return

  // Only sync employee when we have the full profile — never overwrite with a stub row.
  if (employee?.id) {
    await syncEmployeeRow(employee)
  }

  let row = attendanceToRow({ ...record, date: normalizeDateStr(record.date) })
  let { error } = await supabase.from('attendance').upsert(row, { onConflict: 'emp_id,date' })
  if (error && /events|column/i.test(String(error.message))) {
    const slim = { ...row }
    delete slim.events
    const retry = await supabase.from('attendance').upsert(slim, { onConflict: 'emp_id,date' })
    error = retry.error
  }
  if (error) throw error
}

export async function syncLeaveRow(leave) {
  if (!supabase) return
  const { error } = await supabase.from('leaves').upsert(leaveToRow(leave), { onConflict: 'id' })
  if (error) throw error
}

export async function syncNotificationRow(n) {
  if (!supabase) return
  const { error } = await supabase.from('notifications').upsert(notificationToRow(n), { onConflict: 'id' })
  if (error && /does not exist|relation/i.test(String(error.message))) return
  if (error) throw error
}

export async function sendAdminMessage({ message, recipientEmpIds }) {
  if (!supabase) throw new Error('Supabase required')
  const { error: mErr } = await supabase.from('messages').upsert(
    {
      id: message.id,
      title: message.title,
      body: message.body,
      priority: message.priority,
      scope: message.scope,
      sender: message.sender,
      created_at: message.createdAt,
    },
    { onConflict: 'id' },
  )
  if (mErr) throw mErr

  const rows = recipientEmpIds.map((empId) => ({
    message_id: message.id,
    emp_id: empId,
    read_at: null,
  }))
  const { error: rErr } = await supabase.from('message_recipients').upsert(rows, {
    onConflict: 'message_id,emp_id',
  })
  if (rErr) throw rErr

  for (const empId of recipientEmpIds) {
    if (message.priority === 'Normal') continue
    await syncNotificationRow({
      id: `N-msg-${message.id}-${empId}`,
      userKind: 'employee',
      userId: empId,
      type: 'ADMIN_MESSAGE',
      title: message.title,
      body: message.body.slice(0, 200),
      readAt: null,
      createdAt: message.createdAt,
      meta: { messageId: message.id, priority: message.priority },
    })
  }
}

export async function markMessageRead(messageId, empId) {
  if (!supabase) return
  await supabase
    .from('message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('message_id', messageId)
    .eq('emp_id', empId)
}

export async function addMessageReply(reply) {
  if (!supabase) throw new Error('Supabase required')
  const { error } = await supabase.from('message_replies').upsert(
    {
      id: reply.id,
      message_id: reply.messageId,
      emp_id: reply.empId,
      emp_name: reply.empName,
      body: reply.body,
      created_at: reply.createdAt,
    },
    { onConflict: 'id' },
  )
  if (error) throw error

  await syncNotificationRow({
    id: `N-reply-${reply.id}`,
    userKind: 'admin',
    userId: 'admin',
    type: 'MESSAGE_REPLY',
    title: `Reply from ${reply.empName}`,
    body: reply.body.slice(0, 200),
    readAt: null,
    createdAt: reply.createdAt,
    meta: { messageId: reply.messageId, empId: reply.empId },
  })
}

export async function migrateLocalDbToSupabase(localDb) {
  if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase is not configured')
  for (const e of localDb.employees || []) await syncEmployeeRow(e)
  for (const a of localDb.attendance || []) await syncAttendanceRow(a)
  for (const l of localDb.leaves || []) await syncLeaveRow(l)
  return loadAllFromSupabase()
}

export { employeeFromRow }
