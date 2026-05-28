import { buildDayActivityLog, buildEmployeeActivityHistory } from '../state/activityLog.js'
import { fmtDate, fmtTime } from '../utils/format.js'

function statusClass(type, status) {
  if (type === 'PUNCH_IN') return 'pill scoreGreen'
  if (type === 'PUNCH_OUT') return 'pill'
  if (status === 'Responded') return 'pill scoreGreen'
  if (status === 'Missed') return 'pill scoreRed'
  return 'pill'
}

export function WfhActivityLog({
  record,
  empId,
  showHistory = false,
  emptyMessage = 'No activity yet.',
  title = 'WFH Activity Log',
  subtitle = 'Punch in/out, work updates, and activity checks',
}) {
  const entries = showHistory && empId
    ? buildEmployeeActivityHistory(empId)
    : buildDayActivityLog(record)

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardHeaderTitle">{title}</div>
          <div className="cardHeaderSub">{subtitle}</div>
        </div>
        <span className="pill">{entries.length} entries</span>
      </div>
      <div className="cardBody">
        {entries.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Event</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date || e.time)}</td>
                  <td>{fmtTime(e.time)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-h)' }}>{e.label}</td>
                  <td>
                    <span className={statusClass(e.type, e.status)}>{e.status}</span>
                  </td>
                  <td className="logDetail">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{emptyMessage}</div>
        )}
      </div>
    </div>
  )
}
