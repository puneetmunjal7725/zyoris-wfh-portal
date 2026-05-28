import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function readDeployBase() {
  if (process.env.VITE_DEPLOY_BASE) return process.env.VITE_DEPLOY_BASE
  try {
    const env = readFileSync('.env.production', 'utf8')
    const match = env.match(/^VITE_DEPLOY_BASE=(.+)$/m)
    if (match) return match[1].trim()
  } catch {
    /* use default */
  }
  return '/zy-wfh-7k2m/'
}

const base = readDeployBase()
const segment = base.replace(/^\/|\/$/g, '')

const htaccess = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /${segment}/
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /${segment}/index.html [L]
</IfModule>
`

writeFileSync(join('dist', '.htaccess'), htaccess, 'utf8')
console.log(`Wrote dist/.htaccess for /${segment}/`)
