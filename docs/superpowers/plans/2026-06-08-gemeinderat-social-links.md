# Gemeinderat Social Media Links — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gemeinderäte können X, Facebook, Instagram und TikTok-Usernamen in ihrem Profil eintragen; die entsprechenden Icons erscheinen in der öffentlichen Übersicht neben ihrem Namen.

**Architecture:** 4 nullable Text-Spalten auf `profiles`, API-Route um Normalisierung erweitert, Dashboard-Profil-Tab bekommt Eingabefelder, public view zeigt Inline-SVG-Icons als Links.

**Tech Stack:** Next.js App Router · Supabase · Zod · React (lucide-react bereits vorhanden, Social-Icons als Inline-SVG)

---

## Datei-Übersicht

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/035_profiles_social_links.sql` | Neu — 4 Spalten auf `profiles` |
| `src/types/supabase.ts` | 4 Spalten in Row/Insert/Update von `profiles` ergänzen |
| `src/lib/social.ts` | Neu — `normalizeSocialUsername` + `buildSocialUrl` |
| `src/lib/social.test.ts` | Neu — Tests für beide Funktionen |
| `src/app/api/profil/gemeinderat/route.ts` | Schema + Update um 4 Felder erweitern |
| `src/components/dashboard/GemeinderatDashboard.tsx` | Props + State + Inputs für 4 Felder |
| `src/app/(admin)/dashboard/page.tsx` | 4 neue Props an GemeinderatDashboard übergeben |
| `src/app/(app)/gemeinderat/GemeinderatClient.tsx` | Rat-Interface + Social-Icons neben Namen |
| `src/app/(app)/gemeinderat/page.tsx` | Select-Query um 4 Spalten erweitern |

---

## Task 1: Datenbank-Migration

**Files:**
- Create: `supabase/migrations/035_profiles_social_links.sql`

- [ ] **Schritt 1: Migration erstellen**

```sql
-- Bilder-URLs für Gemeinderäte auf Social Media
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_x         text,
  ADD COLUMN IF NOT EXISTS social_facebook  text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_tiktok    text;
```

Datei speichern unter `supabase/migrations/035_profiles_social_links.sql`.

- [ ] **Schritt 2: Migration im Supabase Dashboard ausführen**

Dateiinhalt in Supabase → SQL Editor einfügen und ausführen. Kein CLI verfügbar.

- [ ] **Schritt 3: Commit**

```bash
git add supabase/migrations/035_profiles_social_links.sql
git commit -m "feat: add social media columns to profiles"
```

---

## Task 2: TypeScript-Typen aktualisieren

**Files:**
- Modify: `src/types/supabase.ts:120` (Row), `src/types/supabase.ts:141` (Insert), `src/types/supabase.ts:162` (Update)

- [ ] **Schritt 1: Row-Abschnitt erweitern**

In `src/types/supabase.ts` nach Zeile 120 (`kontakt_email: string | null`) einfügen:

```typescript
          social_x: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
```

- [ ] **Schritt 2: Insert-Abschnitt erweitern**

In `src/types/supabase.ts` nach Zeile 141 (`kontakt_email?: string | null`) einfügen:

```typescript
          social_x?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
```

- [ ] **Schritt 3: Update-Abschnitt erweitern**

In `src/types/supabase.ts` nach Zeile 162 (`kontakt_email?: string | null`) einfügen:

```typescript
          social_x?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
```

- [ ] **Schritt 4: Build prüfen**

```bash
npm run build
```

Erwartetes Ergebnis: Kein TypeScript-Fehler.

- [ ] **Schritt 5: Commit**

```bash
git add src/types/supabase.ts
git commit -m "feat: add social media fields to Profile type"
```

---

## Task 3: Social-Utility und Tests (TDD)

**Files:**
- Create: `src/lib/social.ts`
- Create: `src/lib/social.test.ts`

- [ ] **Schritt 1: Test schreiben**

Neue Datei `src/lib/social.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeSocialUsername, buildSocialUrl } from './social'

describe('normalizeSocialUsername', () => {
  it('entfernt führendes @', () => {
    expect(normalizeSocialUsername('@lukas_rosen')).toBe('lukas_rosen')
  })
  it('lässt Username ohne @ unverändert', () => {
    expect(normalizeSocialUsername('lukas_rosen')).toBe('lukas_rosen')
  })
  it('gibt null zurück für leeren String', () => {
    expect(normalizeSocialUsername('')).toBeNull()
  })
  it('gibt null zurück für null', () => {
    expect(normalizeSocialUsername(null)).toBeNull()
  })
  it('trimmt Whitespace', () => {
    expect(normalizeSocialUsername('  lukas_rosen  ')).toBe('lukas_rosen')
  })
  it('trimmt Whitespace und entfernt @', () => {
    expect(normalizeSocialUsername('  @lukas_rosen  ')).toBe('lukas_rosen')
  })
})

