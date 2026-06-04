import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePortalDb } from '../state/portalDb.js'
import { ensureDbSeeded, queryAttendanceHistory, refreshFromCloud, todayStr } from '../state/storage.js'
import { buildShiftActivityItems } from '../state/activityLog.js'
import { attendanceSummaryRows, filterAttendanceByRange, formatDuration } from '../utils/attendanceCalc.js'
import { downloadCsv, downloadExcel } from '../utils/exportTable.js'
import { fmtDate, fmtTime } from '../utils/format.js'
import { ShiftActivityBlock } from '../ui/ShiftActivityBlock.jsx'
import { TableWrap } from '../ui/TableWrap.jsx'

const EXPORT_HEADERS = [
  { key: 'date', label: 'Date' },
  { key: 'empId', label: 'Employee ID' },
  { key: 'empName', label: 'Name' },
  { key: 'punchIn', label: 'Punch In' },
  { key: 'punchOut', label: 'Punch Out' },
  { key: 'workingHours', label: 'Working Hours' },
  { key: 'status', label: 'Status' },
]

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return todayStr(d)
}

function recordsToRows(records) {
  return attendanceSummaryRows(records).map((r) => ({
    ...r,
    activityItems: buildShiftActivityItems(
      records.find((rec) => rec.empId === r.empId && rec.date === r.date),
    ),
  }))
}

export function AdminAttendanceHistory() {
  const { db, version } = usePortalDb()
  const employees = useMemo(() => ensureDbSeeded().employees, [db, version])
  const [from, setFrom] = useState(daysAgo(90))
  const [to, setTo] = useState(todayStr())
  const [empFilter, setEmpFilter] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const filterKey = `${from}|${to}|${empFilter}`
  const skipVersionSync = useRef(true)

  const applyLocalRows = useCallback(() => {
    const records = filterAttendanceByRange(ensureDbSeeded().attendance, from, to, empFilter || null)
    setRows(recordsToRows(records))
  }, [from, to, empFilter])

  const loadFromCloud = useCallback(async () => {
    setLoading(true)
    try {
      const records = await queryAttendanceHistory({
        fromDate: from,
        toDate: to,
        empId: empFilter || null,
      })
      setRows(recordsToRows(records))
    } finally {
      setLoading(false)
    }
  }, [from, to, empFilter])

  useEffect(() => {
    skipVersionSync.current = true
    void loadFromCloud().then(() => {
      skipVersionSync.current = false
    })
  }, [filterKey, loadFromCloud])

  useEffect(() => {
    if (skipVersionSync.current || loading) return
    applyLocalRows()
  }, [version, applyLocalRows, loading])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.empName.toLowerCase().includes(q) ||
        r.empId.toLowerCase().includes(q) ||
        r.date.includes(q),
    )
  }, [rows, search])

  const totalMs = filtered.reduce((s, r) => s + r.workingMs, 0)

  const exportRows = filtered.map((r) => ({
    ...r,
    punchIn: r.punchIn ? fmtTime(r.punchIn) : '—',
    punchOut: r.punchOut ? fmtTime(r.punchOut) : '—',
  }))

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshFromCloud()
      await loadFromCloud()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div className="cardHeaderTitle">Attendance history</div>
          <div className="row rowKeep" style={{ gap: 8 }}>
            <span className="pill">Up to 3 months</span>
            <button type="button" className="btn" disabled={refreshing || loading} onClick={() => void handleRefresh()}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="cardBody">
          <div className="grid2">
            <div>
              <div className="label">From</div>
              <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <div className="label">To</div>
              <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <div className="label">Employee</div>
              <select className="select" value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
                <option value="">All employees</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label">Search</div>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or ID…"
              />
            </div>
          </div>
          <p style={{ marginTop: 14, fontSize: 14 }}>
            {filtered.length} records · Total hours: <b>{formatDuration(totalMs)}</b>
          </p>
          <div className="row rowKeep" style={{ gap: 8, marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => downloadCsv('attendance-history', EXPORT_HEADERS, exportRows)}>
              Export CSV
            </button>
            <button type="button" className="btn" onClick={() => downloadExcel('attendance-history', EXPORT_HEADERS, exportRows)}>
              Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardBody">
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>Loading attendance…</div>
          ) : filtered.length ? (
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Punch in</th>
                    <th>Punch out</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Shift &amp; WFH activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={`${r.empId}-${r.date}`}>
                      <td>{fmtDate(r.date)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.empName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{r.empId}</div>
                      </td>
                      <td>{fmtTime(r.punchIn)}</td>
                      <td>{fmtTime(r.punchOut)}</td>
                      <td>{r.workingHours}</td>
                      <td>
                        <span className="pill">{r.status}</span>
                      </td>
                      <td>
                        {r.activityItems?.length ? (
                          r.activityItems.map((shift) => <ShiftActivityBlock key={shift.id} shift={shift} compact />)
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No attendance in this range.</div>
          )}
        </div>
      </div>
    </div>
  )
}
