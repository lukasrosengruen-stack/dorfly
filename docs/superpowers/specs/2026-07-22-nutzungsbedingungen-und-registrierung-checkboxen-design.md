# Nutzungsbedingungen-Seite & Pflicht-Checkboxen bei Registrierung — Design-Spec

**Datum:** 2026-07-22
**Status:** Approved

---

## Überblick

Zwei zusammenhängende Aufgaben:

1. Eine öffentliche `/nutzungsbedingungen`-Seite, analog zu `/datenschutz` und `/impressum`.
2. Zwei getrennte Pflicht-Checkboxen im Registrierungsformular (Altersbestätigung, Zustimmung zu Nutzungsbedingungen/Datenschutz), deren Zustimmung mit Zeitstempel und Versionsnummer am Profil gespeichert wird.

Das bestehende Registrierungsformular (`src/app/(auth)/login/page.tsx`) ist aktuell ein `useState`-Formular, nicht `react-hook-form` + `zod`, obwohl CLAUDE.md das für alle Formulare vorschreibt. Entscheidung: **nur der Register-Zweig** wird in eine eigene Komponente mit `react-hook-form` + `zod` ausgelagert; Login/Passwort-vergessen bleiben unverändert.

---

## Aufgabe 1: `/nutzungsbedingungen`-Seite

### Seite

Neue Datei `src/app/nutzungsbedingungen/page.tsx` — Server Component (kein `'use client'`), Struktur identisch zu `src/app/datenschutz/page.tsx` / `src/app/impressum/page.tsx`:

- Lokales Farbkonstanten-Objekt `C` (gleiche Werte wie in den bestehenden Seiten, copy-paste — dem bestehenden Muster folgend, kein gemeinsames Modul).
- Lokale Helper-Komponenten `Section({ title, children })`, `P({ children })`.
- Sticky `<nav>` mit `<Logo />`, `<main style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>`.
- `<h1>` „Nutzungsbedingungen Dorfly", Untertitel „Stand: 22.7.2026, Version 1.0".
- 15 `<Section>`-Blöcke (§ 1–§ 15) mit dem vom Nutzer bereitgestellten Volltext.
- Abschließende Box mit Links zurück zu `/datenschutz` und `/impressum` (Muster wie Impressum → Datenschutz-Link).
- `export const metadata = { title: '...' }` — CLAUDE.md-Checklistenpunkt „Neue Routen haben `export const metadata`", auf den bestehenden zwei Seiten fehlt das, wird hier trotzdem ergänzt.
- Überschriftenhierarchie: `h1` (Seitentitel) → `h2` je `§`-Abschnitt — `Section` rendert bereits `h2` (siehe `datenschutz/page.tsx:16`), Muster wird 1:1 übernommen.

### Routing / Verlinkung

- `src/middleware.ts`: `/nutzungsbedingungen` zu `PUBLIC_ROUTES` hinzufügen.
- `src/app/homepage/page.tsx`, `Footer()`-Funktion: neuer Eintrag `{ label: 'Nutzungsbedingungen', href: '/nutzungsbedingungen' }` im Link-Array, neben Impressum/Datenschutz.

---

## Aufgabe 2: Pflicht-Checkboxen bei Registrierung

### Neue Komponente `RegisterForm`

Neue Datei `src/app/(auth)/login/RegisterForm.tsx` (`'use client'`), übernimmt den kompletten Register-Zweig aus `login/page.tsx`:

