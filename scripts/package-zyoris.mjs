import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const folder = 'zy-wfh-7k2m'
const websiteRepo = resolve('..', 'website-', folder)

rmSync('release', { recursive: true, force: true })
mkdirSync(join('release', folder), { recursive: true })
cpSync('dist', join('release', folder), { recursive: true })

if (existsSync(resolve('..', 'website-'))) {
  rmSync(websiteRepo, { recursive: true, force: true })
  mkdirSync(websiteRepo, { recursive: true })
  cpSync('dist', websiteRepo, { recursive: true })
  console.log(`\nCopied into website- repo: ${websiteRepo}`)
}

console.log(`\nLive URL: https://zyoris.com/${folder}/`)
console.log(`Login:  https://zyoris.com/${folder}/#/login\n`)
