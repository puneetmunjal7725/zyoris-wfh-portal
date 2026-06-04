import { useEffect, useMemo, useState } from 'react'
import { usePortalDb } from '../state/portalDb.js'
import { ensureDbSeeded, queryAttendanceHistory, todayStr } from '../state/storage.js'
import { attendanceSummaryRows, formatDuration } from '../utils/attendanceCalc.js'
import { downloadCsv, downloadExcel } from '../utils/exportTable.js'
import { fmtDate, fmtTime } from '../utils/format.js'
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

export function AdminAttendanceHistory() {
  const { db, version } = usePortalDb()
  const employees = useMemo(() => ensureDbSeeded().employees, [db, version])
  const [from, setFrom] = useState(daysAgo(90))
  const [to, setTo] = useState(todayStr())
  const [empFilter, setEmpFilter] = useState('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void queryAttendanceHistory({
      fromDate: from,
      toDate: to,
      empId: empFilter || null,
    }).then((records) => {
      if (!cancelled) {
        setRows(attendanceSummaryRows(records))
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [from, to, empFilter, version])

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

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div className="cardHeaderTitle">Attendance history</div>
          <span className="pill">Up to 3 months</span>
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
            <div style={{ fontSize: 13, color: 'var(--text)' }}>Loading from cloud…</div>
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