describe('buildSocialUrl', () => {
  it('baut X-URL korrekt', () => {
    expect(buildSocialUrl('x', 'lukas_rosen')).toBe('https://x.com/lukas_rosen')
  })
  it('baut Facebook-URL korrekt', () => {
    expect(buildSocialUrl('facebook', 'lukas.rosen')).toBe('https://facebook.com/lukas.rosen')
  })
  it('baut Instagram-URL korrekt', () => {
    expect(buildSocialUrl('instagram', 'lukas_rosen')).toBe('https://instagram.com/lukas_rosen')
  })
  it('baut TikTok-URL mit @ korrekt', () => {
    expect(buildSocialUrl('tiktok', 'lukas_rosen')).toBe('https://tiktok.com/@lukas_rosen')
  })
})
```

- [ ] **Schritt 2: Test ausführen — muss fehlschlagen**

```bash
npm run test -- src/lib/social.test.ts
```

Erwartetes Ergebnis: FAIL — `Cannot find module './social'`

- [ ] **Schritt 3: Utility implementieren**

Neue Datei `src/lib/social.ts`:

```typescript
export type SocialPlatform = 'x' | 'facebook' | 'instagram' | 'tiktok'

export function normalizeSocialUsername(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
}

export function buildSocialUrl(platform: SocialPlatform, username: string): string {
  switch (platform) {
    case 'x':         return `https://x.com/${username}`
    case 'facebook':  return `https://facebook.com/${username}`
    case 'instagram': return `https://instagram.com/${username}`
    case 'tiktok':    return `https://tiktok.com/@${username}`
  }
}
```

- [ ] **Schritt 4: Test ausführen — muss bestehen**

```bash
npm run test -- src/lib/social.test.ts
```

Erwartetes Ergebnis: PASS — 10 Tests grün

- [ ] **Schritt 5: Commit**

```bash
git add src/lib/social.ts src/lib/social.test.ts
git commit -m "feat: add social URL utility with tests"
```

---

## Task 4: API-Route erweitern

**Files:**
- Modify: `src/app/api/profil/gemeinderat/route.ts`

- [ ] **Schritt 1: Route aktualisieren**

`src/app/api/profil/gemeinderat/route.ts` vollständig ersetzen:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { z } from 'zod'
import { normalizeSocialUsername } from '@/lib/social'

const usernameField = z
  .string()
  .max(100)
  .nullable()
  .optional()
  .transform(v => normalizeSocialUsername(v))

const schema = z.object({
  fraktion:         z.string().max(100).nullable(),
  ueber_mich:       z.string().max(1000).nullable(),
  kontakt_email:    z.string().email().max(200).nullable(),
  social_x:         usernameField,
  social_facebook:  usernameField,
  social_instagram: usernameField,
  social_tiktok:    usernameField,
})

export const PATCH = withAuth(
  async (req, { user }) => {
    const body = await req.json()
    const v = schema.safeParse(body)
    if (!v.success) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })

    const supabase = await createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        fraktion:         v.data.fraktion,
        ueber_mich:       v.data.ueber_mich,
        kontakt_email:    v.data.kontakt_email,
        social_x:         v.data.social_x ?? null,
        social_facebook:  v.data.social_facebook ?? null,
        social_instagram: v.data.social_instagram ?? null,
        social_tiktok:    v.data.social_tiktok ?? null,
      })
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['gemeinderat'] },
)
```

- [ ] **Schritt 2: Build prüfen**

```bash
npm run build
```

