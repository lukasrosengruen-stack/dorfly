# Nutzungsbedingungen-Seite & Pflicht-Checkboxen bei Registrierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/nutzungsbedingungen` page and two mandatory, separately-tracked consent checkboxes (age ≥16, terms + privacy acknowledgement) to the registration flow, persisting consent timestamps + version on the user's profile.

**Architecture:** Static legal page follows the existing `datenschutz`/`impressum` page pattern exactly (local color const, `Section`/`P` helpers, no shared layout). The register branch of the existing `useState`-based login/register form is extracted into a new `RegisterForm` client component using `react-hook-form` + `zodResolver`, matching the codebase's other RHF+zod forms (`WarnmeldungForm`). Consent data travels through Supabase Auth's `user_metadata` (the same channel already used for `vorname`/`nachname`/`einladungs_token`) since the actual `profiles` row is only created later, in `/auth/callback`, after email confirmation.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, react-hook-form 7 + @hookform/resolvers/zod, zod v4, Supabase (Postgres + Auth), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-22-nutzungsbedingungen-und-registrierung-checkboxen-design.md`

---

## Task 1: Datenbank-Migration für Consent-Felder

**Files:**
- Create: `supabase/migrations/056_profiles_terms_consent.sql`

- [ ] **Step 1: Migration schreiben**

```sql
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version      text,
  add column if not exists age_confirmed_at   timestamptz;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;
```

- [ ] **Step 2: Syntax gegen bestehende Migration abgleichen**

Vergleiche mit `supabase/migrations/054_profiles_vorname_nachname.sql` (identisches Muster: `add column if not exists` + abschließende explizite Grants). Kein Backfill nötig — Bestandsnutzer haben `NULL` in den drei neuen Spalten, das ist korrekt (sie haben nie zugestimmt).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/056_profiles_terms_consent.sql
git commit -m "Migration: Consent-Felder (terms_accepted_at, terms_version, age_confirmed_at) auf profiles"
```

---

## Task 2: Zentrale TERMS_VERSION-Konstante

**Files:**
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Konstante anlegen**

```ts
export const TERMS_VERSION = '1.0'
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/constants.ts
git commit -m "Zentrale TERMS_VERSION-Konstante ergänzen"
```

---

## Task 3: `profilAnlegen` um Consent-Felder erweitern

**Files:**
- Modify: `src/lib/profil-anlegen.ts`

- [ ] **Step 1: `RegistrierungsDaten`-Interface erweitern**

In `src/lib/profil-anlegen.ts`, ersetze:

```ts
export interface RegistrierungsDaten {
  email?: string
  vorname?: string
  nachname?: string
  token?: string
}
```

durch:

```ts
export interface RegistrierungsDaten {
  email?: string
  vorname?: string
  nachname?: string
  token?: string
  termsAcceptedAt?: string
  termsVersion?: string
  ageConfirmedAt?: string
}
```

- [ ] **Step 2: Felder aus `daten` destrukturieren**

Ersetze:

```ts
export async function profilAnlegen(userId: string, daten: RegistrierungsDaten = {}) {
  const { email, vorname, nachname, token } = daten
```

durch:

```ts
export async function profilAnlegen(userId: string, daten: RegistrierungsDaten = {}) {
  const { email, vorname, nachname, token, termsAcceptedAt, termsVersion, ageConfirmedAt } = daten
```

- [ ] **Step 3: Beide `insert`-Aufrufe um die drei Felder erweitern**

Ersetze den ersten Insert:

```ts
  const { error } = await serviceClient.from('profiles').insert({
    id: userId,
    email: email ?? null,
    role: rolle as UserRole,
    gemeinde_id: gemeindeId,
    vorname: vorname ?? null,
    nachname: nachname ?? null,
    display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
  })
```

durch:

```ts
  const { error } = await serviceClient.from('profiles').insert({
    id: userId,
    email: email ?? null,
    role: rolle as UserRole,
    gemeinde_id: gemeindeId,
    vorname: vorname ?? null,
    nachname: nachname ?? null,
    display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
    terms_accepted_at: termsAcceptedAt ?? null,
    terms_version: termsVersion ?? null,
    age_confirmed_at: ageConfirmedAt ?? null,
  })
```

Und den Retry-Insert im `if (error.code === '23505' && email)`-Zweig:

```ts
      const { error: retryError } = await serviceClient.from('profiles').insert({
        id: userId,
        email: null,
        role: rolle as UserRole,
        gemeinde_id: gemeindeId,
        vorname: vorname ?? null,
        nachname: nachname ?? null,
        display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
      })
```

durch:

```ts
      const { error: retryError } = await serviceClient.from('profiles').insert({
        id: userId,
        email: null,
        role: rolle as UserRole,
        gemeinde_id: gemeindeId,
        vorname: vorname ?? null,
        nachname: nachname ?? null,
        display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
        terms_accepted_at: termsAcceptedAt ?? null,
        terms_version: termsVersion ?? null,
        age_confirmed_at: ageConfirmedAt ?? null,
      })
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: kein neuer TypeScript-Fehler zu `profil-anlegen.ts` (Supabase-generierte Typen in `src/types/supabase.ts` kennen die neuen Spalten noch nicht — falls der Build deswegen einen Typfehler auf den `insert`-Aufrufen wirft, `npm run db:types` ausführen, um die Typen aus der (bereits angewendeten) Migration neu zu generieren; falls die Migration noch nicht gegen die echte DB angewendet ist, ist ein Typfehler an dieser Stelle zu erwarten und wird erst nach `npm run db:types` verschwinden — das ist kein Zeichen eines Bugs in diesem Task).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profil-anlegen.ts
git commit -m "profilAnlegen: Consent-Felder beim Profil-Insert persistieren"
```

---

## Task 4: Consent-Felder durch `/auth/callback` durchreichen

**Files:**
- Modify: `src/app/auth/callback/route.ts`

