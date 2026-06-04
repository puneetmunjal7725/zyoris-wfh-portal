import { fmtTime } from '../utils/format.js'

function statusClass(type, status) {
  if (type === 'PUNCH_IN') return 'pill scoreGreen'
  if (type === 'PUNCH_OUT') return 'pill'
  if (status === 'Responded') return 'pill scoreGreen'
  if (status === 'Missed') return 'pill scoreRed'
  return 'pill'
}

export function ShiftActivityBlock({ shift, compact = false }) {
  if (!shift) return null

  return (
    <div className="shiftBlock">
      <div className="shiftBlockHead">
        <span className="shiftBlockTitle">{shift.label}</span>
        <span className="pill">{shift.status}</span>
      </div>
      <div className="shiftBlockTimes">
        <span>
          <b>In:</b> {shift.punchIn ? fmtTime(shift.punchIn) : '—'}
        </span>
        <span>
          <b>Out:</b> {shift.punchOut ? fmtTime(shift.punchOut) : '—'}
        </span>
      </div>
      {shift.checks?.length ? (
        <ul className="shiftActivityList">
          {shift.checks.map((c) => (
            <li key={c.id}>
              <span className="shiftActivityTime">{fmtTime(c.time)}</span>
              <span className="shiftActivityLabel">{c.label}</span>
              <span className={statusClass(c.type, c.status)}>{c.status}</span>
              {!compact && c.detail && c.detail !== '—' ? (
                <span className="shiftActivityDetail">{c.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="shiftBlockEmpty">No WFH activity checks yet</div>
      )}
      {shift.breaks?.length ? (
        <ul className="shiftActivityList shiftActivityListBreaks">
          {shift.breaks.map((b) => (
            <li key={b.id}>
              <span className="shiftActivityTime">{fmtTime(b.time)}</span>
              <span className="shiftActivityLabel">{b.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {shift.detail ? <div className="logDetail shiftBlockFoot">{shift.detail}</div> : null}
    </div>
  )
}
