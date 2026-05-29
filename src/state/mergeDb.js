import { normalizeDateStr } from '../utils/date.js'

function attKey(a) {
  return `${a.empId}|${normalizeDateStr(a.date)}`
}

/** Merge local + cloud — local wins when same id exists (prevents wipe on empty cloud). */
export function mergeDatabases(local, cloud) {
  const empMap = new Map()
  for (const e of cloud?.employees || []) empMap.set(e.id.toUpperCase(), e)
  for (const e of local?.employees || []) {
    const key = e.id.toUpperCase()
    empMap.set(key, { ...empMap.get(key), ...e })
  }

  const attMap = new Map()
  for (const a of cloud?.attendance || []) attMap.set(attKey(a), { ...a, date: normalizeDateStr(a.date) })
  for (const a of local?.attendance || []) {
    const key = attKey(a)
    attMap.set(key, { ...attMap.get(key), ...a, date: normalizeDateStr(a.date) })
  }

  const leaveMap = new Map()
  for (const l of cloud?.leaves || []) leaveMap.set(l.id, l)
  for (const l of local?.leaves || []) leaveMap.set(l.id, { ...leaveMap.get(l.id), ...l })

  return {
    employees: Array.from(empMap.values()),
    attendance: Array.from(attMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1)),
    leaves: Array.from(leaveMap.values()),
  }
}

export function countRecords(db) {
  if (!db) return 0
  return (db.employees?.length || 0) + (db.attendance?.length || 0) + (db.leaves?.length || 0)
}

/** Admin dashboard: cloud attendance/leaves win so employee punches show up. */
export function mergeForAdminView(local, cloud) {
  const merged = mergeDatabases(local, cloud)
  if ((cloud?.attendance?.length || 0) > 0) {
    const attMap = new Map()
    for (const a of merged.attendance || []) attMap.set(attKey(a), a)
    for (const a of cloud.attendance) {
      const key = attKey(a)
      attMap.set(key, { ...attMap.get(key), ...a, date: normalizeDateStr(a.date) })
    }
    merged.attendance = Array.from(attMap.values()).sort((a, b) =>
      normalizeDateStr(a.date) < normalizeDateStr(b.date) ? 1 : -1,
    )
  }
  if ((cloud?.leaves?.length || 0) > 0) {
    const leaveMap = new Map()
    for (const l of merged.leaves || []) leaveMap.set(l.id, l)
    for (const l of cloud.leaves) leaveMap.set(l.id, { ...leaveMap.get(l.id), ...l })
    merged.leaves = Array.from(leaveMap.values())
  }
  return merged
}
