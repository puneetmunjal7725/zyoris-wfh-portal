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
    date: a.date,
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
    from: r.from_date,
    to: r.to_date,
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

export async function loadAllFromSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')

  const [empRes, attRes, leaveRes] = await Promise.all([
    supabase.from('employees').select('*'),
    supabase.from('attendance').select('*').order('date', { ascending: false }),
    supabase.from('leaves').select('*').order('applied_at', { ascending: false }),
  ])

  if (empRes.error) throw empRes.error
  if (attRes.error) throw attRes.error
  if (leaveRes.error) throw leaveRes.error

  return {
    employees: (empRes.data || []).map(employeeFromRow),
    attendance: (attRes.data || []).map(attendanceFromRow),
    leaves: (leaveRes.data || []).map(leaveFromRow),
  }
}

export function subscribeSupabaseRealtime(onChange) {
  if (!supabase) return () => {}

  let timer = null
  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => onChange(), 280)
  }

  const channel = supabase
    .channel('zyoris-portal')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, schedule)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, schedule)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, schedule)
    .subscribe()

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
  const leaves = await supabase.from('leaves').delete().eq('emp_id', empId)
  if (leaves.error) throw leaves.error
  const { error } = await supabase.from('employees').delete().eq('id', empId)
  if (error) throw error
}

export async function syncAttendanceRow(record, { employee } = {}) {
  if (!supabase) return

  if (employee) {
    await syncEmployeeRow(employee)
  } else {
    await syncEmployeeRow({
      id: record.empId,
      name: record.empName || record.empId,
      role: 'Employee',
      password: record.empId,
      email: '',
      address: '',
      compensation: '',
      compensationType: 'Salary',
      photo: '',
    })
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

export async function migrateLocalDbToSupabase(localDb) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase is not configured')
  }
  for (const e of localDb.employees || []) {
    await syncEmployeeRow(e)
  }
  for (const a of localDb.attendance || []) {
    await syncAttendanceRow(a)
  }
  for (const l of localDb.leaves || []) {
    await syncLeaveRow(l)
  }
  return loadAllFromSupabase()
}

export { employeeFromRow }
