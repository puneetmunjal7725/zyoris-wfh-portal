/** Merge local + cloud — local wins when same id exists (prevents wipe on empty cloud). */
export function mergeDatabases(local, cloud) {
  const empMap = new Map()
  for (const e of cloud?.employees || []) empMap.set(e.id.toUpperCase(), e)
  for (const e of local?.employees || []) {
    const key = e.id.toUpperCase()
    empMap.set(key, { ...empMap.get(key), ...e })
  }

  const attMap = new Map()
  for (const a of cloud?.attendance || []) attMap.set(`${a.empId}|${a.date}`, a)
  for (const a of local?.attendance || []) {
    const key = `${a.empId}|${a.date}`
    attMap.set(key, { ...attMap.get(key), ...a })
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