- [ ] **Step 1: `regDaten` um Consent-Felder erweitern**

Ersetze:

```ts
  if (user) {
    const meta = user.user_metadata ?? {}
    const regDaten: RegistrierungsDaten = {
      vorname: meta.vorname,
      nachname: meta.nachname,
      token: meta.einladungs_token,
    }
```

durch:

```ts
  if (user) {
    const meta = user.user_metadata ?? {}
    const regDaten: RegistrierungsDaten = {
      vorname: meta.vorname,
      nachname: meta.nachname,
      token: meta.einladungs_token,
      termsAcceptedAt: meta.terms_accepted_at,
      termsVersion: meta.terms_version,
      ageConfirmedAt: meta.age_confirmed_at,
    }
```

- [ ] **Step 2: Fallback-Upsert um dieselben Felder erweitern**

Ersetze:

```ts
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: user!.id, role: 'buerger', gemeinde_id: gemeindeId, email: null }, { onConflict: 'id' })
```

durch:

```ts
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user!.id,
          role: 'buerger',
          gemeinde_id: gemeindeId,
          email: null,
          terms_accepted_at: meta.terms_accepted_at ?? null,
          terms_version: meta.terms_version ?? null,
          age_confirmed_at: meta.age_confirmed_at ?? null,
        }, { onConflict: 'id' })
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: kein neuer TypeScript-Fehler zu `auth/callback/route.ts` (gleicher Hinweis zu `db:types` wie in Task 3, Step 4).

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "auth/callback: Consent-Felder aus user_metadata an profilAnlegen durchreichen"
```

---

## Task 5: Zod-Schema für das Registrierungsformular (TDD)

**Files:**
- Create: `src/app/(auth)/login/schema.ts`
- Test: `src/app/(auth)/login/schema.test.ts`

- [ ] **Step 1: Fehlschlagenden Test schreiben**

```ts
import { describe, it, expect } from 'vitest'
import { registerFormSchema } from './schema'

const validPayload = {
  email: 'anna@example.com',
  password: 'geheim123',
  vorname: '',
  nachname: '',
  ageConfirmed: true as const,
  termsAccepted: true as const,
}

describe('registerFormSchema', () => {
  it('akzeptiert ein vollständig gültiges Formular', () => {
    const result = registerFormSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('lehnt eine ungültige E-Mail-Adresse ab', () => {
    const result = registerFormSchema.safeParse({ ...validPayload, email: 'keine-email' })
    expect(result.success).toBe(false)
  })

  it('lehnt ein leeres Passwort ab', () => {
    const result = registerFormSchema.safeParse({ ...validPayload, password: '' })
    expect(result.success).toBe(false)
  })

  it('lehnt ab, wenn die Altersbestätigung fehlt', () => {
    const result = registerFormSchema.safeParse({ ...validPayload, ageConfirmed: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Bitte bestätige, dass du mindestens 16 Jahre alt bist.')
    }
  })

  it('lehnt ab, wenn die Zustimmung zu den Nutzungsbedingungen fehlt', () => {
    const result = registerFormSchema.safeParse({ ...validPayload, termsAccepted: false })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Bitte akzeptiere die Nutzungsbedingungen und nimm die Datenschutzerklärung zur Kenntnis.')
    }
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/\(auth\)/login/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'` (Datei existiert noch nicht).

- [ ] **Step 3: Schema implementieren**

