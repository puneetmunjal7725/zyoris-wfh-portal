import { normalizeDateStr } from './date.js'

export function eventLabel(type) {
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

/** Break ms from BREAK_START / BREAK_END event pairs */
function breakMsFromEvents(events = []) {
  let total = 0
  let open = null
  for (const e of [...events].sort((a, b) => new Date(a.time) - new Date(b.time))) {
    if (e.type === 'BREAK_START') open = new Date(e.time).getTime()
    if (e.type === 'BREAK_END' && open) {
      total += new Date(e.time).getTime() - open
      open = null
    }
  }
  return total
}

/** Working milliseconds for one attendance day */
export function computeWorkingMs(record) {
  if (!record?.punchIn) return 0
  const start = new Date(record.punchIn).getTime()
  const end = record.punchOut ? new Date(record.punchOut).getTime() : Date.now()
  const gross = Math.max(0, end - start)
  const breaks = breakMsFromEvents(record.events)
  return Math.max(0, gross - breaks)
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function isOnBreak(record) {
  const events = record?.events || []
  let lastBreak = null
  for (const e of [...events].sort((a, b) => new Date(a.time) - new Date(b.time))) {
    if (e.type === 'BREAK_START') lastBreak = 'start'
    if (e.type === 'BREAK_END') lastBreak = 'end'
  }
  return lastBreak === 'start'
}

export function filterAttendanceByRange(records, fromDate, toDate, empId = null) {
  const from = normalizeDateStr(fromDate)
  const to = normalizeDateStr(toDate)
  return records.filter((a) => {
    const d = normalizeDateStr(a.date)
    if (d < from || d > to) return false
    if (empId && a.empId.toUpperCase() !== empId.toUpperCase()) return false
    return true
  })
}

export function attendanceSummaryRows(records) {
  return records.map((a) => ({
    date: normalizeDateStr(a.date),
    empId: a.empId,
    empName: a.empName,
    punchIn: a.punchIn,
    punchOut: a.punchOut,
    workingMs: computeWorkingMs(a),
    workingHours: formatDuration(computeWorkingMs(a)),
    status: a.punchIn ? (a.punchOut ? 'Complete' : 'Active') : 'Absent',
  }))
}
