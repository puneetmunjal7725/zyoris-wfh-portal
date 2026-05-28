import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../config/auth.js'
import { ensureDbSeeded, writeSession } from '../state/storage.js'
import { PortalShell } from '../ui/PortalShell.jsx'

export function LoginPage() {
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function onSubmit(e) {
    e.preventDefault()
    setError('')

    const id = loginId.trim()
    if (!id || !password) {
      setError('Enter your email or employee ID and password.')
      return
    }

    if (id.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      if (password === ADMIN_PASSWORD) {
        writeSession({ kind: 'admin', email: ADMIN_EMAIL, name: 'Admin' })
        navigate('/admin', { replace: true })
      } else {
        setError('Invalid credentials.')
      }
      return
    }

    const db = ensureDbSeeded()
    const emp = db.employees.find((x) => x.id.toUpperCase() === id.toUpperCase())
    if (!emp) {
      setError('Account not found. Contact your administrator.')
      return
    }
    if (emp.password !== password) {
      setError('Invalid credentials.')
      return
    }

    writeSession({ kind: 'employee', id: emp.id, name: emp.name, role: emp.role })
    navigate('/employee', { replace: true })
  }

  return (
    <PortalShell subtitle="WFH Attendance Portal" mainClassName="containerNarrow">
      <div className="loginHero">
        <div className="badge">
          <span className="badgeDot" />
          Team access
        </div>
        <h1>
          Work from <span className="accent">home</span>
        </h1>
        <p>Sign in to record attendance, activity checks, and leave requests.</p>
      </div>

      <div className="card">
        <div className="cardHeader">
          <div>
            <div className="cardHeaderTitle">Sign in</div>
            <div className="cardHeaderSub">Use your work email or employee ID</div>
          </div>
        </div>
        <div className="cardBody">
          <form onSubmit={onSubmit}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <div className="label">Email or Employee ID</div>
                <input
                  className="input"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <div className="label">Password</div>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <button className="btn btnPrimary" type="submit">
                  Sign in
                </button>
                {error ? <span className="formError">{error}</span> : null}
              </div>
            </div>
          </form>
        </div>
      </div>
    </PortalShell>
  )
}