```ts
import { z } from 'zod'

export const registerFormSchema = z.object({
  email: z.string().email('Bitte gültige E-Mail-Adresse eingeben'),
  password: z.string().min(1, 'Bitte Passwort eingeben'),
  vorname: z.string().optional(),
  nachname: z.string().optional(),
  ageConfirmed: z.literal(true, { message: 'Bitte bestätige, dass du mindestens 16 Jahre alt bist.' }),
  termsAccepted: z.literal(true, { message: 'Bitte akzeptiere die Nutzungsbedingungen und nimm die Datenschutzerklärung zur Kenntnis.' }),
})

export type RegisterFormValues = z.infer<typeof registerFormSchema>
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/app/\(auth\)/login/schema.test.ts`
Expected: PASS (5 Tests grün)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/login/schema.ts" "src/app/(auth)/login/schema.test.ts"
git commit -m "Zod-Schema für Registrierungsformular inkl. Pflicht-Checkboxen"
```

---

## Task 6: `RegisterForm`-Komponente

**Files:**
- Create: `src/app/(auth)/login/RegisterForm.tsx`

- [ ] **Step 1: Komponente schreiben**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TERMS_VERSION } from '@/lib/constants'
import { registerFormSchema, type RegisterFormValues } from './schema'

export interface EinladungsInfo {
  email: string
  rolle: string
  organisation_name: string | null
  gemeinde_name: string
}

interface RegisterFormProps {
  einladungsToken: string | null
  einladungsInfo: EinladungsInfo | null
  onRegistered: () => void
}

export default function RegisterForm({ einladungsToken, einladungsInfo, onRegistered }: RegisterFormProps) {
  const [showOptional, setShowOptional] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const supabase = createClient()

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: einladungsInfo?.email ?? '',
      password: '',
      vorname: '',
      nachname: '',
      ageConfirmed: false,
      termsAccepted: false,
    },
  })

  useEffect(() => {
    if (einladungsInfo?.email) form.setValue('email', einladungsInfo.email)
  }, [einladungsInfo, form])

  async function onSubmit(values: RegisterFormValues) {
    setSubmitError('')
    const now = new Date().toISOString()
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          vorname: values.vorname || undefined,
          nachname: values.nachname || undefined,
          einladungs_token: einladungsToken || undefined,
          age_confirmed_at: now,
          terms_accepted_at: now,
          terms_version: TERMS_VERSION,
        },
      },
    })
    if (error) {
      setSubmitError(error.message.includes('already registered') ? 'E-Mail bereits registriert' : error.message)
      return
    }
    onRegistered()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div>
        <label htmlFor="register-email" className="sr-only">E-Mail-Adresse</label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          readOnly={!!einladungsInfo}
          placeholder="E-Mail-Adresse"
          className={`w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 ${einladungsInfo ? 'bg-gray-50 text-gray-500' : ''}`}
          aria-invalid={!!form.formState.errors.email}
          aria-describedby={form.formState.errors.email ? 'register-email-error' : undefined}
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p role="alert" id="register-email-error" className="text-red-500 text-xs mt-1">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="register-password" className="sr-only">Passwort</label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="Passwort"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-invalid={!!form.formState.errors.password}
          aria-describedby={form.formState.errors.password ? 'register-password-error' : undefined}
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p role="alert" id="register-password-error" className="text-red-500 text-xs mt-1">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowOptional(v => !v)}
          className="flex items-center gap-2 text-sm text-primary-500 font-medium py-1"
          aria-expanded={showOptional}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-180' : ''}`} />
          Weitere Angaben (optional)
        </button>

        {showOptional && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label htmlFor="register-vorname" className="sr-only">Vorname</label>
              <input
                id="register-vorname"
                type="text"
                autoComplete="given-name"
                placeholder="Vorname"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...form.register('vorname')}
              />
            </div>
            <div>
              <label htmlFor="register-nachname" className="sr-only">Nachname</label>
              <input
                id="register-nachname"
                type="text"
                autoComplete="family-name"
                placeholder="Nachname"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...form.register('nachname')}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="register-age-confirmed"
            type="checkbox"
            className="w-4 h-4 mt-0.5 text-primary-500 rounded focus:ring-primary-500"
            aria-invalid={!!form.formState.errors.ageConfirmed}
            aria-describedby={form.formState.errors.ageConfirmed ? 'register-age-confirmed-error' : undefined}
            {...form.register('ageConfirmed')}
          />
          <label htmlFor="register-age-confirmed" className="text-sm text-gray-700">
            Ich bin mindestens 16 Jahre alt.
          </label>
        </div>
        {form.formState.errors.ageConfirmed && (
          <p role="alert" id="register-age-confirmed-error" className="text-red-500 text-xs mt-1">
            {form.formState.errors.ageConfirmed.message}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="register-terms-accepted"
            type="checkbox"
            className="w-4 h-4 mt-0.5 text-primary-500 rounded focus:ring-primary-500"
            aria-invalid={!!form.formState.errors.termsAccepted}
            aria-describedby={form.formState.errors.termsAccepted ? 'register-terms-accepted-error' : undefined}
            {...form.register('termsAccepted')}
          />
          <label htmlFor="register-terms-accepted" className="text-sm text-gray-700">
            Ich akzeptiere die{' '}
            <a href="/nutzungsbedingungen" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
              Nutzungsbedingungen
            </a>{' '}
            und habe die{' '}
            <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
              Datenschutzerklärung
            </a>{' '}
            zur Kenntnis genommen.
          </label>
        </div>
        {form.formState.errors.termsAccepted && (
          <p role="alert" id="register-terms-accepted-error" className="text-red-500 text-xs mt-1">
            {form.formState.errors.termsAccepted.message}
          </p>
        )}
      </div>

      {submitError && (
        <p role="alert" className="text-red-500 text-sm">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        {form.formState.isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
        Konto erstellen
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: kein TypeScript-Fehler zu `RegisterForm.tsx` (Task 7 muss zuerst abgeschlossen sein, da `page.tsx` sonst noch den alten, jetzt widersprüchlichen Code enthält — falls Task 7 noch nicht gemacht ist, hier nur auf Fehler *innerhalb* von `RegisterForm.tsx` achten, `page.tsx`-Fehler werden in Task 7 behoben).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/login/RegisterForm.tsx"
git commit -m "RegisterForm-Komponente mit react-hook-form + zod und Pflicht-Checkboxen"
```

---

## Task 7: `RegisterForm` in `login/page.tsx` integrieren

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Import anpassen**

Ersetze:

```ts
import { ArrowRight, Loader2, ChevronDown, Mail } from 'lucide-react'
import { Logo } from '@/components/ui'
```

durch:

```ts
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { Logo } from '@/components/ui'
import RegisterForm, { type EinladungsInfo } from './RegisterForm'
```

- [ ] **Step 2: Lokale `EinladungsInfo`-Interface-Definition entfernen**

Entferne (wird jetzt aus `./RegisterForm` importiert):

```ts
interface EinladungsInfo {
  email: string
  rolle: string
  organisation_name: string | null
  gemeinde_name: string
}
```

- [ ] **Step 3: Nicht mehr benötigten State entfernen**

Ersetze:

```ts
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [loading, setLoading] = useState(false)
```

durch:

```ts
  const [loading, setLoading] = useState(false)
```

- [ ] **Step 4: `submit()` — Register-Zweig entfernen**

Ersetze:

```ts
  async function submit() {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        let profile = await supabase
          .from('profiles')
          .select('role, gemeinden(slug)')
          .eq('id', data.user?.id ?? '')
          .single()
          .then(r => r.data)

        // Kein Profil: Auth-Callback schlug fehl (PKCE-Fehler), Profil jetzt nachholen
        if (!profile) {
          const res = await fetch('/api/setup-profil', { method: 'POST' })
          if (res.ok) {
            const { slug: gemeindeSlug } = await res.json() as { slug?: string }
            const targetHost = gemeindeSlug ? `${gemeindeSlug}.dorfly.de` : null
            if (targetHost && window.location.hostname !== targetHost) {
              window.location.href = `https://${targetHost}/home`
            } else {
              router.push('/home')
              router.refresh()
            }
            return
          }
          // setup-profil fehlgeschlagen: trotzdem weiterleiten, App-Middleware fängt ab
          profile = await supabase
            .from('profiles')
            .select('role, gemeinden(slug)')
            .eq('id', data.user?.id ?? '')
            .single()
            .then(r => r.data)
        }

        if ((profile as { role?: string } | null)?.role === 'super_admin') {
          router.push('/admin/dashboard')
          router.refresh()
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const slug = (profile as any)?.gemeinden?.slug as string | undefined
          const currentHost = window.location.hostname
          if (slug && currentHost !== `${slug}.dorfly.de`) {
            window.location.href = `https://${slug}.dorfly.de/home`
          } else {
            router.push('/home')
            router.refresh()
          }
        }
        return
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Redirect zur aktuellen Subdomain statt zur konfigurierten Site URL
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            // Registrierungsdaten in user_metadata – funktioniert domain-übergreifend
            data: {
              vorname: vorname || undefined,
              nachname: nachname || undefined,
              einladungs_token: einladungsToken || undefined,
            },
          },
        })
        if (error) throw error

        setRegistered(true)
        return
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      if (msg.includes('Invalid login')) setError('E-Mail oder Passwort falsch')
      else if (msg.includes('already registered')) setError('E-Mail bereits registriert')
      else if (msg.includes('email_not_confirmed') || msg.includes('Email not confirmed')) setError('email_not_confirmed')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }
```

durch:

```ts
  async function submit() {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        let profile = await supabase
          .from('profiles')
          .select('role, gemeinden(slug)')
          .eq('id', data.user?.id ?? '')
          .single()
          .then(r => r.data)

        // Kein Profil: Auth-Callback schlug fehl (PKCE-Fehler), Profil jetzt nachholen
        if (!profile) {
          const res = await fetch('/api/setup-profil', { method: 'POST' })
          if (res.ok) {
            const { slug: gemeindeSlug } = await res.json() as { slug?: string }
            const targetHost = gemeindeSlug ? `${gemeindeSlug}.dorfly.de` : null
            if (targetHost && window.location.hostname !== targetHost) {
              window.location.href = `https://${targetHost}/home`
            } else {
              router.push('/home')
              router.refresh()
            }
            return
          }
          // setup-profil fehlgeschlagen: trotzdem weiterleiten, App-Middleware fängt ab
          profile = await supabase
            .from('profiles')
            .select('role, gemeinden(slug)')
            .eq('id', data.user?.id ?? '')
            .single()
            .then(r => r.data)
        }

        if ((profile as { role?: string } | null)?.role === 'super_admin') {
          router.push('/admin/dashboard')
          router.refresh()
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const slug = (profile as any)?.gemeinden?.slug as string | undefined
          const currentHost = window.location.hostname
          if (slug && currentHost !== `${slug}.dorfly.de`) {
            window.location.href = `https://${slug}.dorfly.de/home`
          } else {
            router.push('/home')
            router.refresh()
          }
        }
        return
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      if (msg.includes('Invalid login')) setError('E-Mail oder Passwort falsch')
      else if (msg.includes('email_not_confirmed') || msg.includes('Email not confirmed')) setError('email_not_confirmed')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }
```

(Der `mode === 'forgot'`-Fall lief hier vorher fälschlich in den `else`-Zweig und rief `signUp` auf — ein vorbestehender Bug, der durch das Entfernen des Registrierungs-Zweigs zwangsläufig mit behoben wird: der Klick auf den (in `forgot`-Modus ohnehin fehlplatzierten) Button ist jetzt ein No-op statt einer versehentlichen Registrierung.)

- [ ] **Step 5: Register-Zweig aus der Tab-Reset-Funktion entfernen**

Ersetze:

```tsx
              onClick={() => { setMode(m); setError(''); setShowOptional(false) }}
```

durch:

```tsx
              onClick={() => { setMode(m); setError('') }}
```

- [ ] **Step 6: JSX-Block ersetzen — gemeinsame Inputs, Register-Zweig, Consent-Text, Submit-Button**

Ersetze den kompletten Block von der optionalen-Felder-Sektion bis zum Ende des Consent-Absatzes:

```tsx
          {/* Optionale Felder nur bei Registrierung */}
          {mode === 'register' && (
            <div>
              <button
                type="button"
                onClick={() => setShowOptional(v => !v)}
                className="flex items-center gap-2 text-sm text-primary-500 font-medium py-1"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-180' : ''}`} />
                Weitere Angaben (optional)
              </button>

              {showOptional && (
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="register-vorname" className="sr-only">Vorname</label>
                      <input
                        id="register-vorname"
                        type="text"
                        value={vorname}
                        onChange={e => setVorname(e.target.value)}
                        placeholder="Vorname"
                        autoComplete="given-name"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="register-nachname" className="sr-only">Nachname</label>
                      <input
                        id="register-nachname"
                        type="text"
                        value={nachname}
                        onChange={e => setNachname(e.target.value)}
                        placeholder="Nachname"
                        autoComplete="family-name"
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {infoMsg === 'email_confirmed' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
              <p className="text-amber-800 font-medium">Bestätigungslink in anderem Browser geöffnet</p>
              <p className="text-amber-700 mt-1">
                Melde dich direkt mit deiner E-Mail und deinem Passwort an — oder fordere einen neuen Bestätigungslink an.
              </p>
              {resendSent ? (
                <p className="text-green-700 mt-2 font-medium">Neue E-Mail gesendet!</p>
              ) : (
                <button
                  onClick={resendConfirmation}
                  disabled={!email || loading}
                  className="mt-2 text-amber-900 underline font-medium disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {loading ? 'Sende...' : 'Neuen Bestätigungslink senden'}
                </button>
              )}
            </div>
          ) : error === 'email_not_confirmed' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
              <p className="text-amber-800 font-medium">E-Mail noch nicht bestätigt</p>
              <p className="text-amber-700 mt-1">
                Bitte klicke auf den Link in der Bestätigungs-E-Mail.
                {!email && <> <strong>Gib deine E-Mail-Adresse oben ein</strong> um eine neue anzufordern.</>}
              </p>
              {resendSent ? (
                <p className="text-green-700 mt-2 font-medium">E-Mail erneut gesendet!</p>
              ) : (
                <button
                  onClick={resendConfirmation}
                  disabled={!email || loading}
                  className="mt-2 text-amber-900 underline font-medium disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {loading ? 'Sende...' : 'Bestätigungs-E-Mail erneut senden'}
                </button>
              )}
            </div>
          ) : error ? (
            <p role="alert" className="text-red-500 text-sm">{error}</p>
          ) : null}

          <button
            onClick={submit}
            disabled={loading || !email || !password}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError('') }}
              className="w-full text-center text-sm text-gray-400 hover:text-primary-500 transition-colors pt-1"
            >
              Passwort vergessen?
            </button>
          )}

          {mode === 'register' && (
            <p className="text-xs text-gray-400 text-center leading-relaxed pt-1">
              Mit dem Erstellen eines Kontos stimmst du unserer{' '}
              <a href="/datenschutz" className="text-primary-500 hover:underline">Datenschutzerklärung</a>
              {' '}zu.
            </p>
          )}
        </div>
