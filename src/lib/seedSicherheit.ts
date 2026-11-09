/**
 * Reine Logik für scripts/seed-dev.mjs, damit sie getestet werden kann.
 *
 * Das Ziel steht fest im Code: Es gibt keinen Parameter, über den eine andere
 * Projekt-Referenz hineingelangen kann.
 */

export const DEV_PROJEKT_REF = 'vjvnhvwdwxvofwsjcytr'
export const GEHEIMNIS_MARKER = '-- @@SEED_GEHEIMNISSE@@'

const MIN_PASSWORT_LAENGE = 10
const ADRESSE_MUSTER = /^[^\s@'"\\]+@[^\s@'"\\]+\.[^\s@'"\\]+$/

export const DEV_ZIEL_ARGUMENTE = [`--remote=${DEV_PROJEKT_REF}`, '--yes'] as const

export type SeedZiel = 'dev' | 'lokal'

export function seedZiel(argumente: string[]): SeedZiel {
  if (argumente.length === 0) return 'dev'
  if (argumente.length === 1 && argumente[0] === '--lokal') return 'lokal'
  throw new Error('Erlaubt ist nur die Option --lokal. Ein anderes Ziel gibt es nicht.')
}

export function pruefePasswort(passwort: string | undefined): string {
  if (!passwort || passwort.length < MIN_PASSWORT_LAENGE) {
    throw new Error(`SEED_TESTPASSWORT fehlt oder ist kürzer als ${MIN_PASSWORT_LAENGE} Zeichen.`)
  }
  return passwort
}

export function plusAdresse(basis: string, zusatz: string): string {
  if (!ADRESSE_MUSTER.test(basis)) {
    throw new Error('SEED_PLUS_ADRESSE ist keine gültige E-Mail-Adresse.')
  }
  const [lokal, domain] = basis.split('@')
  return `${lokal}${lokal.includes('+') ? '-' : '+'}${zusatz}@${domain}`
}

export function sqlText(wert: string): string {
  return `'${wert.replaceAll("'", "''")}'`
}

function plusNutzerSql(gemeindeNr: number, slug: string, adresse: string): string {
  const id = `pg_temp.seed_id(${gemeindeNr}, 16, 1)`
  const email = sqlText(adresse)
  const gemeinde = `(select id from seed_gemeinde where nr = ${gemeindeNr})`
  const name = sqlText(slug === 'testdorf' ? 'Testdorf' : 'Musterhausen')
  return `
insert into auth.users (
  instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000'::uuid, ${id}, 'authenticated', 'authenticated', ${email}, now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
) on conflict (id) do update set email = excluded.email, updated_at = now();

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at) values (
  ${id}::text, ${id},
  jsonb_build_object('sub', ${id}::text, 'email', ${email}, 'email_verified', true),
  'email', now(), now()
) on conflict (provider_id, provider) do update set identity_data = excluded.identity_data, updated_at = now();

insert into public.profiles (id, gemeinde_id, role, email, display_name, vorname, nachname) values (
  ${id}, ${gemeinde}, 'buerger', ${email}, 'Post Empfang ' || ${name}, 'Post', 'Empfang'
) on conflict (id) do update set email = excluded.email;
`
}

/** Setzt die Werte an der Markierung ein, also innerhalb der geschützten Transaktion. */
export function baueSeedSql(seed: string, werte: { passwort: string; plusBasis: string }): string {
  if (seed.split(GEHEIMNIS_MARKER).length !== 2) {
    throw new Error('seed.sql muss die Markierung für die Geheimnisse genau einmal enthalten.')
  }
  const passwort = pruefePasswort(werte.passwort)
  const geheimnisse = `
${plusNutzerSql(0, 'testdorf', plusAdresse(werte.plusBasis, 'testdorf'))}
${plusNutzerSql(1, 'musterhausen', plusAdresse(werte.plusBasis, 'musterhausen'))}

update auth.users
set encrypted_password = extensions.crypt(${sqlText(passwort)}, extensions.gen_salt('bf', 10)),
    updated_at = now()
where id in (select id from seed_nutzer where ist_login)
   or id in (pg_temp.seed_id(0, 16, 1), pg_temp.seed_id(1, 16, 1));
`
  return seed.replace(GEHEIMNIS_MARKER, () => geheimnisse)
}
