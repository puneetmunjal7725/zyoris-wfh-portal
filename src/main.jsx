import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined
const Router = import.meta.env.VITE_USE_HASH_ROUTER === 'true' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router basename={routerBasename}>
      <App />
    </Router>
  </StrictMode>,
)