```

durch:

```tsx
          {mode === 'register' ? (
            <RegisterForm
              einladungsToken={einladungsToken}
              einladungsInfo={einladungsInfo}
              onRegistered={() => setRegistered(true)}
            />
          ) : (
            <>
              {infoMsg === 'email_confirmed' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                  <p className="text-amber-800 font-medium">Bestätigungslink in anderem Browser geöffnet</p>
                  <p className="text-amber-700 mt-1">
                    Melde dich direkt mit deiner E-Mail und deinem Passwort an — oder fordere einen neuen Bestätigungslink an.
                  </p>
                  {resendSent ? (
                    <p className="text-green-700 mt-2 font-medium">Neue E-Mail gesendet!</p>
                  ) : (
                    <button
                      onClick={resendConfirmation}
                      disabled={!email || loading}
                      className="mt-2 text-amber-900 underline font-medium disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      {loading ? 'Sende...' : 'Neuen Bestätigungslink senden'}
                    </button>
                  )}
                </div>
              ) : error === 'email_not_confirmed' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                  <p className="text-amber-800 font-medium">E-Mail noch nicht bestätigt</p>
                  <p className="text-amber-700 mt-1">
                    Bitte klicke auf den Link in der Bestätigungs-E-Mail.
                    {!email && <> <strong>Gib deine E-Mail-Adresse oben ein</strong> um eine neue anzufordern.</>}
                  </p>
                  {resendSent ? (
                    <p className="text-green-700 mt-2 font-medium">E-Mail erneut gesendet!</p>
                  ) : (
                    <button
                      onClick={resendConfirmation}
                      disabled={!email || loading}
                      className="mt-2 text-amber-900 underline font-medium disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      {loading ? 'Sende...' : 'Bestätigungs-E-Mail erneut senden'}
                    </button>
                  )}
                </div>
              ) : error ? (
                <p role="alert" className="text-red-500 text-sm">{error}</p>
              ) : null}

              <button
                onClick={submit}
                disabled={loading || !email || !password}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                Anmelden
              </button>

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError('') }}
                  className="w-full text-center text-sm text-gray-400 hover:text-primary-500 transition-colors pt-1"
                >
                  Passwort vergessen?
                </button>
              )}
            </>
          )}
        </div>
