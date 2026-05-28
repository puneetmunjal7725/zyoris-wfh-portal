import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const raw = env.VITE_DEPLOY_BASE || '/'
  const base = raw === '/' ? '/' : `${raw.replace(/\/$/, '')}/`

  return {
  base,
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  }
})
