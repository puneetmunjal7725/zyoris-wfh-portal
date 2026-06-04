/**
 * Run pending Supabase SQL migrations via Management API.
 * Requires SUPABASE_ACCESS_TOKEN in .env.production.local
 * (Create at https://supabase.com/dashboard/account/tokens)
 */
import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = 'qbtzjpcdutjnjhpqqfwr'

function loadEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        }),
    )
  } catch {
    return {}
  }
}

const env = { ...loadEnv(resolve(root, '.env.production')), ...loadEnv(resolve(root, '.env.production.local')) }
const token = env.SUPABASE_ACCESS_TOKEN?.trim()

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env.production.local')
  console.error('Create one at https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

const argFile = process.argv[2]
const files = argFile
  ? [argFile.replace(/^supabase\//, '')]
  : [
      'schema.sql',
      'migration-add-email.sql',
      'migration-attendance-events.sql',
      'migration-v2-messages-notifications.sql',
    ]

async function runQuery(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

for (const file of files) {
  const sql = readFileSync(resolve(root, 'supabase', file), 'utf8')
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('--'))

  console.log(`\n=== ${file} ===`)
  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
    try {
      await runQuery(stmt)
      console.log(`OK: ${preview}…`)
    } catch (err) {
      const msg = String(err.message)
      if (/already exists|duplicate|if not exists/i.test(msg)) {
        console.log(`SKIP (exists): ${preview}…`)
      } else {
        console.error(`FAIL: ${preview}…`)
        console.error(msg)
      }
    }
  }
}

console.log('\nDone. Run: node scripts/probe-supabase.mjs')