```

Hinweis: Die gemeinsamen E-Mail-/Passwort-Inputs (Zeilen davor, `id="login-email"` / `id="login-password"`) bleiben unverändert bestehen — sie werden weiterhin für `login` und `forgot` gebraucht (der Reset-Versand nutzt den gemeinsamen `email`-State). Nur der Registrierungs-Fall zeigt jetzt `RegisterForm` statt dieser Inputs zu verwenden; da `RegisterForm` seine eigenen E-Mail-/Passwort-Felder mit eigenen IDs (`register-email`, `register-password`) rendert, gibt es keine doppelten `id`-Werte im DOM (die beiden Zweige sind nie gleichzeitig gemountet).

**Bewusst nicht geändert:** Die gemeinsamen `id="login-email"`/`id="login-password"`-Inputs werden weiterhin unconditional oberhalb dieses Blocks gerendert (auch im `register`-Modus unsichtbar im DOM vorhanden zu lassen wäre inkorrekt) — falls beim Review auffällt, dass diese Inputs auch im `register`-Modus noch sichtbar sind, mit `{mode !== 'register' && (...)}` umschließen. Prüfe das explizit in Step 7.

- [ ] **Step 7: Gemeinsame E-Mail-/Passwort-Inputs auf `login`/`forgot` beschränken**

Suche im Datei-Diff nach dem JSX-Block, der `id="login-email"` und `id="login-password"` enthält (direkt vor dem in Step 6 ersetzten Block). Umschließe genau diese beiden `<div>`-Felder (nicht mehr, nicht weniger) mit einer Bedingung, damit sie im `register`-Modus nicht mehr gerendert werden:

Ersetze:

```tsx
        <div className="space-y-3">
          <div>
            <label htmlFor="login-email" className="sr-only">E-Mail-Adresse</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="E-Mail-Adresse"
              autoComplete="email"
              readOnly={!!einladungsInfo}
              className={`w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 ${einladungsInfo ? 'bg-gray-50 text-gray-500' : ''}`}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="sr-only">Passwort</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Passwort"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
```

durch:

```tsx
        <div className="space-y-3">
          {mode !== 'register' && (
            <>
              <div>
                <label htmlFor="login-email" className="sr-only">E-Mail-Adresse</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="E-Mail-Adresse"
                  autoComplete="email"
                  readOnly={!!einladungsInfo}
                  className={`w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 ${einladungsInfo ? 'bg-gray-50 text-gray-500' : ''}`}
                />
              </div>
              <div>
                <label htmlFor="login-password" className="sr-only">Passwort</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Passwort"
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyDown={e => e.key === 'Enter' && submit()}
                />
              </div>
            </>
          )}