- Props: `einladungsToken: string | null`, `einladungsInfo: EinladungsInfo | null`, `onRegistered: () => void`.
- `useForm<RegisterFormValues>({ resolver: zodResolver(registerFormSchema), defaultValues: { email: einladungsInfo?.email ?? '', password: '', vorname: '', nachname: '', ageConfirmed: false, termsAccepted: false } })`.
- Felder: E-Mail, Passwort, optionale Vorname/Nachname (bestehendes "Weitere Angaben"-Toggle bleibt erhalten), danach die zwei neuen Checkboxen, dann Submit-Button.
- Checkbox 1: `<input type="checkbox" id="ageConfirmed" {...register('ageConfirmed')} />` + `<label htmlFor="ageConfirmed">Ich bin mindestens 16 Jahre alt.</label>`.
- Checkbox 2: analog, Label enthält `<a href="/nutzungsbedingungen" target="_blank" rel="noopener noreferrer">Nutzungsbedingungen</a>` und `<a href="/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</a>` als verschachtelte Links (klicken auf den Link togglet die Checkbox nicht, HTML-Standardverhalten). Ersetzt den bisherigen statischen Zustimmungstext (aktuell Zeilen 392–398 in `login/page.tsx`).
- Kein `defaultChecked` — beide Checkboxen starten unangehakt.
- Fehlermeldungen: `role="alert"`, `id="{field}-error"`, Checkbox hat `aria-invalid` + `aria-describedby` auf die Fehlermeldung, wenn `formState.errors[field]` gesetzt ist.
- `onSubmit(values)`: ruft `supabase.auth.signUp({ email, password, options: { emailRedirectTo, data: { vorname, nachname, einladungs_token, age_confirmed_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION } } })` — inhaltlich identisch zum bestehenden Aufruf, nur um die drei Consent-Felder erweitert. Fehlerbehandlung (E-Mail bereits registriert etc.) wird 1:1 aus dem bestehenden `catch`-Block übernommen.
- Bei Erfolg: `onRegistered()` (Parent zeigt weiterhin den bestehenden „Fast geschafft"-Screen).

### Zod-Schema

Neue Datei `src/app/(auth)/login/schema.ts` (Muster: `WarnmeldungForm` + `schema.ts`):

```ts
export const registerFormSchema = z.object({
  email: z.string().email('Bitte gültige E-Mail-Adresse eingeben'),
  password: z.string().min(1, 'Bitte Passwort eingeben'),
  vorname: z.string().optional(),
  nachname: z.string().optional(),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: 'Bitte bestätige, dass du mindestens 16 Jahre alt bist.' }) }),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Bitte akzeptiere die Nutzungsbedingungen und nimm die Datenschutzerklärung zur Kenntnis.' }) }),
})
export type RegisterFormValues = z.infer<typeof registerFormSchema>
```

Keine neuen Anforderungen an E-Mail/Passwort-Validierung über das bisherige (implizite, per `disabled`-Button) Verhalten hinaus — bewusst kein `min(6)` o.ä. für Passwort, um bestehendes Verhalten nicht zu verändern.

### Integration in `login/page.tsx`

- `vorname`, `nachname`, `showOptional` State entfernt (zieht in `RegisterForm`).
- Im Register-Modus wird statt der bisherigen inline-JSX (gemeinsame E-Mail/Passwort-Inputs + optionale Felder + Consent-Absatz + Submit-Button) `<RegisterForm einladungsToken={einladungsToken} einladungsInfo={einladungsInfo} onRegistered={() => setRegistered(true)} />` gerendert.
- Login- und Passwort-vergessen-Zweige bleiben unverändert (gemeinsame E-Mail/Passwort-Inputs oben bleiben nur für diese beiden Modi bestehen).

### Zentrale Versions-Konstante

Neue Datei `src/lib/constants.ts`:

```ts
export const TERMS_VERSION = '1.0'
```

### Persistierung am Profil

- `src/lib/profil-anlegen.ts`: `RegistrierungsDaten` um `termsAcceptedAt?: string`, `termsVersion?: string`, `ageConfirmedAt?: string` erweitern; beide `profiles.insert(...)`-Aufrufe (Erstversuch + Retry bei Email-Unique-Konflikt) übernehmen `terms_accepted_at`, `terms_version`, `age_confirmed_at`.
- `src/app/auth/callback/route.ts`: liest `meta.terms_accepted_at`, `meta.terms_version`, `meta.age_confirmed_at` aus `user.user_metadata` (wie bereits bei `vorname`/`nachname`/`einladungs_token`) und reicht sie über `regDaten` an `profilAnlegen` durch. Der Fallback-`upsert`-Pfad (bei Fehler in `profilAnlegen`) übernimmt dieselben drei Felder für Konsistenz.

### Migration

Neue Datei `supabase/migrations/056_profiles_terms_consent.sql`, Muster wie `054_profiles_vorname_nachname.sql`:

```sql
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version      text,
  add column if not exists age_confirmed_at   timestamptz;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;
```

Kein Backfill nötig (Bestandsnutzer haben `NULL` in den neuen Spalten — historisch korrekt, sie haben nie zugestimmt).

---

## Dateistruktur (neu/geändert)

```
supabase/migrations/
  056_profiles_terms_consent.sql       -- neu

src/app/
  nutzungsbedingungen/
    page.tsx                           -- neu
  (auth)/login/
    page.tsx                           -- geändert (Register-Zweig entfernt)
    RegisterForm.tsx                   -- neu
    schema.ts                          -- neu
  auth/callback/route.ts               -- geändert (Consent-Felder durchreichen)
  homepage/page.tsx                    -- geändert (Footer-Link)

src/middleware.ts                      -- geändert (PUBLIC_ROUTES)
src/lib/
  constants.ts                         -- neu (TERMS_VERSION)
  profil-anlegen.ts                    -- geändert (Consent-Felder)
```

---

## Offene Punkte / Nicht in Scope

- Erneute Zustimmungspflicht bei künftiger Änderung von `TERMS_VERSION` für Bestandsnutzer — nicht spezifiziert, nicht implementiert (nur Neuregistrierungen betroffen).
- Server-seitige (Zweitpunkt-)Validierung der Checkbox-Werte beim Profil-Anlegen: nicht möglich im aktuellen Architektur-Fluss, da `supabase.auth.signUp` direkt clientseitig aufgerufen wird und die eigentliche Profilerstellung erst beim E-Mail-Bestätigungs-Callback erfolgt (`user_metadata` als einziger Transportweg, wie bei `vorname`/`nachname` bereits etabliert). Durchsetzung erfolgt über die Zod-Validierung vor `signUp`.
