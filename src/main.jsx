import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

const useHashRouter = import.meta.env.VITE_USE_HASH_ROUTER === 'true'
const Router = useHashRouter ? HashRouter : BrowserRouter
// HashRouter: routes live in the hash (#/login); basename breaks GitHub Pages subpaths.
const routerBasename = useHashRouter
  ? undefined
  : import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router basename={routerBasename}>
      <App />
    </Router>
  </StrictMode>,
)