Erwartetes Ergebnis: Kein Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add src/app/api/profil/gemeinderat/route.ts
git commit -m "feat: extend Gemeinderat profile API with social media fields"
```

---

## Task 5: Dashboard-UI (Eingabe)

**Files:**
- Modify: `src/components/dashboard/GemeinderatDashboard.tsx`
- Modify: `src/app/(admin)/dashboard/page.tsx:48-56`

### 5a — GemeinderatDashboard.tsx

- [ ] **Schritt 1: Props-Interface erweitern**

In `src/components/dashboard/GemeinderatDashboard.tsx`, die `Props`-Interface (Zeilen 31–39) ersetzen:

```typescript
interface Props {
  posts: Post[]
  fragen: Frage[]
  gemeindeId: string
  profileId: string
  fraktion: string | null
  ueber_mich: string | null
  kontakt_email: string | null
  social_x: string | null
  social_facebook: string | null
  social_instagram: string | null
  social_tiktok: string | null
}
```

- [ ] **Schritt 2: Destrukturierung und State ergänzen**

Zeile 41 (`export default function GemeinderatDashboard(...)`) ersetzen:

```typescript
export default function GemeinderatDashboard({ posts, fragen, gemeindeId, profileId, fraktion: initialFraktion, ueber_mich: initialUeberMich, kontakt_email: initialKontaktEmail, social_x: initialSocialX, social_facebook: initialSocialFacebook, social_instagram: initialSocialInstagram, social_tiktok: initialSocialTiktok }: Props) {
```

Direkt nach Zeile 45 (`const [kontakt_email, setKontaktEmail] = useState(initialKontaktEmail ?? '')`) vier neue State-Zeilen einfügen:

```typescript
  const [social_x, setSocialX] = useState(initialSocialX ?? '')
  const [social_facebook, setSocialFacebook] = useState(initialSocialFacebook ?? '')
  const [social_instagram, setSocialInstagram] = useState(initialSocialInstagram ?? '')
  const [social_tiktok, setSocialTiktok] = useState(initialSocialTiktok ?? '')
```

- [ ] **Schritt 3: saveProfil-Body erweitern**

In der `saveProfil`-Funktion, `JSON.stringify(...)` (Zeile 62) ersetzen:

```typescript
      body: JSON.stringify({
        fraktion:         fraktion || null,
        ueber_mich:       ueber_mich || null,
        kontakt_email:    kontakt_email || null,
        social_x:         social_x || null,
        social_facebook:  social_facebook || null,
        social_instagram: social_instagram || null,
        social_tiktok:    social_tiktok || null,
      }),
```

- [ ] **Schritt 4: Eingabefelder im Profil-Tab hinzufügen**

Im Profil-Tab (nach dem „Über mich"-Block, vor dem Speichern-Button, ca. Zeile 277) einfügen:

```tsx
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Social Media</p>
              <div className="space-y-3">
                {[
                  { label: 'X / Twitter', key: 'x', value: social_x, setter: setSocialX,
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                  { label: 'Facebook', key: 'facebook', value: social_facebook, setter: setSocialFacebook,
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
                  { label: 'Instagram', key: 'instagram', value: social_instagram, setter: setSocialInstagram,
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> },
                  { label: 'TikTok', key: 'tiktok', value: social_tiktok, setter: setSocialTiktok,
                    icon: <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.27 8.27 0 004.84 1.54V6.83a4.85 4.85 0 01-1.07-.14z"/></svg> },
                ].map(({ label, key, value, setter, icon }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-gray-400 shrink-0 w-5 flex justify-center">{icon}</span>
                    <label htmlFor={`social-${key}`} className="text-xs text-gray-500 w-24 shrink-0">{label}</label>
                    <input
                      id={`social-${key}`}
                      type="text"
                      value={value}
                      onChange={e => setter(e.target.value)}
                      placeholder="@username"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            </div>
```

- [ ] **Schritt 5: Build prüfen**

```bash
npm run build
```

Erwartetes Ergebnis: Kein Fehler.

### 5b — dashboard/page.tsx

- [ ] **Schritt 6: Social-Props an GemeinderatDashboard übergeben**

In `src/app/(admin)/dashboard/page.tsx`, den `<GemeinderatDashboard>`-Block (Zeilen 48–57) ersetzen:

```tsx
      <GemeinderatDashboard
        posts={(gemeinderatPostsResult.data ?? []) as Parameters<typeof GemeinderatDashboard>[0]['posts']}
        fragen={(gemeinderatFragenResult.data ?? []) as unknown as Parameters<typeof GemeinderatDashboard>[0]['fragen']}
        gemeindeId={profile.gemeinde_id!}
        profileId={user!.id}
        fraktion={profile.fraktion ?? null}
        ueber_mich={profile.ueber_mich ?? null}
        kontakt_email={profile.kontakt_email ?? null}
        social_x={profile.social_x ?? null}
        social_facebook={profile.social_facebook ?? null}
        social_instagram={profile.social_instagram ?? null}
        social_tiktok={profile.social_tiktok ?? null}
      />
```

- [ ] **Schritt 7: Build prüfen**

```bash
npm run build
```

Erwartetes Ergebnis: Kein Fehler.

- [ ] **Schritt 8: Commit**

```bash
git add src/components/dashboard/GemeinderatDashboard.tsx src/app/\(admin\)/dashboard/page.tsx
git commit -m "feat: add social media input fields to Gemeinderat profile dashboard"
```

---

## Task 6: Öffentliche Übersicht (Icons)

**Files:**
- Modify: `src/app/(app)/gemeinderat/page.tsx:38`
- Modify: `src/app/(app)/gemeinderat/GemeinderatClient.tsx`

### 6a — page.tsx (Daten laden)

- [ ] **Schritt 1: Select-Query erweitern**

In `src/app/(app)/gemeinderat/page.tsx`, Zeile 38 ersetzen:

```typescript
      .select('id, display_name, verein_name, fraktion, ueber_mich, kontakt_email, social_x, social_facebook, social_instagram, social_tiktok')
```

### 6b — GemeinderatClient.tsx

- [ ] **Schritt 2: Rat-Interface erweitern**

In `src/app/(app)/gemeinderat/GemeinderatClient.tsx`, das `Rat`-Interface (Zeilen 24–31) ersetzen:

```typescript
interface Rat {
  id: string
  display_name: string | null
  verein_name: string | null
  fraktion: string | null
  ueber_mich: string | null
  kontakt_email: string | null
  social_x: string | null
  social_facebook: string | null
  social_instagram: string | null
  social_tiktok: string | null
}
```

- [ ] **Schritt 3: buildSocialUrl importieren**

Import-Zeile in `GemeinderatClient.tsx` (nach den bestehenden Imports) ergänzen:

```typescript
import { buildSocialUrl } from '@/lib/social'
```

- [ ] **Schritt 4: Social-Icons in der Rat-Karte rendern**

Im Räte-Tab, innerhalb der `<div className="flex-1 min-w-0">` (Zeilen 213–218), den Inhalt ersetzen:

```tsx
                    <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{name}</p>
                      {rat.social_x && (
                        <a href={buildSocialUrl('x', rat.social_x)} target="_blank" rel="noopener noreferrer" aria-label={`X-Profil von ${name}`} onClick={e => e.stopPropagation()} className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </a>
                      )}
                      {rat.social_facebook && (
                        <a href={buildSocialUrl('facebook', rat.social_facebook)} target="_blank" rel="noopener noreferrer" aria-label={`Facebook-Profil von ${name}`} onClick={e => e.stopPropagation()} className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        </a>
                      )}
                      {rat.social_instagram && (
                        <a href={buildSocialUrl('instagram', rat.social_instagram)} target="_blank" rel="noopener noreferrer" aria-label={`Instagram-Profil von ${name}`} onClick={e => e.stopPropagation()} className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                        </a>
                      )}
                      {rat.social_tiktok && (
                        <a href={buildSocialUrl('tiktok', rat.social_tiktok)} target="_blank" rel="noopener noreferrer" aria-label={`TikTok-Profil von ${name}`} onClick={e => e.stopPropagation()} className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.27 8.27 0 004.84 1.54V6.83a4.85 4.85 0 01-1.07-.14z"/></svg>
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {rat.fraktion ? `${rat.fraktion} · ` : ''}{gemeindeName}
                    </p>
```

- [ ] **Schritt 5: Build und Tests ausführen**

```bash
npm run build && npm run test
```

Erwartetes Ergebnis: Build erfolgreich, alle Tests grün.

- [ ] **Schritt 6: Commit**

```bash
git add src/app/\(app\)/gemeinderat/page.tsx src/app/\(app\)/gemeinderat/GemeinderatClient.tsx
git commit -m "feat: show social media icons next to Gemeinderat names in public view"
```

---

## Abschluss-Checkliste

- [ ] Migration 035 in Supabase Dashboard ausgeführt
- [ ] `npm run build` ohne Fehler
- [ ] `npm run test` — alle Tests grün (inkl. 10 neue social.test.ts)
- [ ] Im Gemeinderat-Dashboard: Profil-Tab zeigt 4 Social-Eingabefelder
- [ ] `@username` eingeben → nach Speichern ohne `@` in DB
- [ ] Öffentliche Übersicht: Icons erscheinen nur wenn Username gesetzt
- [ ] Icon-Link öffnet auf Mobile die jeweilige App (Universal Link)
