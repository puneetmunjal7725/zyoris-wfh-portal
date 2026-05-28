import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureDbSeeded, writeSession } from '../state/storage.js'

export function LoginPage() {
  const navigate = useNavigate()
  const [empId, setEmpId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const hint = useMemo(
    () => ({
      admin: { id: 'ADMIN', password: 'zyoris@admin' },
      employee: { password: 'pass123' },
    }),
    [],
  )

  function onSubmit(e) {
    e.preventDefault()
    setError('')

    const id = empId.trim()
    if (!id || !password) {
      setError('Enter your Employee ID and password.')
      return
    }

    if (id.toUpperCase() === 'ADMIN') {
      if (password === 'zyoris@admin') {
        writeSession({ kind: 'admin', id: 'ADMIN', name: 'Admin' })
        navigate('/admin', { replace: true })
      } else {
        setError('Invalid admin password.')
      }
      return
    }

    const db = ensureDbSeeded()
    const emp = db.employees.find((x) => x.id.toUpperCase() === id.toUpperCase())
    if (!emp) {
      setError('Employee not found. Ask admin to add your ID.')
      return
    }
    if (emp.password !== password) {
      setError('Invalid password.')
      return
    }

    writeSession({ kind: 'employee', id: emp.id, name: emp.name, role: emp.role })
    navigate('/employee', { replace: true })
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="title">Zyoris Technology</div>
          <div className="subtitle">WFH Attendance Portal</div>
        </div>
        <span className="pill">LocalStorage Demo • No Backend</span>
      </header>

      <main className="container">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>Login</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                Admin: <code>{hint.admin.id}</code> / <code>{hint.admin.password}</code> • Demo
                employees use <code>{hint.employee.password}</code>
              </div>
            </div>
          </div>
          <div className="cardBody">
            <form onSubmit={onSubmit} className="grid2">
              <div>
                <div className="label">Employee ID</div>
                <input
                  className="input"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  placeholder="E1001"
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
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              <div className="row" style={{ gridColumn: '1 / -1', justifyContent: 'space-between' }}>
                <button className="btn btnPrimary" type="submit">
                  Sign in
                </button>
                {error ? <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span> : null}
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

