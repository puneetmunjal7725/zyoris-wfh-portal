import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { PortalBootstrap } from './ui/PortalBootstrap.jsx'
import { RequireAdmin, RequireUser } from './state/guards.jsx'
import { LoginPage } from './views/LoginPage.jsx'
import { EmployeePortal } from './views/EmployeePortal.jsx'
import { AdminPortal } from './views/AdminPortal.jsx'

export default function App() {
  return (
    <PortalBootstrap>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/employee/*"
        element={
          <RequireUser>
            <EmployeePortal />
          </RequireUser>
        }
      />
      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <AdminPortal />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </PortalBootstrap>
  )
}
