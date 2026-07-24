# Gastzugang Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nicht eingeloggte Besucher (Gäste) können die nicht-account-basierten Inhalte einer Gemeinde frei ansehen (Newsfeed, Warnmeldungen, Veranstaltungen, Abfallkalender, Vereine, Gewerbe-Verzeichnis); account-basierte Aktionen verlangen weiter Login. Erfüllt App-Store-Guideline 5.1.1(v).

**Architecture:** Ein Gast ist schlicht „kein `user` / kein Auth-Cookie“. Die bestehende `(app)`-Route-Group bleibt; Gates in Middleware und Layout werden gelockert, Seiten lösen den Tenant über `getGemeinde()` (Host-Header) statt über das Profil auf. Eine zentrale Login-Wall (Zustand-Store + React-Context + globales Modal) fängt geschützte Interaktionen ab. Eine DB-Migration gibt anon strikt lesenden Zugriff auf die öffentlichen Tabellen.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (RLS), Zustand, Tailwind v4, Vitest (node-Env, reine Funktionstests).

**Referenz-Spec:** `docs/superpowers/specs/2026-07-24-gastzugang-design.md`

---

## Dateien-Übersicht

**Neu:**
- `src/lib/guestRoutes.ts` — reine Routen-Klassifikation (Gast-Routen); Middleware-Import
- `src/lib/guestRoutes.test.ts` — Unit-Tests dazu
- `src/stores/loginWall.ts` — Zustand-Store für das Login-Wall-Modal
- `src/lib/guestContext.tsx` — `GuestProvider` + `useIsGuest`
- `src/hooks/useGuestGuard.ts` — `useGuestGuard()` → `{ isGuest, requireLogin }`
- `src/components/LoginWall.tsx` — globales Login-Wall-Modal
- `supabase/migrations/060_gastzugang_anon_lesen.sql` — anon-Grants + anon-Policies + `profiles_public`-View-Anpassung

**Geändert:**
- `src/middleware.ts` — Gast-Routen ohne Session zulassen
- `src/app/(app)/layout.tsx` — kein Zwangs-Redirect; Provider + Wall mounten
- `src/components/layout/BottomNav.tsx` — `isGuest`-Guard für Mängel/Frag BM
- `src/app/(app)/feed/page.tsx` + `FeedClient.tsx` — Gast-tauglich, Umfragen ausblenden
- `src/app/(app)/veranstaltungen/page.tsx`
- `src/app/(app)/abfallkalender/page.tsx`
- `src/app/(app)/vereine/page.tsx` + `[id]/page.tsx` + `[id]/VereinProfil.tsx`
- `src/app/(app)/lokale-angebote/page.tsx` + `[id]/page.tsx` + `[id]/GewerbeProfil.tsx`
- `src/app/(app)/home/page.tsx`
- `src/lib/verein.ts` + `src/lib/gewerbe.ts` — `userId` nullable
- `src/components/ReportButton.tsx`
- `src/features/verein/VereinCard.tsx` + `src/features/gewerbe/GewerbeCard.tsx`
- `src/app/(auth)/login/page.tsx` — „Ohne Anmeldung ansehen“ + `next`/`mode`-Param

---

## Task 1: Gast-Routen-Klassifikation (reine Logik + Test)

**Files:**
- Create: `src/lib/guestRoutes.ts`
- Test: `src/lib/guestRoutes.test.ts`

- [ ] **Step 1: Test schreiben**

`src/lib/guestRoutes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isGuestRoute } from './guestRoutes'

describe('isGuestRoute', () => {
  it('erlaubt Gast-Basisrouten', () => {
    expect(isGuestRoute('/feed')).toBe(true)
    expect(isGuestRoute('/home')).toBe(true)
    expect(isGuestRoute('/warnmeldungen')).toBe(true)
    expect(isGuestRoute('/veranstaltungen')).toBe(true)
    expect(isGuestRoute('/abfallkalender')).toBe(true)
    expect(isGuestRoute('/vereine')).toBe(true)
    expect(isGuestRoute('/lokale-angebote')).toBe(true)
  })

  it('erlaubt Unterpfade von Gast-Routen', () => {
    expect(isGuestRoute('/vereine/123')).toBe(true)
    expect(isGuestRoute('/lokale-angebote/abc')).toBe(true)
  })

  it('blockt geschützte Routen', () => {
    expect(isGuestRoute('/umfragen')).toBe(false)
    expect(isGuestRoute('/maengel')).toBe(false)
    expect(isGuestRoute('/gemeinderat')).toBe(false)
    expect(isGuestRoute('/buergermeister')).toBe(false)
    expect(isGuestRoute('/profil')).toBe(false)
    expect(isGuestRoute('/dashboard')).toBe(false)
  })

  it('matcht keine Präfix-Kollisionen', () => {
    // '/feedback' darf NICHT als '/feed' durchgehen
    expect(isGuestRoute('/feedback')).toBe(false)
  })
})
```

- [ ] **Step 2: Test ausführen (muss fehlschlagen)**

Run: `npm run test -- guestRoutes`
Expected: FAIL — „Cannot find module './guestRoutes'“

- [ ] **Step 3: Implementierung schreiben**

`src/lib/guestRoutes.ts`:

```ts
// Nicht-account-basierte Routen, die Gäste (ohne Login) sehen dürfen.
// Genutzt von der Middleware, um den Session-Redirect für diese Pfade zu überspringen.
export const GUEST_ROUTE_PREFIXES = [
  '/home',
  '/feed',
  '/warnmeldungen',
  '/veranstaltungen',
  '/abfallkalender',
  '/vereine',
  '/lokale-angebote',
] as const

export function isGuestRoute(pathname: string): boolean {
  return GUEST_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}
```

- [ ] **Step 4: Test ausführen (muss bestehen)**

