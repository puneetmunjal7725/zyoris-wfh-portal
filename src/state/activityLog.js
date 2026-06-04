import { listAttendanceForEmployee } from './storage.js'

export function buildDayActivityLog(record) {
  if (!record) return []

  const entries = []

  if (Array.isArray(record.events) && record.events.length > 0) {
    for (const e of record.events) {
      entries.push({
        id: e.id || `${e.type}-${e.time}`,
        date: record.date,
        type: e.type,
        time: e.time,
        label: eventLabel(e.type),
        status: e.status || '—',
        detail: e.detail || '—',
      })
    }
  }

  if (!entries.length) {
    if (record.punchIn) {
      entries.push({
        id: `punch-in-${record.punchIn}`,
        date: record.date,
        type: 'PUNCH_IN',
        time: record.punchIn,
        label: 'Punch In',
        status: 'Done',
        detail: 'Work session started',
      })
    }

    for (const [idx, c] of (record.checks || []).entries()) {
      entries.push({
        id: `check-${c.time}-${idx}`,
        date: record.date,
        type: 'WFH_CHECK',
        time: c.time,
        label: 'WFH Activity Check',
        status: c.responded ? 'Responded' : 'Missed',
        detail: c.update?.trim() || (c.responded ? '—' : 'No response in time'),
      })
    }

    if (record.punchOut) {
      const parts = []
      if (record.tasks?.trim()) parts.push(`Tasks completed: ${record.tasks.trim()}`)
      if (record.plan?.trim()) parts.push(`Plan for tomorrow: ${record.plan.trim()}`)
      if (record.blocker?.trim()) parts.push(`Blockers: ${record.blocker.trim()}`)
      entries.push({
        id: `punch-out-${record.punchOut}`,
        date: record.date,
        type: 'PUNCH_OUT',
        time: record.punchOut,
        label: 'Punch Out',
        status: 'Done',
        detail: parts.length ? parts.join('\n') : 'Work session ended',
      })
    }
  }

  return entries.sort((a, b) => new Date(a.time) - new Date(b.time))
}

export function buildEmployeeActivityHistory(empId, { limitDays = 90 } = {}) {
  const records = listAttendanceForEmployee(empId).slice(0, limitDays)
  return records
    .flatMap((record) =>
      buildDayActivityLog(record).map((e) => ({
        ...e,
        date: e.date || record.date,
      })),
    )
    .sort((a, b) => new Date(b.time) - new Date(a.time))
}

function eventLabel(type) {
  switch (type) {
    case 'PUNCH_IN':
      return 'Punch In'
    case 'PUNCH_OUT':
      return 'Punch Out'
    case 'BREAK_START':
      return 'Break Start'
    case 'BREAK_END':
      return 'Break End'
    case 'WFH_CHECK':
      return 'WFH Activity Check'
    default:
      return type
  }
}

export function appendAttendanceEvent(attendance, event) {
  const events = Array.isArray(attendance.events) ? attendance.events.slice() : []
  events.push({
    id: `${event.type}-${event.time}-${events.length}`,
    type: event.type,
    time: event.time,
    status: event.status ?? '—',
    detail: event.detail ?? '—',
  })
  return { ...attendance, events }
}
