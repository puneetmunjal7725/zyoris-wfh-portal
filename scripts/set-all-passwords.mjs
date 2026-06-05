/**
 * One-time: set every employee password in Supabase to Zyoris (default).
 * Usage: node scripts/set-all-passwords.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const PASSWORD = 'Zyoris'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase env in .env.production.local')
  process.exit(1)
}

const supabase = createClient(url, key)
const { data: employees, error } = await supabase.from('employees').select('*')
if (error) {
  console.error('Could not load employees:', error.message)
  process.exit(1)
}

console.log(`Updating ${employees.length} employees to password "${PASSWORD}"…`)
for (const e of employees) {
  const { error: upErr } = await supabase.from('employees').upsert(
    { ...e, password: PASSWORD },
    { onConflict: 'id' },
  )
  if (upErr) {
    console.error(`FAIL ${e.id}:`, upErr.message)
  } else {
    console.log(`OK ${e.id} — ${e.name}`)
  }
}
console.log('Done.')