```

(`autoComplete` vereinfacht zu `'current-password'`, da dieser Input jetzt nur noch im `login`-Zweig sichtbar ist — `forgot` zeigt ihn zwar technisch auch noch, dort ist das Attribut irrelevant, `register` hat sein eigenes `new-password`-Feld in `RegisterForm`.)

- [ ] **Step 8: Typecheck**

Run: `npm run build`
Expected: Build erfolgreich, keine TypeScript-Fehler in `page.tsx` oder `RegisterForm.tsx` (unbenutzte Imports wie `ChevronDown` dürfen in `page.tsx` nicht mehr vorkommen — Step 1 hat das bereits entfernt).

- [ ] **Step 9: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "Registrierungsformular: Register-Zweig auf RegisterForm (react-hook-form+zod) umgestellt"
```

---

## Task 8: `/nutzungsbedingungen`-Seite

**Files:**
- Create: `src/app/nutzungsbedingungen/page.tsx`

- [ ] **Step 1: Seite schreiben**

```tsx
import { Logo } from '@/components/ui'

export const metadata = {
  title: 'Nutzungsbedingungen — Dorfly',
}

const C = {
  navy:   '#0D1B2A',
  blue:   '#0057A8',
  green:  '#00A878',
  bg:     '#F4F7FB',
  muted:  '#64748B',
  border: '#DDE6F0',
  white:  '#ffffff',
} as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 18, fontWeight: 700, color: C.navy,
        marginBottom: 12, paddingBottom: 8,
        borderBottom: `2px solid ${C.border}`,
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: C.navy, lineHeight: 1.7, marginBottom: 10, fontSize: 15 }}>
      {children}
    </p>
  )
}

export default function NutzungsbedingungenPage() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${C.border}`, padding: '0 24px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center' }}>
          <Logo />
        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: C.navy, marginBottom: 8 }}>
          Nutzungsbedingungen Dorfly
        </h1>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 40 }}>
          Stand: 22.7.2026, Version 1.0
        </p>

        <Section title="§ 1 Geltungsbereich und Vertragspartner">
          <P>(1) Diese Nutzungsbedingungen regeln die Nutzung der Kommunikationsplattform Dorfly (nachfolgend „Plattform") durch registrierte Nutzerinnen und Nutzer.</P>
          <P>(2) Betreiberin der Plattform und Vertragspartnerin der Nutzerinnen und Nutzer ist die Dorfly UG (haftungsbeschränkt) i.G., Goldregenweg 15, 71139 Ehningen (nachfolgend „Betreiberin").</P>
          <P>(3) Die Plattform wird jeweils für eine bestimmte Gemeinde bereitgestellt. Die jeweilige Gemeinde ist für die amtlichen und redaktionellen Inhalte ihres Bereichs verantwortlich und benennt hierfür eine verantwortliche Person im Sinne des § 18 Medienstaatsvertrag. Die Betreiberin stellt ausschließlich die technische Plattform zur Verfügung.</P>
          <P>(4) Es gelten diese Nutzungsbedingungen in ihrer bei Vertragsschluss gültigen Fassung.</P>
        </Section>

        <Section title="§ 2 Leistungsbeschreibung">
          <P>(1) Die Plattform ermöglicht die lokale Kommunikation zwischen der Gemeinde, ihrer Bürgerschaft, ihren Vereinen, ihren Gewerbetreibenden und weiteren örtlichen Akteuren. Sie umfasst je nach Freischaltung durch die Gemeinde insbesondere Nachrichten und Beiträge, den Mängelmelder, die Funktion „Frag den Bürgermeister", Umfragen, das Gemeinderat-Feature, lokale Angebote, den Abfallkalender, Vereinsfunktionen, Warnmeldungen sowie Push-Benachrichtigungen.</P>
          <P>(2) Welche Funktionen im Einzelfall verfügbar sind, entscheidet die jeweilige Gemeinde. Ein Anspruch auf einen bestimmten Funktionsumfang besteht nicht.</P>
        </Section>

        <Section title="§ 3 Registrierung und Nutzerkonto">
          <P>(1) Die Nutzung von Beitrags- und Interaktionsfunktionen setzt eine Registrierung voraus. Bei der Registrierung sind wahrheitsgemäße Angaben zu machen.</P>
          <P>(2) Die Registrierung ist Personen ab 16 Jahren gestattet.</P>
          <P>(3) Die Zugangsdaten sind vertraulich zu behandeln und dürfen nicht an Dritte weitergegeben werden. Bei Verdacht auf Missbrauch ist die Betreiberin unverzüglich zu informieren.</P>
          <P>(4) Ein Anspruch auf Registrierung besteht nicht. Die Betreiberin und die jeweilige Gemeinde können die Freischaltung aus sachlichem Grund verweigern.</P>
        </Section>

        <Section title="§ 4 Rollen und Berechtigungen">
          <P>(1) Die Plattform unterscheidet verschiedene Rollen mit unterschiedlichen Rechten, insbesondere Bürgerinnen und Bürger, Organisationen (Vereine und Gewerbe), Verwaltung sowie Gemeinderat.</P>
          <P>(2) Der Umfang der Berechtigungen richtet sich nach der zugewiesenen Rolle. Die Zuweisung erfolgt durch die jeweilige Gemeinde oder die Betreiberin.</P>
        </Section>

        <Section title="§ 5 Verhaltensregeln für alle Nutzerinnen und Nutzer">
          <P>(1) Der Umgang auf der Plattform ist von gegenseitigem Respekt und einem sachlichen Ton getragen. Beiträge und Kommentare sind höflich und angemessen zu formulieren.</P>
          <P>(2) Untersagt sind insbesondere: Beleidigungen, Herabwürdigungen und persönliche Angriffe. Aufrufe zu Gewalt sowie hetzerische, diskriminierende oder volksverhetzende Inhalte. Rechtswidrige Inhalte jeder Art. Die Verbreitung falscher Tatsachenbehauptungen. Die Veröffentlichung personenbezogener Daten Dritter ohne deren Einwilligung. Werbung außerhalb der dafür vorgesehenen Bereiche sowie Spam. Die Verletzung von Urheber-, Marken- oder sonstigen Schutzrechten. Missbräuchliche oder wahrheitswidrige Meldungen, insbesondere im Mängelmelder und bei Warnmeldungen.</P>
          <P>(3) Die Nutzerinnen und Nutzer stellen sicher, dass sie zur Veröffentlichung der von ihnen eingestellten Inhalte berechtigt sind.</P>
        </Section>

        <Section title="§ 6 Zusätzliche Pflichten institutioneller Autoren">
          <P>(1) Für Beiträge von Verwaltung, Gemeinderat, Vereinen und Gewerbe gelten über die Verhaltensregeln nach § 5 hinaus die redaktionellen Grundsätze der jeweiligen Gemeinde für ihre amtliche und lokale Kommunikation.</P>
          <P>(2) Soweit die jeweilige Gemeinde ein schriftliches Redaktionsstatut oder vergleichbare redaktionelle Richtlinien führt und diese den betreffenden Autoren zugänglich macht, gelten diese für deren Beiträge entsprechend.</P>
          <P>(3) Institutionelle Autoren tragen die inhaltliche Verantwortung für ihre Beiträge selbst. Sie beachten die für sie geltenden rechtlichen Vorgaben, insbesondere das Gebot der Sachlichkeit und, soweit einschlägig, die Grenzen zulässiger kommunaler Öffentlichkeitsarbeit.</P>
        </Section>

        <Section title="§ 7 Verantwortlichkeit für Inhalte">
          <P>(1) Für von Nutzerinnen und Nutzern eingestellte Inhalte ist die jeweils einstellende Person verantwortlich. Diese Inhalte geben nicht die Auffassung der Betreiberin oder der Gemeinde wieder.</P>
          <P>(2) Die Betreiberin macht sich fremde Inhalte nicht zu eigen. Ihre Haftung für fremde Inhalte richtet sich nach der gesetzlichen Haftungsprivilegierung für Diensteanbieter nach dem Digitale-Dienste-Gesetz und dem Digital Services Act.</P>
        </Section>

        <Section title="§ 8 Rechte an Inhalten">
          <P>(1) Die Rechte an eigenen Inhalten verbleiben bei der jeweiligen Nutzerin oder dem jeweiligen Nutzer.</P>
          <P>(2) Mit dem Einstellen räumt die Nutzerin oder der Nutzer der Betreiberin und der jeweiligen Gemeinde das einfache, räumlich und zeitlich auf den Betrieb der Plattform beschränkte Recht ein, die Inhalte im Rahmen der Plattform zu speichern, anzuzeigen und technisch zu verarbeiten. Eine darüber hinausgehende Nutzung erfolgt nicht.</P>
          <P>(3) Das Nutzungsrecht endet mit der Löschung des jeweiligen Inhalts, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</P>
        </Section>

        <Section title="§ 9 Moderation, Sperrung und Entfernung von Inhalten">
          <P>(1) Die Betreiberin und die jeweilige Gemeinde sind berechtigt, Inhalte, die gegen diese Nutzungsbedingungen oder gegen geltendes Recht verstoßen, zu entfernen oder zu sperren.</P>
          <P>(2) Bei wiederholten oder schwerwiegenden Verstößen können Nutzerkonten vorübergehend oder dauerhaft gesperrt werden. Die betroffene Person wird über die Maßnahme informiert, soweit dem keine rechtlichen Gründe entgegenstehen.</P>
          <P>(3) Eine Vorabprüfung sämtlicher Inhalte findet nicht statt. Die Prüfung erfolgt nach Kenntniserlangung, insbesondere aufgrund von Meldungen.</P>
        </Section>

        <Section title="§ 10 Verfügbarkeit">
          <P>Die Betreiberin bemüht sich um eine hohe Verfügbarkeit der Plattform. Ein Anspruch auf ununterbrochene Verfügbarkeit besteht nicht. Wartungsarbeiten, Störungen und Umstände außerhalb des Einflussbereichs der Betreiberin können die Nutzung vorübergehend einschränken.</P>
        </Section>

        <Section title="§ 11 Haftung">
          <P>(1) Die Betreiberin haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit.</P>
          <P>(2) Bei einfacher Fahrlässigkeit haftet die Betreiberin nur bei Verletzung einer wesentlichen Vertragspflicht und begrenzt auf den vertragstypischen, vorhersehbaren Schaden.</P>
          <P>(3) Im Übrigen ist die Haftung ausgeschlossen. Die Haftung nach dem Produkthaftungsgesetz bleibt unberührt.</P>
        </Section>

        <Section title="§ 12 Datenschutz">
          <P>Die Verarbeitung personenbezogener Daten richtet sich nach der Datenschutzerklärung der jeweiligen Gemeinde, die über die Plattform abrufbar ist.</P>
        </Section>

        <Section title="§ 13 Laufzeit, Kündigung und Kontolöschung">
          <P>(1) Das Nutzungsverhältnis wird auf unbestimmte Zeit geschlossen und kann von der Nutzerin oder dem Nutzer jederzeit ohne Angabe von Gründen beendet werden.</P>
          <P>(2) Die Löschung des Kontos ist innerhalb der Plattform selbst möglich, unter „Mein Profil, Datenschutz und Daten, Konto löschen".</P>
          <P>(3) Die Betreiberin kann das Nutzungsverhältnis unter Wahrung einer angemessenen Frist kündigen. Das Recht zur außerordentlichen Kündigung und zur Sperrung nach § 9 bleibt unberührt.</P>
        </Section>

        <Section title="§ 14 Änderungen der Nutzungsbedingungen">
          <P>Die Betreiberin kann diese Nutzungsbedingungen mit Wirkung für die Zukunft ändern, soweit dies aus sachlichem Grund erforderlich ist. Über wesentliche Änderungen werden die Nutzerinnen und Nutzer rechtzeitig informiert. Widerspricht die Nutzerin oder der Nutzer nicht innerhalb einer angemessenen Frist, gelten die geänderten Bedingungen als angenommen. Auf das Widerspruchsrecht und die Folgen wird bei der Information gesondert hingewiesen.</P>
        </Section>

        <Section title="§ 15 Schlussbestimmungen">
          <P>(1) Es gilt das Recht der Bundesrepublik Deutschland.</P>
          <P>(2) Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</P>
        </Section>

        <div style={{
          marginTop: 48, padding: '16px 20px', borderRadius: 10,
          background: C.white, border: `1px solid ${C.border}`,
          display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <a href="/datenschutz" style={{ color: C.blue, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            → Datenschutzerklärung
          </a>
          <a href="/impressum" style={{ color: C.blue, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            → Impressum
          </a>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: Build erfolgreich, `/nutzungsbedingungen` erscheint in der Routen-Übersicht der Build-Ausgabe.

- [ ] **Step 3: Commit**

```bash
git add src/app/nutzungsbedingungen/page.tsx
git commit -m "Öffentliche Nutzungsbedingungen-Seite hinzufügen"
```

---

## Task 9: Route öffentlich zugänglich machen

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: `PUBLIC_ROUTES` erweitern**

Ersetze:

```ts
const PUBLIC_ROUTES = ['/login', '/start', '/homepage', '/posts/', '/api/', '/auth/', '/datenschutz', '/impressum', '/support']
```

durch:

```ts
const PUBLIC_ROUTES = ['/login', '/start', '/homepage', '/posts/', '/api/', '/auth/', '/datenschutz', '/impressum', '/nutzungsbedingungen', '/support']
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "/nutzungsbedingungen zu PUBLIC_ROUTES hinzufügen"
```

---

## Task 10: Footer-Link

**Files:**
- Modify: `src/app/homepage/page.tsx`

- [ ] **Step 1: Link-Array im `Footer()` erweitern**

Ersetze:

```tsx
          {[
            { label: 'Impressum',     href: '/impressum'       },
            { label: 'Datenschutz',   href: '/datenschutz'     },
            { label: 'Für Gemeinden', href: '#zielgruppen'     },
            { label: 'Kontakt',       href: 'mailto:hallo@dorfly.de' },
          ].map(({ label, href }) => (
```

durch:

```tsx
          {[
            { label: 'Impressum',            href: '/impressum'            },
            { label: 'Datenschutz',          href: '/datenschutz'          },
            { label: 'Nutzungsbedingungen',  href: '/nutzungsbedingungen'  },
            { label: 'Für Gemeinden',        href: '#zielgruppen'          },
            { label: 'Kontakt',              href: 'mailto:hallo@dorfly.de' },
          ].map(({ label, href }) => (
```

- [ ] **Step 2: Commit**

```bash
git add src/app/homepage/page.tsx
git commit -m "Footer: Link zu Nutzungsbedingungen ergänzen"
```

---

## Task 11: Gesamtverifikation

**Files:** keine (Verifikation)

- [ ] **Step 1: Vollständigen Testlauf ausführen**

Run: `npm run test`
Expected: alle Tests grün, inkl. der neuen `schema.test.ts`.

- [ ] **Step 2: Production-Build ausführen**

Run: `npm run build`
Expected: Build erfolgreich, keine TypeScript-/ESLint-Fehler. Falls hier Fehler zu fehlenden `terms_accepted_at`/`terms_version`/`age_confirmed_at`-Spalten in den generierten Supabase-Typen auftreten: Migration 056 gegen die Datenbank anwenden (Supabase Dashboard oder `supabase db push`, außerhalb dieses Plans) und danach `npm run db:types` ausführen, um `src/types/supabase.ts` zu regenerieren.

- [ ] **Step 3: Manuelle Verifikation im Browser**

Run: `npm run dev`

- `/nutzungsbedingungen` aufrufen: Seite lädt, zeigt alle 15 §§, Cross-Links zu Datenschutz/Impressum funktionieren, Überschriftenhierarchie (h1 → h2) mit Screenreader/DevTools-Accessibility-Baum prüfen.
- Footer auf `/homepage` (bzw. Root-Domain): Link „Nutzungsbedingungen" vorhanden und führt zur neuen Seite.
- `/login` → Tab „Registrieren": beide Checkboxen initial nicht angehakt; Formular ohne Häkchen absenden → zwei separate Fehlermeldungen unter den jeweiligen Checkboxen, kein `signUp`-Aufruf (Netzwerk-Tab prüfen); nur eine Checkbox anhaken → weiterhin Fehler bei der anderen; beide anhaken + gültige Daten → Registrierung läuft durch (E-Mail-Bestätigungsscreen erscheint). Tab-Reihenfolge/Tastaturbedienung der Checkboxen und Links im zweiten Label mit Tastatur (Tab, Space) prüfen.
- Nach Klick auf den Bestätigungslink (bzw. durch Prüfung der `profiles`-Zeile im Supabase-Dashboard nach einem Test-Signup): `terms_accepted_at`, `terms_version` (`1.0`), `age_confirmed_at` sind gesetzt.

- [ ] **Step 4: Finalen Verifikations-Commit falls nötig**

Falls in Schritt 3 manuelle Korrekturen nötig waren, diese in einem eigenen Commit festhalten.

---

## Offene Punkte / Nicht in Scope

(unverändert aus der Spec — siehe `docs/superpowers/specs/2026-07-22-nutzungsbedingungen-und-registrierung-checkboxen-design.md`)
