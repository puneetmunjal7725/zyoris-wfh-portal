import { buildDayActivityLog } from '../state/activityLog.js'

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function statusClass(type, status) {
  if (type === 'PUNCH_IN') return 'pill scoreGreen'
  if (type === 'PUNCH_OUT') return 'pill'
  if (status === 'Responded') return 'pill scoreGreen'
  if (status === 'Missed') return 'pill scoreRed'
  return 'pill'
}

export function WfhActivityLog({ record, emptyMessage = 'No activity yet today.' }) {
  const entries = buildDayActivityLog(record)

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardHeaderTitle">WFH Activity Log (Today)</div>
          <div className="cardHeaderSub">Punch in/out, work updates, and activity checks</div>
        </div>
        <span className="pill">{entries.length} entries</span>
      </div>
      <div className="cardBody">
        {entries.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((e) => (
                <tr key={e.id}>
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
