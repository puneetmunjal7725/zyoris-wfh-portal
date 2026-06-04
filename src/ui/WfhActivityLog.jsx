import { useMemo } from 'react'
import { buildShiftActivityItems } from '../state/activityLog.js'
import { listAttendanceForEmployee } from '../state/storage.js'
import { usePortalDb } from '../state/portalDb.js'
import { fmtDate } from '../utils/format.js'
import { ShiftActivityBlock } from './ShiftActivityBlock.jsx'

export function WfhActivityLog({
  record,
  empId,
  showHistory = false,
  emptyMessage = 'No activity yet.',
  title = 'WFH Activity Log',
  subtitle = 'One shift per day — punch in/out with activity checks inside',
}) {
  const { version } = usePortalDb()
  const shifts = useMemo(() => {
    if (showHistory && empId) {
      const records = listAttendanceForEmployee(empId).slice(0, 90)
      return records.flatMap((r) =>
        buildShiftActivityItems(r).map((shift) => ({ ...shift, date: r.date })),
      )
    }
    return buildShiftActivityItems(record)
  }, [version, record, empId, showHistory])

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardHeaderTitle">{title}</div>
          <div className="cardHeaderSub">{subtitle}</div>
        </div>
        <span className="pill">{shifts.length} shift{shifts.length === 1 ? '' : 's'}</span>
      </div>
      <div className="cardBody">
        {shifts.length ? (
          <div className="shiftStack">
            {shifts.map((shift) => (
              <div key={shift.id} className="shiftStackItem">
                {showHistory && shift.date ? (
                  <div className="shiftStackDate">{fmtDate(shift.date)}</div>
                ) : null}
                <ShiftActivityBlock shift={shift} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{emptyMessage}</div>
        )}
      </div>
    </div>
  )
}
