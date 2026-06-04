import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)
const tables = [
  'employees',
  'attendance',
  'leaves',
  'messages',
  'message_recipients',
  'message_replies',
  'notifications',
]

for (const table of tables) {
  const col = table === 'attendance' ? 'emp_id' : 'id'
  const { error, count } = await supabase.from(table).select(col, { count: 'exact' }).limit(1)
  if (error) console.log(`${table}: MISSING or ERROR — ${error.message}`)
  else console.log(`${table}: OK (${count ?? 0} rows)`)
}

// probe events column
const { error: evErr } = await supabase.from('attendance').select('events').limit(1)
if (evErr) console.log(`attendance.events column: ${evErr.message}`)
else console.log('attendance.events column: OK')

// probe email column
const { error: emErr } = await supabase.from('employees').select('email').limit(1)
if (emErr) console.log(`employees.email column: ${emErr.message}`)
else console.log('employees.email column: OK')
