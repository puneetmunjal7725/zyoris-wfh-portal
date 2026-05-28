import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const raw = env.VITE_DEPLOY_BASE || '/'
  const base = raw === '/' ? '/' : `${raw.replace(/\/$/, '')}/`

  return {
  base,
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app-[hash].js',
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'github-pages-html',
      transformIndexHtml(html) {
        return html
          .replace(/\s+crossorigin/g, '')
          .replace(/<script type="module"/g, '<script defer')
      },
    },
  ],
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  }
})
