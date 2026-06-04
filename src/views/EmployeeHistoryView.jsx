import { useEffect, useMemo, useState } from 'react'
import { usePortalDb } from '../state/portalDb.js'
import { queryAttendanceHistory, todayStr } from '../state/storage.js'
import { attendanceSummaryRows, formatDuration } from '../utils/attendanceCalc.js'
import { fmtDate, fmtTime } from '../utils/format.js'
import { normalizeDateStr } from '../utils/date.js'
import { TableWrap } from '../ui/TableWrap.jsx'

function monthAgoStr(days = 30) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return todayStr(d)
}

export function EmployeeHistoryView({ session }) {
  const { version } = usePortalDb()
  const [from, setFrom] = useState(monthAgoStr(30))
  const [to, setTo] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void queryAttendanceHistory({ fromDate: from, toDate: to, empId: session.id }).then((records) => {
      if (!cancelled) {
        setRows(attendanceSummaryRows(records))
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [from, to, session.id, version])

  const totalMs = useMemo(() => rows.reduce((s, r) => s + r.workingMs, 0), [rows])

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="cardHeader">
          <div className="cardHeaderTitle">My attendance history</div>
          <span className="pill">Last 30+ days</span>
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
          </div>
          <p style={{ marginTop: 14, fontSize: 14, color: 'var(--text-h)' }}>
            Total working time: <b>{formatDuration(totalMs)}</b> · {rows.length} days
          </p>
        </div>
      </div>

      <div className="card">
        <div className="cardBody">
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text)' }}>Loading…</div>
          ) : rows.length ? (
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Punch in</th>
                    <th>Punch out</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date}>
                      <td>{fmtDate(r.date)}</td>
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
            <div style={{ fontSize: 13, color: 'var(--text)' }}>No records in this range.</div>
          )}
        </div>
      </div>
    </div>
  )
}
