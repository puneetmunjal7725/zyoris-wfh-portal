import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEmployeeById, writeSession } from '../state/storage.js'
import { WfhActivityLog } from '../ui/WfhActivityLog.jsx'

export function EmployeeProfileView({ session }) {
  const navigate = useNavigate()
  const employee = useMemo(() => getEmployeeById(session.id), [session.id])

  if (!employee) {
    return (
      <div className="container">
        <div className="card cardBody">Profile not found. Contact admin.</div>
      </div>
    )
  }

  const payLabel = employee.compensationType === 'Stipend' ? 'Stipend' : 'Salary'

  return (
    <div className="container">
      <div className="profileGrid">
        <div className="card profileCard">
          <div className="cardBody profileBody">
            <div className="profilePhotoWrap">
              {employee.photo ? (
                <img className="profilePhoto" src={employee.photo} alt={employee.name} />
              ) : (
                <div className="profilePhotoPlaceholder">{employee.name?.charAt(0) || '?'}</div>
              )}
            </div>
            <div className="profileFields">
              <h2 className="profileName">{employee.name}</h2>
              <div className="profileMeta">
                <span className="pill">{employee.role}</span>
              </div>
              <dl className="profileDl">
                <div>
                  <dt>Employee ID</dt>
                  <dd>{employee.id}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{employee.address?.trim() || '—'}</dd>
                </div>
                <div>
                  <dt>{payLabel}</dt>
                  <dd>{employee.compensation?.trim() || '—'}</dd>
                </div>
              </dl>
              <p className="profileNote">Profile details are managed by admin.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  writeSession(null)
                  navigate('/login', { replace: true })
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <WfhActivityLog
          empId={session.id}
          showHistory
          title="My activity history"
          subtitle="All punch in/out and work logs with dates"
        />
      </div>
    </div>
  )
}