Run: `npm run test -- guestRoutes`
Expected: PASS (4 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/guestRoutes.ts src/lib/guestRoutes.test.ts
git commit -m "Gastzugang: Routen-Klassifikation isGuestRoute + Tests"
```

---

## Task 2: Middleware — Gast-Routen ohne Session zulassen

**Files:**
- Modify: `src/middleware.ts:1-3` (Import), `src/middleware.ts:61-64` (Session-Check)

- [ ] **Step 1: Import ergänzen**

In `src/middleware.ts` nach Zeile 1 (`import { NextResponse, ... }`) ergänzen:

```ts
import { isGuestRoute } from '@/lib/guestRoutes'
```

- [ ] **Step 2: Session-Check lockern**

Ersetze in `src/middleware.ts` den Block:

```ts
  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
```

durch:

```ts
  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  // Gäste (ohne Session) dürfen die nicht-account-basierten Routen sehen (App-Store 5.1.1(v)).
  // Der x-gemeinde-slug-Header ist oben bereits gesetzt und wird mit durchgereicht.
  if (!hasSession && !isGuestRoute(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
```

- [ ] **Step 3: Verifizieren (Build/Lint der Middleware-Kette)**

Run: `npm run lint`
Expected: Keine neuen Fehler in `src/middleware.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "Gastzugang: Middleware laesst Gast-Routen ohne Session zu"
```

---

## Task 3: DB-Migration — anon lesender Zugriff

**Files:**
- Create: `supabase/migrations/060_gastzugang_anon_lesen.sql`

**Kontext (aus der Spec verifiziert):**
- `posts` / `gemeinden` / `gewerbe_branchen` erlauben anon bereits (Grant + `using(true)`).
- `organisationen` (048), `vereine` (048) SELECT sind auf `to authenticated` + `current_gemeinde_id()` beschränkt → anon bekommt nichts. `current_gemeinde_id()` = `select gemeinde_id from profiles where id = auth.uid()` → für anon NULL.
- `abfalltermine`, `abfallkalender_einstellungen` (007) SELECT `using(true)` **ohne** `to`-Klausel → gelten für alle Rollen, aber **ohne Grant** für anon.
- `verein_kategorien` (008) `to authenticated`.
- `post_termine` (053) `using(true)` ohne `to` → nur Grant fehlt.
- `profiles_public` (041) ist eine View mit `security_invoker = off` (läuft als Owner) und `where ... gemeinde_id = current_gemeinde_id()` → für anon 0 Zeilen. Muss angepasst werden, damit anon (current_gemeinde_id() IS NULL) alle Nicht-Bürger-Profile sieht; die App filtert bereits per Author-ID.

Alle anon-Rechte bleiben **strikt lesend** (nur SELECT).

- [ ] **Step 1: Migration schreiben**

`supabase/migrations/060_gastzugang_anon_lesen.sql`:

```sql
-- 060: Gastzugang — anon darf oeffentliche, nicht-account-basierte Inhalte lesen.
-- Kontext: App-Store 5.1.1(v). Alles bleibt fuer anon strikt lesend (nur SELECT).
-- Die App filtert jede Query serverseitig per gemeinde_id (aus dem Host-Header),
-- daher sind die anon-Policies bewusst using(true) bzw. auf oeffentliche Zeilen beschraenkt.

-- ── vereine ───────────────────────────────────────────────────────────────────
create policy "vereine_anon_lesen" on public.vereine
  for select to anon using (true);
grant select on public.vereine to anon;

-- ── verein_kategorien ─────────────────────────────────────────────────────────
create policy "verein_kategorien_anon_lesen" on public.verein_kategorien
  for select to anon using (true);
grant select on public.verein_kategorien to anon;

-- ── organisationen ────────────────────────────────────────────────────────────
-- anon nur Gewerbe (das einzige gast-sichtbare Verzeichnis), keine sonstigen Orgs.
create policy "organisationen_anon_lesen" on public.organisationen
  for select to anon using (typ = 'gewerbe');
grant select on public.organisationen to anon;

-- ── abfalltermine ─────────────────────────────────────────────────────────────
grant select on public.abfalltermine to anon;

-- ── abfallkalender_einstellungen ──────────────────────────────────────────────
grant select on public.abfallkalender_einstellungen to anon;

-- ── post_termine ──────────────────────────────────────────────────────────────
-- Policy ist bereits using(true) fuer alle Rollen (053); nur der Grant fehlt.
grant select on public.post_termine to anon;

-- ── profiles_public (View) ────────────────────────────────────────────────────
-- Laeuft als Owner (security_invoker=off) und filtert per current_gemeinde_id(),
-- das fuer anon NULL ist → wuerde 0 Zeilen liefern. WHERE so anpassen, dass anon
-- (current_gemeinde_id() IS NULL) alle Nicht-Buerger-Profile sieht; authenticated
-- behaelt den Gemeinde-Filter unveraendert. Spaltenliste identisch zu 041.
create or replace view public.profiles_public
with (security_invoker = off)
as
  select
    id, gemeinde_id, display_name, verein_name, role, avatar_url,
    fraktion, ueber_mich, kontakt_email,
    social_x, social_facebook, social_instagram, social_tiktok
  from public.profiles
  where role <> 'buerger'::user_role
    and (
      public.current_gemeinde_id() is null
      or gemeinde_id = public.current_gemeinde_id()
    );

grant select on public.profiles_public to anon;
```

- [ ] **Step 2: Migration lokal anwenden**

Run: `npx supabase db push` (oder projektüblicher Migrations-Befehl; bei gehostetem Projekt: im Supabase-SQL-Editor ausführen).
Expected: Läuft ohne Fehler durch; keine „policy already exists“-Meldungen (Policy-Namen sind neu).

- [ ] **Step 3: Anon-Lesbarkeit stichprobenartig prüfen**

Mit dem anon-Key (z. B. im SQL-Editor als Rolle `anon` oder per REST mit anon-Key) prüfen:
- `select count(*) from vereine;` → > 0 (sofern Daten vorhanden)
- `select count(*) from organisationen where typ = 'gewerbe';` → sichtbar
- `select count(*) from organisationen where typ <> 'gewerbe';` → 0 Zeilen (durch Policy geblockt)
- `select count(*) from profiles_public;` → > 0
- Schreibversuch als anon (`insert into vereine ...`) → verweigert (kein Grant).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/060_gastzugang_anon_lesen.sql
git commit -m "Gastzugang: anon lesenden Zugriff auf oeffentliche Tabellen (Migration 060)"
```

---

## Task 4: lib-Helfer für Gäste (nullable userId)

**Files:**
- Modify: `src/lib/verein.ts:22-59`
- Modify: `src/lib/gewerbe.ts:13-52`

- [ ] **Step 1: `getVereinDetail` userId nullable machen**

In `src/lib/verein.ts` die Signatur und die Abonnement-Query anpassen. Ersetze:

```ts
export async function getVereinDetail(
  supabase: SupabaseServerClient,
  vereinId: string,
  userId: string,
): Promise<VereinDetail | null> {
  const [vereinResult, postsResult, abonnementResult, aboCountResult] = await Promise.all([
```

durch:

```ts
export async function getVereinDetail(
  supabase: SupabaseServerClient,
  vereinId: string,
  userId: string | null,
): Promise<VereinDetail | null> {
  const [vereinResult, postsResult, abonnementResult, aboCountResult] = await Promise.all([
```

Und ersetze die Abonnement-Query (die `.eq('user_id', userId)` nutzt):

```ts
    supabase
      .from('verein_abonnements')
      .select('id')
      .eq('user_id', userId)
      .eq('verein_id', vereinId)
      .maybeSingle(),
```

durch:

```ts
    userId
      ? supabase
          .from('verein_abonnements')
          .select('id')
          .eq('user_id', userId)
          .eq('verein_id', vereinId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
```

- [ ] **Step 2: `getGewerbeDetail` userId nullable machen**

In `src/lib/gewerbe.ts` analog. Ersetze `userId: string,` durch `userId: string | null,` und die Abonnement-Query:

```ts
    supabase
      .from('gewerbe_abonnements')
      .select('id')
      .eq('user_id', userId)
      .eq('gewerbe_id', gewerbeId)
      .maybeSingle(),
```

durch:

```ts
    userId
      ? supabase
          .from('gewerbe_abonnements')
          .select('id')
          .eq('user_id', userId)
          .eq('gewerbe_id', gewerbeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
```

- [ ] **Step 3: Typecheck/Lint**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/lib/verein.ts src/lib/gewerbe.ts
git commit -m "Gastzugang: getVereinDetail/getGewerbeDetail akzeptieren userId=null"
```

---

## Task 5: Login-Wall-Infrastruktur (Store, Context, Hook, Modal)

**Files:**
- Create: `src/stores/loginWall.ts`
- Create: `src/lib/guestContext.tsx`
- Create: `src/hooks/useGuestGuard.ts`
- Create: `src/components/LoginWall.tsx`

- [ ] **Step 1: Zustand-Store**

`src/stores/loginWall.ts`:

```ts
import { create } from 'zustand'

interface LoginWallState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useLoginWallStore = create<LoginWallState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
```

- [ ] **Step 2: Guest-Context**

`src/lib/guestContext.tsx`:

```tsx
'use client'

import { createContext, useContext } from 'react'

const GuestContext = createContext(false)

export function GuestProvider({ isGuest, children }: { isGuest: boolean; children: React.ReactNode }) {
  return <GuestContext.Provider value={isGuest}>{children}</GuestContext.Provider>
}

export function useIsGuest(): boolean {
  return useContext(GuestContext)
}
```

- [ ] **Step 3: Guard-Hook**

`src/hooks/useGuestGuard.ts`:

```ts
'use client'

import { useIsGuest } from '@/lib/guestContext'
import { useLoginWallStore } from '@/stores/loginWall'

/**
 * Guard fuer account-basierte Interaktionen.
 * `requireLogin()` gibt true zurueck (= Aktion blockiert), wenn der Nutzer Gast ist,
 * und oeffnet dann die Login-Wall. Fuer eingeloggte Nutzer false (= Aktion laeuft).
 *
 * Nutzung in einem Handler:
 *   const { requireLogin } = useGuestGuard()
 *   if (requireLogin()) return
 */
export function useGuestGuard() {
  const isGuest = useIsGuest()
  const open = useLoginWallStore((s) => s.open)

  function requireLogin(): boolean {
    if (isGuest) {
      open()
      return true
    }
    return false
  }

  return { isGuest, requireLogin }
}
```

- [ ] **Step 4: Login-Wall-Modal**

`src/components/LoginWall.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X, LogIn, UserPlus } from 'lucide-react'
import { useLoginWallStore } from '@/stores/loginWall'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export default function LoginWall() {
  const isOpen = useLoginWallStore((s) => s.isOpen)
  const close = useLoginWallStore((s) => s.close)
  const pathname = usePathname()
  const trapRef = useFocusTrap(isOpen)

  if (!isOpen) return null

  const next = encodeURIComponent(pathname)

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4"
      onClick={close}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="loginwall-title"
        className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="loginwall-title" className="font-bold text-gray-900 text-lg">
            Anmeldung erforderlich
          </h2>
          <button onClick={close} aria-label="Dialog schließen" className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed">
          Melde dich an oder registriere dich, um mitzumachen – abstimmen, abonnieren, melden und mehr.
        </p>

        <div className="space-y-2 pt-1">
          <Link
            href={`/login?next=${next}`}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <LogIn className="w-5 h-5" aria-hidden="true" /> Anmelden
          </Link>
          <Link
            href={`/login?mode=register&next=${next}`}
            className="w-full border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" aria-hidden="true" /> Registrieren
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/stores/loginWall.ts src/lib/guestContext.tsx src/hooks/useGuestGuard.ts src/components/LoginWall.tsx
git commit -m "Gastzugang: Login-Wall-Infrastruktur (Store, Context, Hook, Modal)"
```

---

## Task 6: App-Layout gast-tauglich machen

**Files:**
- Modify: `src/app/(app)/layout.tsx` (vollständig ersetzen)

- [ ] **Step 1: Layout ersetzen**

`src/app/(app)/layout.tsx` komplett ersetzen durch:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import BottomNav from '@/components/layout/BottomNav'
import AppInit from '@/components/AppInit'
import LoginWall from '@/components/LoginWall'
import { GuestProvider } from '@/lib/guestContext'
import { getFeatures, getBuergermeisterLabel } from '@/lib/features'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isGuest = !user

  const [profileResult, gemeinde] = await Promise.all([
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    getGemeinde(),
  ])

  const profile = profileResult.data
  const features = getFeatures(gemeinde)
  const { short: buergermeisterShortLabel } = getBuergermeisterLabel(gemeinde)

  return (
    <GuestProvider isGuest={isGuest}>
      <div className="min-h-screen bg-[#F4F6F9]">
        <main id="main-content" tabIndex={-1} className="max-w-lg mx-auto pb-20 outline-none">
          {children}
        </main>
        {!isGuest && <AppInit />}
        <BottomNav
          role={profile?.role}
          features={features}
          buergermeisterShortLabel={buergermeisterShortLabel}
          isGuest={isGuest}
        />
        <LoginWall />
      </div>
    </GuestProvider>
  )
}
```

Hinweis: Der frühere `redirect('/login')` bei fehlendem `user` entfällt bewusst. Geschützte Routen werden weiterhin von der Middleware (Task 2) bzw. den jeweiligen Server-Pages abgesichert. `AppInit` (Push/OneSignal) wird für Gäste nicht gerendert.

- [ ] **Step 2: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler (BottomNav `isGuest`-Prop wird in Task 7 ergänzt — falls Typecheck hier meckert, Task 7 direkt anschließen und gemeinsam committen).

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/layout.tsx
git commit -m "Gastzugang: App-Layout rendert fuer Gaeste (Provider + Wall)"
```

---

## Task 7: BottomNav mit Gast-Guard

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`

**Ziel:** Für Gäste lösen die account-basierten Ziele (Mängel, Frag BM) die Login-Wall aus, statt zu einem Redirect zu führen. Die Gast-Ziele (Newsfeed, Veranstaltungen, Home) bleiben normale Links.

- [ ] **Step 1: Props + Guard ergänzen**

In `src/components/layout/BottomNav.tsx` das Interface und den Hook ergänzen. Ersetze:

```tsx
import { clsx } from 'clsx'
import type { GemeindeFeatures } from '@/lib/features'

interface Props {
  role?: string
  features?: GemeindeFeatures
  buergermeisterShortLabel?: string
}

export default function BottomNav({ role, features, buergermeisterShortLabel = 'Frag BM' }: Props) {
  void role
  const pathname = usePathname()
```

durch:

```tsx
import { clsx } from 'clsx'
import type { GemeindeFeatures } from '@/lib/features'
import { useGuestGuard } from '@/hooks/useGuestGuard'

interface Props {
  role?: string
  features?: GemeindeFeatures
  buergermeisterShortLabel?: string
  isGuest?: boolean
}

// Ziele, die fuer Gaeste Login erfordern
const GUARDED_HREFS = new Set(['/maengel', '/buergermeister'])

export default function BottomNav({ role, features, buergermeisterShortLabel = 'Frag BM', isGuest = false }: Props) {
  void role
  const pathname = usePathname()
  const { requireLogin } = useGuestGuard()
```

- [ ] **Step 2: Linkklicks für geschützte Ziele abfangen**

In beiden `.map(...)`-Blöcken (leftItems und rightItems) den `<Link>` um einen `onClick`-Guard erweitern. Ersetze **beide** Vorkommen von:

```tsx
            <Link key={href} href={href}
              aria-current={active ? 'page' : undefined}
```

durch:

```tsx
            <Link key={href} href={href}
              onClick={(e) => {
                if (isGuest && GUARDED_HREFS.has(href)) {
                  e.preventDefault()
                  requireLogin()
                }
              }}
              aria-current={active ? 'page' : undefined}
```

(Der Guard greift nur für `/maengel` und `/buergermeister`; `/feed`, `/veranstaltungen`, `/home` bleiben unberührt.)

- [ ] **Step 3: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "Gastzugang: BottomNav faengt geschuetzte Ziele fuer Gaeste ab"
```

---

## Task 8: Feed gast-tauglich (Server + Client)

**Files:**
- Modify: `src/app/(app)/feed/page.tsx`
- Modify: `src/app/(app)/feed/FeedClient.tsx:18-44`

**Ziel:** Feed lädt für Gäste über `getGemeinde()`, überspringt nutzerbezogene Queries, blendet Umfragen aus, zeigt trotzdem den Gemeindenamen im Header.

- [ ] **Step 1: FeedClient um `gemeindeName`-Fallback erweitern**

In `src/app/(app)/feed/FeedClient.tsx` das Interface und die Ableitung anpassen. Ersetze:

```tsx
interface Props {
  posts: PostMitProfil[]
  profile: (Profile & { gemeinden?: { name: string } | null }) | null
  alleVereine?: string[]
  umfragen: UmfrageMitDaten[]
  gewerbeAbonnements?: string[]
  vereinAbonnements?: string[]
}

export default function FeedClient({ posts: initialPosts, profile, umfragen: initialUmfragen, gewerbeAbonnements = [], vereinAbonnements = [] }: Props) {
```

durch:

```tsx
interface Props {
  posts: PostMitProfil[]
  profile: (Profile & { gemeinden?: { name: string } | null }) | null
  alleVereine?: string[]
  umfragen: UmfrageMitDaten[]
  gewerbeAbonnements?: string[]
  vereinAbonnements?: string[]
  gemeindeName?: string
}

export default function FeedClient({ posts: initialPosts, profile, umfragen: initialUmfragen, gewerbeAbonnements = [], vereinAbonnements = [], gemeindeName: gemeindeNameProp }: Props) {
```

Und ersetze:

```tsx
  const gemeindeName = profile?.gemeinden?.name ?? ''
```

durch:

```tsx
  const gemeindeName = gemeindeNameProp ?? profile?.gemeinden?.name ?? ''
```

- [ ] **Step 2: Feed-Page gast-tauglich machen**

`src/app/(app)/feed/page.tsx` ab Zeile 9 (Funktionskopf) so umbauen, dass der Tenant aus `getGemeinde()` kommt und nutzerbezogene Queries nur mit `user` laufen. Ersetze den Block von `export default async function FeedPage() {` bis inkl. der `Promise.all([...])`-Deklaration (Zeilen 9–57) durch:

```tsx
export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isGuest = !user

  const gemeinde = await getGemeinde()

  const profile = user
    ? (await supabase
        .from('profiles')
        .select('*, gemeinden(name)')
        .eq('id', user.id)
        .single()).data
    : null

  const gemeindeId = profile?.gemeinde_id ?? gemeinde?.id
  const gemeindeName = profile?.gemeinden?.name ?? gemeinde?.name ?? ''

  const [postsResult, vereineResult, umfragenResult, abonnementsResult, vereinAbonnementsResult] = await Promise.all([
    gemeindeId
      ? supabase.from('posts')
          .select('id, titel, inhalt, bild_url, bilder_urls, tag, channel, pinned, status, published_at, publish_at, author_id, org_id, veranstaltung_datum, veranstaltung_ort, post_termine(datum), sammlung_datum, sammlung_organisator, sichtbarkeit')
          .eq('gemeinde_id', gemeindeId)
          .eq('status', 'published')
          .neq('channel', 'gemeinderat')
          .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
          .order('pinned', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),

    gemeindeId
      ? supabase.from('profiles')
          .select('verein_name')
          .eq('gemeinde_id', gemeindeId)
          .eq('role', 'verein')
          .not('verein_name', 'is', null)
      : Promise.resolve({ data: [] }),

    // Umfragen sind fuer Gaeste ausgeblendet (login-pflichtig)
    !isGuest && gemeindeId
      ? supabase.from('umfragen')
          .select('*, umfrage_fragen(*, umfrage_optionen(*))')
          .eq('gemeinde_id', gemeindeId)
          .gte('enddatum', new Date().toISOString())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),

    user
      ? supabase.from('gewerbe_abonnements').select('gewerbe_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] }),

    user
      ? supabase.from('verein_abonnements').select('verein_id').eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ])
```

Wichtig: Der Import von `getGemeinde` muss oben ergänzt werden. Ersetze in `src/app/(app)/feed/page.tsx` die Importzeile:

```tsx
import { createClient } from '@/lib/supabase/server'
```

durch:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
```

- [ ] **Step 3: Autoren-Query & Return anpassen**

Die Autoren-Query (`profiles_public ... .in('id', authorIds)`) bleibt unverändert und funktioniert für Gäste dank Migration 060.

Ersetze den Return-Block:

```tsx
  return (
    <FeedClient
      posts={postsWithProfiles}
      profile={profile}
      alleVereine={vereine}
      umfragen={umfragenMitDaten}
      gewerbeAbonnements={gewerbeAbonnements}
      vereinAbonnements={vereinAbonnements}
    />
  )
```

durch:

```tsx
  return (
    <FeedClient
      posts={postsWithProfiles}
      profile={profile}
      alleVereine={vereine}
      umfragen={umfragenMitDaten}
      gewerbeAbonnements={gewerbeAbonnements}
      vereinAbonnements={vereinAbonnements}
      gemeindeName={gemeindeName}
    />
  )
```

(Für Gäste ist `umfragen` leer → `umfragenMitDaten` ist `[]`, `eigeneTeilnahmen` leer. Die bestehende `eigenteTeilnahmenResult`-Query ist bereits mit `user` geguardet.)

- [ ] **Step 4: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/feed/page.tsx src/app/(app)/feed/FeedClient.tsx
git commit -m "Gastzugang: Feed laedt fuer Gaeste ueber getGemeinde, ohne Umfragen"
```

---

## Task 9: Veranstaltungen gast-tauglich

**Files:**
- Modify: `src/app/(app)/veranstaltungen/page.tsx:7-56`

- [ ] **Step 1: Tenant über getGemeinde auflösen**

Ersetze in `src/app/(app)/veranstaltungen/page.tsx` den Kopf von `export default async function VeranstaltungenPage() {` bis inkl. der Zeile `const gemeindeName = ...`:

```tsx
export default async function VeranstaltungenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id, gemeinden(name)')
    .eq('id', user?.id ?? '')
    .single()

  const gemeindeName = (profile?.gemeinden as unknown as { name: string } | null)?.name ?? 'Ehningen'
```

durch:

```tsx
export default async function VeranstaltungenPage() {
  const supabase = await createClient()
  const gemeinde = await getGemeinde()
  const gemeindeId = gemeinde?.id
  const gemeindeName = gemeinde?.name ?? 'Ehningen'
```

Und ersetze die anschließende Bedingung `const [...] = profile?.gemeinde_id ? await Promise.all([...` — konkret die Zeile:

```tsx
  const [{ data: haupttermine }, { data: zusatztermine }] = profile?.gemeinde_id
```

durch:

```tsx
  const [{ data: haupttermine }, { data: zusatztermine }] = gemeindeId
```

Und innerhalb der beiden Queries die Vorkommen von `profile.gemeinde_id` durch `gemeindeId` ersetzen:
- `.eq('gemeinde_id', profile.gemeinde_id)` → `.eq('gemeinde_id', gemeindeId)`
- `.eq('posts.gemeinde_id', profile.gemeinde_id)` → `.eq('posts.gemeinde_id', gemeindeId)`

- [ ] **Step 2: Import ergänzen**

Ersetze in `src/app/(app)/veranstaltungen/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import KalenderClient from './KalenderClient'
```

durch:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import KalenderClient from './KalenderClient'
```

- [ ] **Step 3: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler (die nun ungenutzte `user`-Variable ist entfernt).

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/veranstaltungen/page.tsx
git commit -m "Gastzugang: Veranstaltungen ueber getGemeinde statt Profil"
```

---

## Task 10: Abfallkalender gast-tauglich

**Files:**
- Modify: `src/app/(app)/abfallkalender/page.tsx:16-26` und `:58-65`

**Ziel:** Kalender (Termine) ist für Gäste sichtbar; persönliche Präferenzen/Erinnerungen bleiben account-basiert (Einstellungen liegen auf der geschützten Seite `/abfallkalender/einstellungen`).

- [ ] **Step 1: Login-Redirect entfernen, Tenant aus getGemeinde**

Ersetze in `src/app/(app)/abfallkalender/page.tsx`:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('gemeinde_id')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id
```

durch:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const gemeindeId = gemeinde?.id
```

(`gemeinde` ist oben bereits via `getGemeinde()` geladen.)

- [ ] **Step 2: Präferenz-Query nur für eingeloggte Nutzer**

Ersetze die Präferenzen-Query im `Promise.all`:

```tsx
    gemeindeId
      ? supabase
          .from('abfallkalender_praeferenzen')
          .select('ausgewaehlte_typen, push_aktiviert, email_aktiviert, benachrichtigung_uhrzeit')
          .eq('user_id', user.id)
          .eq('gemeinde_id', gemeindeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
```

durch:

```tsx
    user && gemeindeId
      ? supabase
          .from('abfallkalender_praeferenzen')
          .select('ausgewaehlte_typen, push_aktiviert, email_aktiviert, benachrichtigung_uhrzeit')
          .eq('user_id', user.id)
          .eq('gemeinde_id', gemeindeId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
```

- [ ] **Step 3: Ungenutzten `redirect`-Import prüfen**

`redirect` wird weiterhin für `if (!isFeatureAktiv(...)) redirect('/home')` genutzt — Import bleibt. Kein Change nötig.

- [ ] **Step 4: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/abfallkalender/page.tsx
git commit -m "Gastzugang: Abfallkalender-Termine fuer Gaeste, Praeferenzen nur eingeloggt"
```

---

## Task 11: Vereine (Liste + Detail) gast-tauglich

**Files:**
- Modify: `src/app/(app)/vereine/page.tsx:14-43`
- Modify: `src/app/(app)/vereine/[id]/page.tsx:14-30`

- [ ] **Step 1: Vereine-Liste — Login-Redirect entfernen, Tenant aus getGemeinde**

Ersetze in `src/app/(app)/vereine/page.tsx`:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, gemeinden(name)')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id
  if (!gemeindeId) {
    return <VereinListeClient vereine={[]} kategorien={[]} profile={profile} abonnements={[]} />
  }

  const [vereineResult, kategorienResult, abonnementsResult] = await Promise.all([
    supabase
      .from('vereine')
      .select('*, verein_kategorien(id, name)')
      .eq('gemeinde_id', gemeindeId)
      .order('verein_name'),
    supabase
      .from('verein_kategorien')
      .select('id, name, reihenfolge')
      .order('reihenfolge'),
    supabase
      .from('verein_abonnements')
      .select('verein_id')
      .eq('user_id', user.id),
  ])
```

durch:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase
        .from('profiles')
        .select('*, gemeinden(name)')
        .eq('id', user.id)
        .single()).data
    : null

  const gemeindeId = profile?.gemeinde_id ?? gemeinde?.id
  if (!gemeindeId) {
    return <VereinListeClient vereine={[]} kategorien={[]} profile={profile} abonnements={[]} />
  }

  const [vereineResult, kategorienResult, abonnementsResult] = await Promise.all([
    supabase
      .from('vereine')
      .select('*, verein_kategorien(id, name)')
      .eq('gemeinde_id', gemeindeId)
      .order('verein_name'),
    supabase
      .from('verein_kategorien')
      .select('id, name, reihenfolge')
      .order('reihenfolge'),
    user
      ? supabase
          .from('verein_abonnements')
          .select('verein_id')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ])
```

(`gemeinde` stammt aus dem bestehenden `getGemeinde()`-Aufruf oben in der Datei. `redirect` wird weiterhin für das Feature-Gate genutzt → Import bleibt.)

- [ ] **Step 2: Vereine-Detail — für Gäste zulassen**

Ersetze in `src/app/(app)/vereine/[id]/page.tsx`:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const detail = await getVereinDetail(supabase, id, user.id)
```

durch:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const detail = await getVereinDetail(supabase, id, user?.id ?? null)
```

Und den nun ungenutzten `redirect`-Import entfernen. Ersetze:

```tsx
import { redirect, notFound } from 'next/navigation'
```

durch:

```tsx
import { notFound } from 'next/navigation'
```

- [ ] **Step 3: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/vereine/page.tsx src/app/(app)/vereine/[id]/page.tsx
git commit -m "Gastzugang: Vereine Liste + Detail fuer Gaeste"
```

---

## Task 12: Lokale Angebote (Liste + Detail) gast-tauglich

**Files:**
- Modify: `src/app/(app)/lokale-angebote/page.tsx:14-42`
- Modify: `src/app/(app)/lokale-angebote/[id]/page.tsx:14-30`

- [ ] **Step 1: Liste — Login-Redirect entfernen, Tenant aus getGemeinde**

Ersetze in `src/app/(app)/lokale-angebote/page.tsx`:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, gemeinden(name)')
    .eq('id', user.id)
    .single()

  const gemeindeId = profile?.gemeinde_id
  if (!gemeindeId) return <LokaleAngeboteClient betriebe={[]} branchen={[]} profile={profile} abonnements={[]} />

  const [{ data: betriebe }, { data: abonnements }, { data: branchen }] = await Promise.all([
    supabase
      .from('organisationen')
      .select('*, gewerbe_branchen(id, name)')
      .eq('gemeinde_id', gemeindeId)
      .eq('typ', 'gewerbe')
      .order('name'),
    supabase
      .from('gewerbe_abonnements')
      .select('gewerbe_id')
      .eq('user_id', user.id),
    supabase
      .from('gewerbe_branchen')
      .select('id, name, reihenfolge')
      .order('reihenfolge'),
  ])
```

durch:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user
    ? (await supabase
        .from('profiles')
        .select('*, gemeinden(name)')
        .eq('id', user.id)
        .single()).data
    : null

  const gemeindeId = profile?.gemeinde_id ?? gemeinde?.id
  if (!gemeindeId) return <LokaleAngeboteClient betriebe={[]} branchen={[]} profile={profile} abonnements={[]} />

  const [{ data: betriebe }, { data: abonnements }, { data: branchen }] = await Promise.all([
    supabase
      .from('organisationen')
      .select('*, gewerbe_branchen(id, name)')
      .eq('gemeinde_id', gemeindeId)
      .eq('typ', 'gewerbe')
      .order('name'),
    user
      ? supabase
          .from('gewerbe_abonnements')
          .select('gewerbe_id')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
    supabase
      .from('gewerbe_branchen')
      .select('id, name, reihenfolge')
      .order('reihenfolge'),
  ])
```

(`gemeinde` stammt aus dem bestehenden `getGemeinde()`-Aufruf oben. `redirect` bleibt fürs Feature-Gate.)

- [ ] **Step 2: Detail — für Gäste zulassen**

Ersetze in `src/app/(app)/lokale-angebote/[id]/page.tsx`:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const detail = await getGewerbeDetail(supabase, id, user.id)
```

durch:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const detail = await getGewerbeDetail(supabase, id, user?.id ?? null)
```

Und den ungenutzten `redirect`-Import entfernen. Ersetze:

```tsx
import { redirect, notFound } from 'next/navigation'
```

durch:

```tsx
import { notFound } from 'next/navigation'
```

- [ ] **Step 3: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/lokale-angebote/page.tsx" "src/app/(app)/lokale-angebote/[id]/page.tsx"
git commit -m "Gastzugang: Lokale Angebote Liste + Detail fuer Gaeste"
```

---

## Task 13: Home gast-tauglich (Gast-Kacheln + Login-Karte)

**Files:**
- Modify: `src/app/(app)/home/page.tsx`

**Ziel:** Home rendert für Gäste ohne Profil. Es werden nur gast-zugängliche Kacheln gezeigt plus eine prominente „Registrieren / Anmelden“-Karte. Der Dashboard-Banner entfällt für Gäste; der Warnungs-Banner bleibt.

- [ ] **Step 1: Gast-Zustand und Kachel-Filter ergänzen**

Ersetze in `src/app/(app)/home/page.tsx` den Block:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileResult, gemeinde] = await Promise.all([
    supabase
      .from('profiles')
      .select('vorname, display_name, role')
      .eq('id', user?.id ?? '')
      .single(),
    getGemeinde(),
  ])
```

durch:

```tsx
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isGuest = !user

  const [profileResult, gemeinde] = await Promise.all([
    user
      ? supabase
          .from('profiles')
          .select('vorname, display_name, role')
          .eq('id', user.id)
          .single()
      : Promise.resolve({ data: null }),
    getGemeinde(),
  ])
```

- [ ] **Step 2: Gast-Kachelmenge definieren**

Direkt nach der bestehenden `const tiles = BASE_TILES.filter(...)`-Deklaration die Gast-Einschränkung ergänzen. Ersetze:

```tsx
  const tiles = BASE_TILES.filter(({ href }) => {
    const featureKey = FEATURE_GATE[href]
    return featureKey ? isFeatureAktiv(gemeinde, featureKey) : true
  })
```

durch:

```tsx
  // Fuer Gaeste nur nicht-account-basierte Kacheln zeigen
  const GUEST_TILE_HREFS = new Set([
    '/feed', '/veranstaltungen', '/lokale-angebote', '/vereine', '/abfallkalender', '/warnmeldungen',
  ])

  const tiles = BASE_TILES.filter(({ href }) => {
    if (isGuest && !GUEST_TILE_HREFS.has(href)) return false
    const featureKey = FEATURE_GATE[href]
    return featureKey ? isFeatureAktiv(gemeinde, featureKey) : true
  })
```

- [ ] **Step 3: Begrüßung + Dashboard-Banner gast-tauglich**

Ersetze:

```tsx
  const vorname = profile?.vorname || profile?.display_name?.split(' ')[0] || 'Hallo'
```

durch:

```tsx
  const vorname = profile?.vorname || profile?.display_name?.split(' ')[0] || 'Willkommen'
```

Der `hasDashboard`-Banner ist bereits an `profile?.role` gekoppelt und wird für Gäste (profile === null) automatisch nicht gerendert — kein Change nötig.

- [ ] **Step 4: Login-Karte für Gäste einfügen**

Direkt **vor** dem `{/* Kachel-Grid */}`-Kommentar (also vor `<div className="grid grid-cols-2 gap-2.5">`) einfügen:

```tsx
        {/* Gast-Hinweis: Anmelden/Registrieren */}
        {isGuest && (
          <Link
            href="/login"
            className="bg-primary-500 rounded-[20px] p-4 flex items-center gap-4 shadow-[0_4px_14px_rgba(15,45,107,0.33)] transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none"
          >
            <div className="w-11 h-11 rounded-[14px] bg-white/14 flex items-center justify-center shrink-0">
              <UserCircle className="w-[22px] h-[22px] text-white" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-[14.5px]">Anmelden oder registrieren</p>
              <p className="text-white/55 text-xs mt-0.5">Abstimmen, Mängel melden, abonnieren &amp; mehr</p>
            </div>
            <div className="w-[30px] h-[30px] rounded-[9px] bg-gold-500 flex items-center justify-center shrink-0">
              <svg width="15" height="15" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <path d="M4 11h14M13 5l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        )}
```

(`UserCircle` ist im bestehenden lucide-Import der Datei bereits enthalten.)

- [ ] **Step 5: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/home/page.tsx"
git commit -m "Gastzugang: Home mit Gast-Kacheln und Login-Karte"
```

---

## Task 14: Login-Wall in geschützte Interaktionen einbinden

**Files:**
- Modify: `src/components/ReportButton.tsx:24-29,56-64`
- Modify: `src/features/verein/VereinCard.tsx:31-52`
- Modify: `src/features/gewerbe/GewerbeCard.tsx` (Handler `toggleAbonnement`, ~Zeile 40)
- Modify: `src/app/(app)/vereine/[id]/VereinProfil.tsx:21-34`
- Modify: `src/app/(app)/lokale-angebote/[id]/GewerbeProfil.tsx:20-30`

**Muster (überall gleich):** `useGuestGuard()` importieren, im Interaktions-Handler zuerst `if (requireLogin()) return`.

- [ ] **Step 1: ReportButton**

In `src/components/ReportButton.tsx` Import ergänzen (nach der `useFocusTrap`-Importzeile):

```tsx
import { useGuestGuard } from '@/hooks/useGuestGuard'
```

Im Komponentenrumpf nach `const trapRef = useFocusTrap(open)` ergänzen:

```tsx
  const { requireLogin } = useGuestGuard()
```

Und den Öffnen-Button-Handler ersetzen:

```tsx
        onClick={() => setOpen(true)}
```

durch:

```tsx
        onClick={() => { if (requireLogin()) return; setOpen(true) }}
```

- [ ] **Step 2: VereinCard**

In `src/features/verein/VereinCard.tsx` Import ergänzen:

```tsx
import { useGuestGuard } from '@/hooks/useGuestGuard'
```

Im Komponentenrumpf (nach den `useState`-Zeilen) ergänzen:

```tsx
  const { requireLogin } = useGuestGuard()
```

Und im `toggleAbonnement`-Handler direkt nach `e.stopPropagation()` einfügen:

```tsx
    if (requireLogin()) return
```

- [ ] **Step 3: GewerbeCard**

In `src/features/gewerbe/GewerbeCard.tsx` analog: `useGuestGuard`-Import ergänzen, `const { requireLogin } = useGuestGuard()` im Rumpf, und in `async function toggleAbonnement(e: React.MouseEvent)` als erste Zeile nach `e.stopPropagation()`:

```tsx
    if (requireLogin()) return
```

(Falls `toggleAbonnement` dort kein `e.stopPropagation()` als erste Zeile hat, `if (requireLogin()) return` als allererste Anweisung der Funktion einfügen.)

- [ ] **Step 4: VereinProfil**

In `src/app/(app)/vereine/[id]/VereinProfil.tsx`: `useGuestGuard`-Import ergänzen, `const { requireLogin } = useGuestGuard()` im Rumpf, und in `async function toggleAbonnement()` als erste Zeile:

```tsx
    if (requireLogin()) return
```

- [ ] **Step 5: GewerbeProfil**

In `src/app/(app)/lokale-angebote/[id]/GewerbeProfil.tsx`: `useGuestGuard`-Import ergänzen, `const { requireLogin } = useGuestGuard()` im Rumpf, und in `async function toggleAbonnement()` als erste Zeile:

```tsx
    if (requireLogin()) return
```

- [ ] **Step 6: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/components/ReportButton.tsx src/features/verein/VereinCard.tsx src/features/gewerbe/GewerbeCard.tsx "src/app/(app)/vereine/[id]/VereinProfil.tsx" "src/app/(app)/lokale-angebote/[id]/GewerbeProfil.tsx"
git commit -m "Gastzugang: Login-Wall in Melden/Abonnieren-Aktionen einbinden"
```

---

## Task 15: Login-Seite — „Ohne Anmeldung ansehen“ + next/mode-Param

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: next/mode aus URL lesen**

In `src/app/(auth)/login/page.tsx` im bestehenden `useEffect(() => { ... }, [searchParams])` (ab „const urlError = searchParams.get('error')“) ergänzen — direkt nach der `urlInfo`-Zeile:

```tsx
    if (searchParams.get('mode') === 'register') setMode('register')
```

- [ ] **Step 2: next-Ziel nach Login berücksichtigen**

Im `submit()`-Handler, im `mode === 'login'`-Zweig, die zwei Fälle mit `router.push('/home')` so anpassen, dass ein `next`-Parameter (sofern gesetzt und same-host) bevorzugt wird. Füge am Anfang von `submit()` (nach `setError('')`) hinzu:

```tsx
    const nextParam = searchParams.get('next')
    const nextPath = nextParam ? decodeURIComponent(nextParam) : null
```

Ersetze dann im selben Zweig den Block:

```tsx
          const slug = (profile as any)?.gemeinden?.slug as string | undefined
          const currentHost = window.location.hostname
          if (slug && currentHost !== `${slug}.dorfly.de`) {
            window.location.href = `https://${slug}.dorfly.de/home`
          } else {
            router.push('/home')
            router.refresh()
          }
```

durch:

```tsx
          const slug = (profile as any)?.gemeinden?.slug as string | undefined
          const currentHost = window.location.hostname
          if (slug && currentHost !== `${slug}.dorfly.de`) {
            window.location.href = `https://${slug}.dorfly.de${nextPath ?? '/home'}`
          } else {
            router.push(nextPath ?? '/home')
            router.refresh()
          }
```

(Der `setup-profil`-Fallback-Zweig darf unverändert bleiben; `next` greift dort optional nicht — kein Regressionsrisiko.)

- [ ] **Step 3: „Ohne Anmeldung ansehen“-Button einfügen**

Direkt **nach** dem schließenden `</div>` des Tab-Umschalters (dem Block mit `{(['login', 'register'] as const).map(...)}`) und **vor** `<div className="space-y-3">` einfügen:

```tsx
        {/* Gastzugang: freier Zugang zu nicht-account-basierten Inhalten */}
        <button
          type="button"
          onClick={() => router.push('/feed')}
          className="w-full mb-4 text-center text-sm font-semibold text-primary-600 hover:text-primary-700 underline underline-offset-2"
        >
          Ohne Anmeldung ansehen
        </button>
```

- [ ] **Step 4: Lint/Typecheck**

Run: `npm run lint`
Expected: Keine neuen Fehler.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "Gastzugang: Login-Seite mit Gast-Button und next/mode-Param"
```

---

## Task 16: Gesamtverifikation (Build + manuell)

**Files:** keine

- [ ] **Step 1: Volle Testsuite**

Run: `npm run test`
Expected: Alle Tests grün (inkl. neuer `guestRoutes`-Tests).

- [ ] **Step 2: Lint + Production-Build**

Run: `npm run lint && npm run build`
Expected: Kein Fehler; Build erfolgreich.

- [ ] **Step 3: Manuelle Gast-Verifikation**

Dev-Server starten (`npm run dev`), Browser-Cookies für die Gemeinde-Subdomain löschen (kein Login), dann prüfen:
- `ehningen.localhost:3000/feed` → Feed lädt, Gemeindename im Header, **keine** Umfrage-Karten, Autorennamen sichtbar.
- `/warnmeldungen`, `/veranstaltungen`, `/abfallkalender`, `/vereine`, `/lokale-angebote` → laden ohne Redirect.
- `/vereine/<id>` und `/lokale-angebote/<id>` → Detailseite lädt, „Abonnieren“ öffnet die Login-Wall.
- Auf einem Feed-Post das Melden-Flag antippen → Login-Wall öffnet, Fokus wird gefangen, ESC schließt, Fokus kehrt zurück.
- BottomNav „Mängel“/„Frag BM“ als Gast → Login-Wall.
- `/umfragen`, `/profil`, `/gemeinderat` direkt aufrufen → Redirect auf `/login`.
- Login-Seite → „Ohne Anmeldung ansehen“ führt in den Feed; nach echtem Login mit `?next=/vereine` landet man auf `/vereine`.

- [ ] **Step 4: Eingeloggt-Regression**

Mit Login prüfen, dass Feed (inkl. Umfragen), Abonnieren, Melden, Abfallkalender-Einstellungen und Navigation unverändert funktionieren.

- [ ] **Step 5: Abschluss-Commit (falls noch offene Änderungen)**

```bash
git status
# nur falls noch etwas offen ist:
git add -A && git commit -m "Gastzugang: Abschluss-Verifikation"
```

---

## Self-Review-Notiz

- **Spec-Abdeckung:** Gast-Umfang (Feed/Warn/Veranst./Abfall/Vereine/Gewerbe) → Tasks 8–13; Umfragen ausgeblendet → Task 8; Login-Wall → Tasks 5,7,14; DB-Grants → Task 3; Einstieg via Login-Button → Task 15; Middleware/Layout-Gates → Tasks 2,6.
- **Bewusste Entscheidung:** Abfallkalender-Einstellungen und `/profil` sind eigene geschützte Seiten → Gäste werden dorthin per Middleware/Server-Redirect geführt (kein In-Component-Guard nötig); daher kein `isGuest` an `AbfallkalenderClient`/`KalenderClient`.
- **Sicherheit:** anon-Rechte strikt lesend; `organisationen` für anon auf `typ='gewerbe'` beschränkt; `profiles_public`-View-Änderung öffnet nur den anon-Fall (`current_gemeinde_id() is null`), authenticated bleibt gemeinde-gefiltert.
