// Spielt supabase/seed.sql in dorfly-dev ein (mit --lokal in die lokale Datenbank).
//
// Benoetigt SEED_TESTPASSWORT und SEED_PLUS_ADRESSE, aus der Shell oder aus der
// von Git ignorierten Datei .env.seed.local. Ein anderes Ziel laesst sich nicht
// angeben, siehe src/lib/seedSicherheit.ts.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { baueSeedSql, DEV_ZIEL_ARGUMENTE, seedZiel } from '../src/lib/seedSicherheit.ts'

const CLI = 'supabase@3.0.0'
const LOKALER_CONTAINER = 'supabase_db_dorfly'

// Lokal lehnt "db query -f" mehrere Anweisungen ab, deshalb psql im Container.
function spieleLokalEin(sql) {
  return spawnSync(
    'docker',
    ['exec', '-i', LOKALER_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8' },
  )
}

// Die Datei enthaelt das Passwort: nur kurz, nur fuer diesen Nutzer, immer wieder loeschen.
function spieleInDevEin(sql) {
  const ordner = mkdtempSync(path.join(tmpdir(), 'dorfly-seed-'))
  const datei = path.join(ordner, 'seed.sql')
  try {
    writeFileSync(datei, sql, { mode: 0o600 })
    // shell: npx ist unter Windows eine .cmd-Datei. Alle Argumente stehen fest im Code.
    return spawnSync(
      'npx',
      ['--yes', CLI, 'db', 'query', ...DEV_ZIEL_ARGUMENTE, '-f', `"${datei}"`],
      { encoding: 'utf8', shell: true },
    )
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

let ziel
let sql
const passwort = process.env.SEED_TESTPASSWORT ?? ''
try {
  ziel = seedZiel(process.argv.slice(2))
  sql = baueSeedSql(readFileSync('supabase/seed.sql', 'utf8'), {
    passwort,
    plusBasis: process.env.SEED_PLUS_ADRESSE ?? '',
  })
} catch (fehler) {
  console.error(`Abbruch: ${fehler.message}`)
  process.exit(1)
}

const lauf = ziel === 'lokal' ? spieleLokalEin(sql) : spieleInDevEin(sql)
const ohnePasswort = text => (text ?? '').replaceAll(passwort, '***')
process.stdout.write(ohnePasswort(lauf.stdout))
process.stderr.write(ohnePasswort(lauf.stderr))

const status = lauf.status ?? 1
console.log(status === 0 ? `Seed eingespielt (Ziel: ${ziel}).` : `Seed fehlgeschlagen (Ziel: ${ziel}).`)
process.exit(status)
