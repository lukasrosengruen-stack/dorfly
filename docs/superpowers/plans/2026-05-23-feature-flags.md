# Feature-Flag-System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-Gemeinde Feature-Toggles im Super-Admin-Dashboard — Verwaltung kann optionale Features (Abfallkalender, Umfragen, Gemeinderat, Gewerbe, Vereine, Marktplatz) ein-/ausschalten; Navigation und Routen reagieren darauf automatisch.

**Architecture:** Zentrales `GemeindeFeatures`-TypeScript-Schema über `src/lib/features.ts`. API-Endpunkt `PATCH /api/admin/gemeinden/[id]/features` merged Partial-Updates in das JSONB-Feld. Super-Admin-Dashboard erhält Slide-over mit Toggle-Switches. Navigation und Seiten lesen das Flag und blenden Items aus / leiten um.

**Tech Stack:** Next.js 16 App Router (Server + Client Components), Supabase, TypeScript, Tailwind v4, Zod, Lucide Icons, Sonner (Toasts)

---

## File Map

| Datei | Aktion | Zweck |
|---|---|---|
| `supabase/migrations/028_feature_flags.sql` | Erstellen | `wasteCalendarEnabled` → `abfallkalender` umbenennen |
| `src/lib/features.ts` | Erstellen | GemeindeFeatures-Typ + Helper-Funktionen |
| `src/lib/features.test.ts` | Erstellen | Unit-Tests für Helper-Funktionen |
| `src/app/api/admin/gemeinden/[id]/features/route.ts` | Erstellen | PATCH-Endpunkt für Feature-Updates |
| `src/app/admin/dashboard/types.ts` | Ändern | GemeindeFeatures-Typ + features-Feld in Gemeinde |
| `src/app/admin/dashboard/page.tsx` | Ändern | `features` in Gemeinde-Query einschließen |
| `src/app/admin/dashboard/GemeindeKonfigSlideOver.tsx` | Erstellen | Slide-over mit Feature-Toggles |
| `src/app/admin/dashboard/AdminDashboardClient.tsx` | Ändern | ⚙-Icon + SlideOver einbinden |
| `src/components/layout/BottomNav.tsx` | Ändern | Features-Prop + dynamische Items |
| `src/components/layout/SidebarNav.tsx` | Ändern | Features-Prop + dynamisches Bürgermeister-Label |
| `src/app/(app)/layout.tsx` | Ändern | `features` aus `gemeinde` an BottomNav übergeben |
| `src/app/(admin)/layout.tsx` | Ändern | `getGemeinde()` + `features` an SidebarNav übergeben |
| `src/app/(app)/abfallkalender/page.tsx` | Ändern | Auf `isFeatureAktiv` umstellen |
| `src/app/(app)/abfallkalender/einstellungen/page.tsx` | Ändern | Auf `isFeatureAktiv` umstellen |
| `src/app/(app)/umfragen/page.tsx` | Ändern | Route-Guard hinzufügen |
| `src/app/(app)/gemeinderat/page.tsx` | Ändern | Route-Guard hinzufügen |
| `src/app/(app)/lokale-angebote/page.tsx` | Ändern | Route-Guard hinzufügen |
| `src/app/(app)/vereine/page.tsx` | Ändern | Route-Guard hinzufügen |
| `src/app/(app)/marktplatz/page.tsx` | Ändern | Route-Guard hinzufügen |
| `src/app/(admin)/dashboard/page.tsx` | Ändern | Auf `isFeatureAktiv` umstellen |

---

## Task 1: SQL-Migration — Key umbenennen

**Files:**
- Create: `supabase/migrations/028_feature_flags.sql`

- [ ] **Schritt 1: Migration-Datei erstellen**

```sql
-- Umbenennung des Feature-Flag-Keys für Abfallkalender.
-- wasteCalendarEnabled wird zu abfallkalender für einheitliche Benennung.
UPDATE gemeinden
SET features = (features - 'wasteCalendarEnabled')
  || jsonb_build_object('abfallkalender', (features->>'wasteCalendarEnabled')::boolean)
WHERE features ? 'wasteCalendarEnabled';
```

- [ ] **Schritt 2: Migration in Supabase ausführen**

SQL im Supabase Dashboard (SQL Editor) oder über CLI ausführen:
```bash
npx supabase db push
```
Erwartetes Ergebnis: Keine Fehler. Alle Gemeinden mit `wasteCalendarEnabled` haben jetzt stattdessen `abfallkalender`.

- [ ] **Schritt 3: Commit**

```bash
git add supabase/migrations/028_feature_flags.sql
git commit -m "feat: migration — rename wasteCalendarEnabled to abfallkalender in features JSONB"
```

---

## Task 2: Helper-Modul `src/lib/features.ts`

**Files:**
- Create: `src/lib/features.ts`
- Create: `src/lib/features.test.ts`

- [ ] **Schritt 1: Failing Tests schreiben**

Datei `src/lib/features.test.ts` erstellen:

```typescript
import { describe, it, expect } from 'vitest'
import { getFeatures, isFeatureAktiv, getBuergermeisterLabel } from './features'

describe('getFeatures', () => {
  it('gibt leeres Objekt zurück wenn gemeinde null ist', () => {
    expect(getFeatures(null)).toEqual({})
  })

  it('gibt leeres Objekt zurück wenn features null ist', () => {
    expect(getFeatures({ features: null })).toEqual({})
  })

  it('gibt features zurück wenn vorhanden', () => {
    const gemeinde = { features: { abfallkalender: true, umfragen: false } }
    expect(getFeatures(gemeinde)).toEqual({ abfallkalender: true, umfragen: false })
  })
})

describe('isFeatureAktiv', () => {
  it('gibt false zurück wenn gemeinde null ist', () => {
    expect(isFeatureAktiv(null, 'abfallkalender')).toBe(false)
  })

  it('gibt false zurück wenn feature nicht gesetzt ist', () => {
    expect(isFeatureAktiv({ features: {} }, 'abfallkalender')).toBe(false)
  })

  it('gibt false zurück wenn feature explizit false ist', () => {
    expect(isFeatureAktiv({ features: { abfallkalender: false } }, 'abfallkalender')).toBe(false)
  })

  it('gibt true zurück wenn feature aktiviert ist', () => {
    expect(isFeatureAktiv({ features: { abfallkalender: true } }, 'abfallkalender')).toBe(true)
  })
})

describe('getBuergermeisterLabel', () => {
  it('gibt Bürgermeister-Labels zurück wenn nicht konfiguriert', () => {
    const label = getBuergermeisterLabel(null)
    expect(label.long).toBe('Frag den Bürgermeister')
    expect(label.short).toBe('Frag BM')
  })

  it('gibt Verwaltungs-Labels zurück wenn verwaltung konfiguriert', () => {
    const label = getBuergermeisterLabel({ features: { buergermeisterLabel: 'verwaltung' } })
    expect(label.long).toBe('Frag die Verwaltung')
    expect(label.short).toBe('Frag VW')
  })

  it('gibt Bürgermeister-Labels zurück wenn buergermeister konfiguriert', () => {
    const label = getBuergermeisterLabel({ features: { buergermeisterLabel: 'buergermeister' } })
    expect(label.long).toBe('Frag den Bürgermeister')
    expect(label.short).toBe('Frag BM')
  })
})
```

- [ ] **Schritt 2: Tests ausführen — sicherstellen dass sie fehlschlagen**

```bash
npm run test -- features.test.ts
```
Erwartetes Ergebnis: FAIL — `Cannot find module './features'`

- [ ] **Schritt 3: `src/lib/features.ts` implementieren**

```typescript
export type GemeindeFeatures = {
  abfallkalender?:      boolean
  umfragen?:            boolean
  gemeinderat?:         boolean
  gewerbe?:             boolean
  vereine?:             boolean
  marktplatz?:          boolean
  buergermeisterLabel?: 'buergermeister' | 'verwaltung'
}

type FeatureToggleKey = Exclude<keyof GemeindeFeatures, 'buergermeisterLabel'>

export function getFeatures(gemeinde: { features: unknown } | null | undefined): GemeindeFeatures {
  if (!gemeinde?.features || typeof gemeinde.features !== 'object' || Array.isArray(gemeinde.features)) {
    return {}
  }
  return gemeinde.features as GemeindeFeatures
}

export function isFeatureAktiv(
  gemeinde: { features: unknown } | null | undefined,
  feature: FeatureToggleKey,
): boolean {
  return getFeatures(gemeinde)[feature] === true
}

export function getBuergermeisterLabel(
  gemeinde: { features: unknown } | null | undefined,
): { long: string; short: string } {
  const label = getFeatures(gemeinde).buergermeisterLabel ?? 'buergermeister'
  if (label === 'verwaltung') {
    return { long: 'Frag die Verwaltung', short: 'Frag VW' }
  }
  return { long: 'Frag den Bürgermeister', short: 'Frag BM' }
}
```

- [ ] **Schritt 4: Tests ausführen — sicherstellen dass sie bestehen**

```bash
npm run test -- features.test.ts
```
Erwartetes Ergebnis: PASS (alle 8 Tests grün)

- [ ] **Schritt 5: Commit**

```bash
git add src/lib/features.ts src/lib/features.test.ts
git commit -m "feat: add GemeindeFeatures type and helper module"
```

---

## Task 3: PATCH-API-Endpunkt

**Files:**
- Create: `src/app/api/admin/gemeinden/[id]/features/route.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'
import type { GemeindeFeatures } from '@/lib/features'

export const PATCH = withAuth(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const body = await req.json() as Partial<GemeindeFeatures>

    const supabase = await createClient()

    const { data: gemeinde, error: fetchError } = await supabase
      .from('gemeinden')
      .select('features')
      .eq('id', id)
      .single()

    if (fetchError || !gemeinde) return apiError('Gemeinde nicht gefunden', 404)

    const current = (gemeinde.features ?? {}) as GemeindeFeatures
    const updated = { ...current, ...body }

    const { data, error } = await supabase
      .from('gemeinden')
      .update({ features: updated })
      .eq('id', id)
      .select('features')
      .single()

    if (error) return apiError(error.message)

    return NextResponse.json({ features: data.features })
  },
  { roles: ['super_admin'] },
)
```

- [ ] **Schritt 2: Manuell testen**

In einem Terminal oder mit curl/Postman:
```bash
# Zuerst einloggen und Session-Cookie holen, dann:
curl -X PATCH https://<subdomain>.dorfly.de/api/admin/gemeinden/<id>/features \
  -H "Content-Type: application/json" \
  -d '{"abfallkalender": true}'
```
Erwartetes Ergebnis: `{"features": {"abfallkalender": true}}`

- [ ] **Schritt 3: Commit**

```bash
git add src/app/api/admin/gemeinden/
git commit -m "feat: add PATCH /api/admin/gemeinden/[id]/features endpoint"
```

---

## Task 4: Types + Admin-Page Query erweitern

**Files:**
- Modify: `src/app/admin/dashboard/types.ts`
- Modify: `src/app/admin/dashboard/page.tsx`

- [ ] **Schritt 1: `Gemeinde`-Typ in `types.ts` um `features` erweitern**

In `src/app/admin/dashboard/types.ts` den `Gemeinde`-Typ ändern:

```typescript
// Vorher:
export type Gemeinde = {
  id: string
  name: string
  slug: string
  bundesland: string
  plz: string | null
  einwohner: number | null
}

// Nachher:
import type { GemeindeFeatures } from '@/lib/features'

export type Gemeinde = {
  id: string
  name: string
  slug: string
  bundesland: string
  plz: string | null
  einwohner: number | null
  features: GemeindeFeatures | null
}
```

- [ ] **Schritt 2: Query in `page.tsx` um `features` erweitern**

In `src/app/admin/dashboard/page.tsx` Zeile 97 ändern:

```typescript
// Vorher:
supabase.from('gemeinden').select('id, name, slug, bundesland, plz, einwohner').order('name'),

// Nachher:
supabase.from('gemeinden').select('id, name, slug, bundesland, plz, einwohner, features').order('name'),
```

- [ ] **Schritt 3: Build prüfen**

```bash
npm run build 2>&1 | tail -20
```
Erwartetes Ergebnis: Keine TypeScript-Fehler.

- [ ] **Schritt 4: Commit**

```bash
git add src/app/admin/dashboard/types.ts src/app/admin/dashboard/page.tsx
git commit -m "feat: include features field in admin Gemeinde type and query"
```

---

## Task 5: `GemeindeKonfigSlideOver` Komponente

**Files:**
- Create: `src/app/admin/dashboard/GemeindeKonfigSlideOver.tsx`

- [ ] **Schritt 1: Komponente erstellen**

```typescript
'use client'

import { useState } from 'react'
import { X, Settings } from 'lucide-react'
import { toast } from 'sonner'
import type { GemeindeFeatures } from '@/lib/features'

const FEATURE_LABELS: { key: keyof Omit<GemeindeFeatures, 'buergermeisterLabel'>; label: string }[] = [
  { key: 'abfallkalender', label: 'Abfallkalender' },
  { key: 'umfragen',       label: 'Umfragen' },
  { key: 'gemeinderat',    label: 'Gemeinderat' },
  { key: 'gewerbe',        label: 'Gewerbe & Lokale Angebote' },
  { key: 'vereine',        label: 'Vereine' },
  { key: 'marktplatz',     label: 'Marktplatz' },
]

interface Props {
  gemeindeId: string
  gemeindeName: string
  initialFeatures: GemeindeFeatures
  open: boolean
  onClose: () => void
}

export default function GemeindeKonfigSlideOver({
  gemeindeId,
  gemeindeName,
  initialFeatures,
  open,
  onClose,
}: Props) {
  const [features, setFeatures] = useState<GemeindeFeatures>(initialFeatures)
  const [saving, setSaving] = useState<string | null>(null)

  async function updateFeature(patch: Partial<GemeindeFeatures>) {
    const key = Object.keys(patch)[0]
    setSaving(key)
    const optimistic = { ...features, ...patch }
    setFeatures(optimistic)

    try {
      const res = await fetch(`/api/admin/gemeinden/${gemeindeId}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setFeatures(data.features as GemeindeFeatures)
    } catch (e) {
      setFeatures(features) // rollback
      toast.error('Fehler beim Speichern: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(null)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Konfiguration: ${gemeindeName}`}
        className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Konfiguration</p>
              <p className="text-xs text-gray-400 truncate max-w-[180px]">{gemeindeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Konfiguration schließen"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* Feature Toggles */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Optionale Features
            </p>
            <div className="space-y-3">
              {FEATURE_LABELS.map(({ key, label }) => {
                const aktiv = features[key] === true
                const isSaving = saving === key
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{label}</span>
                    <button
                      role="switch"
                      aria-checked={aktiv}
                      aria-label={`${label} ${aktiv ? 'deaktivieren' : 'aktivieren'}`}
                      disabled={isSaving}
                      onClick={() => updateFeature({ [key]: !aktiv })}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                        aktiv ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                          aktiv ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Bürgermeister Label */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Einstellungen
            </p>
            <div>
              <p className="text-sm text-gray-700 mb-2">„Frag den…"-Bezeichnung</p>
              <div className="flex flex-col gap-2">
                {(['buergermeister', 'verwaltung'] as const).map((option) => {
                  const checked = (features.buergermeisterLabel ?? 'buergermeister') === option
                  return (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="buergermeisterLabel"
                        value={option}
                        checked={checked}
                        onChange={() => updateFeature({ buergermeisterLabel: option })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">
                        {option === 'buergermeister' ? 'Frag den Bürgermeister' : 'Frag die Verwaltung'}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}
```

- [ ] **Schritt 2: Commit**

```bash
git add src/app/admin/dashboard/GemeindeKonfigSlideOver.tsx
git commit -m "feat: add GemeindeKonfigSlideOver component with feature toggles"
```

---

## Task 6: AdminDashboardClient verdrahten

**Files:**
- Modify: `src/app/admin/dashboard/AdminDashboardClient.tsx`

- [ ] **Schritt 1: ⚙-Icon und SlideOver in AdminDashboardClient einbinden**

Die Datei `src/app/admin/dashboard/AdminDashboardClient.tsx` wie folgt ändern:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Settings } from 'lucide-react'
import type { DashboardData } from './types'
import { PRODUZENTEN_ROLLEN } from './types'
import HealthScoreCard from './HealthScoreCard'
import KpiKacheln from './KpiKacheln'
import RollenTabelle from './RollenTabelle'
import ProduzentenTab from './ProduzentenTab'
import AdminEinladungSection from './AdminEinladungSection'
import GemeindenSection from './GemeindenSection'
import GemeindeKonfigSlideOver from './GemeindeKonfigSlideOver'
import type { GemeindeFeatures } from '@/lib/features'

export default function AdminDashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<string>(PRODUZENTEN_ROLLEN[0].key)
  const [slideOverOpen, setSlideOverOpen] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleGemeindeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    router.push(val ? `/admin/dashboard?gemeinde=${val}` : '/admin/dashboard')
  }

  const activeGemeinde = data.gemeinden.find(g => g.id === data.activeGemeindeId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super-Admin-Dashboard</h1>
            {activeGemeinde && (
              <p className="text-sm text-gray-500 mt-0.5">{activeGemeinde.name}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium transition-colors">
              <LogOut className="w-4 h-4" aria-hidden="true" /> Abmelden
            </button>
            <label htmlFor="gemeinde-select" className="text-sm text-gray-500 whitespace-nowrap">
              Gemeinde:
            </label>
            <select
              id="gemeinde-select"
              value={data.activeGemeindeId ?? ''}
              onChange={handleGemeindeChange}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Alle Gemeinden</option>
              {data.gemeinden.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            {activeGemeinde && (
              <button
                onClick={() => setSlideOverOpen(true)}
                aria-label={`Konfiguration für ${activeGemeinde.name}`}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Health Score */}
        {/* ... rest unverändert ... */}
```

> **Hinweis:** Nur der Header-Bereich und die Imports/State ändern sich. Alles ab `{/* Health Score */}` bleibt identisch wie zuvor. Den kompletten Rest der Funktion (HealthScoreCard, KpiKacheln, RollenTabelle, ProduzentenTab, AdminEinladungSection, GemeindenSection) unverändert lassen.

Direkt vor dem schließenden `</div>` der äußersten `<div className="min-h-screen bg-gray-50">` das SlideOver einfügen:

```typescript
        {activeGemeinde && (
          <GemeindeKonfigSlideOver
            gemeindeId={activeGemeinde.id}
            gemeindeName={activeGemeinde.name}
            initialFeatures={activeGemeinde.features ?? {}}
            open={slideOverOpen}
            onClose={() => setSlideOverOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: Im Browser testen**

```bash
npm run dev
```
- Auf `/admin/dashboard` navigieren
- Eine Gemeinde im Dropdown auswählen → ⚙-Icon erscheint
- ⚙ klicken → Slide-over öffnet sich von rechts
- Toggle klicken → speichert sofort (kein Ladezustand sichtbar bei schneller Verbindung)
- Backdrop klicken → Slide-over schließt sich
- Ohne ausgewählte Gemeinde → kein ⚙-Icon sichtbar

- [ ] **Schritt 3: Commit**

```bash
git add src/app/admin/dashboard/AdminDashboardClient.tsx
git commit -m "feat: wire GemeindeKonfigSlideOver into admin dashboard header"
```

---

## Task 7: BottomNav — Feature-abhängige Items

**Files:**
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Schritt 1: BottomNav aktualisieren**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Newspaper, AlertTriangle, Grid2x2, BarChart2, MessageCircleQuestion } from 'lucide-react'
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

  const leftItems = [
    { href: '/feed',    label: 'Newsfeed', icon: Newspaper },
    { href: '/maengel', label: 'Mängel',   icon: AlertTriangle },
  ]

  const rightItems = [
    ...(features?.umfragen === true
      ? [{ href: '/umfragen', label: 'Umfragen', icon: BarChart2 }]
      : []),
    { href: '/buergermeister', label: buergermeisterShortLabel, icon: MessageCircleQuestion },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e2e8f0] z-50">
      <div className="flex max-w-lg mx-auto items-end h-[68px] pb-3">
        {leftItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 pt-2 text-[9.5px] font-semibold transition-colors',
                active ? 'text-primary-500' : 'text-[#64748b]'
              )}>
              <Icon className="w-[22px] h-[22px]" aria-hidden="true" strokeWidth={active ? 2.5 : 1.5} />
              <span>{label}</span>
            </Link>
          )
        })}

        {/* Center Home Button */}
        <Link
          href="/home"
          aria-label="Startseite"
          aria-current={pathname === '/home' ? 'page' : undefined}
          className="flex flex-col items-center justify-end pb-0 px-3"
        >
          <div className={clsx(
            'w-[52px] h-[52px] rounded-2xl flex items-center justify-center -mt-4',
            'shadow-[0_4px_18px_rgba(15,45,107,0.4)]',
            pathname === '/home' ? 'bg-primary-600' : 'bg-primary-500'
          )}>
            <Grid2x2 className="w-6 h-6 text-white" aria-hidden="true" strokeWidth={1.5} />
          </div>
        </Link>

        {rightItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex-1 flex flex-col items-center gap-0.5 pt-2 text-[9.5px] font-semibold transition-colors',
                active ? 'text-primary-500' : 'text-[#64748b]'
              )}>
              <Icon className="w-[22px] h-[22px]" aria-hidden="true" strokeWidth={active ? 2.5 : 1.5} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Schritt 2: Commit**

```bash
git add src/components/layout/BottomNav.tsx
git commit -m "feat: BottomNav accepts features prop, hides disabled items dynamically"
```

---

## Task 8: SidebarNav — Bürgermeister-Label

**Files:**
- Modify: `src/components/layout/SidebarNav.tsx`

- [ ] **Schritt 1: SidebarNav aktualisieren**

Die Prop-Signatur und den `verwaltungItems`-Aufbau ändern:

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Newspaper, AlertTriangle, MessageCircleQuestion, LayoutDashboard, User, Scale } from 'lucide-react'
import { clsx } from 'clsx'

const vereinItems = [
  { href: '/dashboard',      label: 'Meine Beiträge', icon: Newspaper },
  { href: '/profil',         label: 'Profil',          icon: User },
]

const gemeinderatItems = [
  { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/gemeinderat',    label: 'Gemeinderat',     icon: Scale },
  { href: '/profil',         label: 'Profil',          icon: User },
]

interface Props {
  gemeindeName?: string
  role?: string
  buergermeisterLongLabel?: string
}

export default function SidebarNav({
  gemeindeName,
  role,
  buergermeisterLongLabel = 'Bürgerfragen',
}: Props) {
  const pathname = usePathname()

  const verwaltungItems = [
    { href: '/feed',           label: 'News',                   icon: Newspaper },
    { href: '/maengel',        label: 'Mängel',                  icon: AlertTriangle },
    { href: '/buergermeister', label: buergermeisterLongLabel,   icon: MessageCircleQuestion },
    { href: '/dashboard',      label: 'Dashboard',               icon: LayoutDashboard },
    { href: '/profil',         label: 'Profil',                  icon: User },
  ]

  const items = role === 'verein' || role === 'organisation' ? vereinItems
    : role === 'gemeinderat' ? gemeinderatItems
    : verwaltungItems

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="font-extrabold text-primary-500 text-xl tracking-tight">Dorfly</p>
        {gemeindeName && <p className="text-xs text-gray-400 mt-0.5 truncate">{gemeindeName}</p>}
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className={clsx('w-4 h-4 shrink-0', active && 'stroke-[2.5]')} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 px-3 py-2">
          {role === 'verein' || role === 'organisation' ? 'Vereinsansicht' : role === 'gemeinderat' ? 'Gemeinderatsansicht' : 'Verwaltungsansicht'}
        </p>
      </div>
    </aside>
  )
}
```

- [ ] **Schritt 2: Commit**

```bash
git add src/components/layout/SidebarNav.tsx
git commit -m "feat: SidebarNav accepts features + buergermeisterLongLabel props"
```

---

## Task 9: Layouts — Features durchreichen

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(admin)/layout.tsx`

- [ ] **Schritt 1: `(app)/layout.tsx` — Features an BottomNav übergeben**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import BottomNav from '@/components/layout/BottomNav'
import PushNotificationInit from '@/components/PushNotificationInit'
import { getFeatures, getBuergermeisterLabel } from '@/lib/features'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, gemeinde] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    getGemeinde(),
  ])

  const profile = profileResult.data
  const primaryColor = gemeinde?.primary_color ?? '#0f2d6b'
  const features = getFeatures(gemeinde)
  const { short: buergermeisterShortLabel } = getBuergermeisterLabel(gemeinde)

  return (
    <div
      className="min-h-screen bg-[#F4F6F9]"
      style={{ '--color-primary': primaryColor } as React.CSSProperties}
    >
      {gemeinde?.slug && <PushNotificationInit userId={user.id} gemeindeSlug={gemeinde.slug} />}
      <main id="main-content" tabIndex={-1} className="max-w-lg mx-auto pb-20 outline-none">
        {children}
      </main>
      <BottomNav
        role={profile?.role}
        features={features}
        buergermeisterShortLabel={buergermeisterShortLabel}
      />
    </div>
  )
}
```

- [ ] **Schritt 2: `(admin)/layout.tsx` — Features an SidebarNav übergeben**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getGemeinde } from '@/lib/gemeinde'
import SidebarNav from '@/components/layout/SidebarNav'
import { getBuergermeisterLabel } from '@/lib/features'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, gemeinde] = await Promise.all([
    supabase.from('profiles').select('role, gemeinden(name)').eq('id', user.id).single(),
    getGemeinde(),
  ])

  const profile = profileResult.data

  if (!profile || !['verwaltung', 'super_admin', 'verein', 'organisation', 'gemeinderat'].includes(profile.role)) {
    redirect('/feed')
  }

  const gemeindeName = (profile.gemeinden as unknown as { name: string } | null)?.name
  const { long: buergermeisterLongLabel } = getBuergermeisterLabel(gemeinde)

  return (
    <div className="flex min-h-screen bg-gray-100">
      <SidebarNav
        gemeindeName={gemeindeName}
        role={profile.role}
        buergermeisterLongLabel={buergermeisterLongLabel}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Schritt 3: Build + Browser-Test**

```bash
npm run build 2>&1 | tail -20
```
Erwartetes Ergebnis: Keine TypeScript-Fehler.

Im Browser:
- Gemeinde mit `umfragen: false` → „Umfragen"-Item fehlt in BottomNav
- Gemeinde mit `buergermeisterLabel: 'verwaltung'` → Label lautet „Frag VW" in BottomNav, „Frag die Verwaltung" in SidebarNav

- [ ] **Schritt 4: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/app/\(admin\)/layout.tsx
git commit -m "feat: pass gemeinde features to BottomNav and SidebarNav from layouts"
```

---

## Task 10: Route-Guards für optionale Feature-Seiten

**Files:**
- Modify: `src/app/(app)/abfallkalender/page.tsx`
- Modify: `src/app/(app)/abfallkalender/einstellungen/page.tsx`
- Modify: `src/app/(app)/umfragen/page.tsx`
- Modify: `src/app/(app)/gemeinderat/page.tsx`
- Modify: `src/app/(app)/lokale-angebote/page.tsx`
- Modify: `src/app/(app)/vereine/page.tsx`
- Modify: `src/app/(app)/marktplatz/page.tsx`
- Modify: `src/app/(admin)/dashboard/page.tsx`

Das Muster ist für alle Seiten gleich. Direkt nach dem `getGemeinde()`-Aufruf den Guard einfügen.

- [ ] **Schritt 1: `abfallkalender/page.tsx` — auf `isFeatureAktiv` umstellen**

Zeile 13-14 ersetzen:
```typescript
// Vorher:
const featureAktiv = (gemeinde?.features as { wasteCalendarEnabled?: boolean } | null)?.wasteCalendarEnabled ?? false
if (!featureAktiv) redirect('/home')

// Nachher:
import { isFeatureAktiv } from '@/lib/features'
// ...
if (!isFeatureAktiv(gemeinde, 'abfallkalender')) redirect('/home')
```

- [ ] **Schritt 2: `abfallkalender/einstellungen/page.tsx` — gleiche Umstellung**

```typescript
// Vorher:
const featureAktiv = (gemeinde?.features as { wasteCalendarEnabled?: boolean } | null)?.wasteCalendarEnabled ?? false
if (!featureAktiv) redirect('/home')

// Nachher:
import { isFeatureAktiv } from '@/lib/features'
// ...
if (!isFeatureAktiv(gemeinde, 'abfallkalender')) redirect('/home')
```

- [ ] **Schritt 3: `umfragen/page.tsx` — Route-Guard hinzufügen**

Nach `const gemeinde = await getGemeinde()` einfügen (getGemeinde()-Aufruf ist bereits vorhanden):

```typescript
import { isFeatureAktiv } from '@/lib/features'
// ...
const gemeinde = await getGemeinde()
if (!isFeatureAktiv(gemeinde, 'umfragen')) redirect('/home')
```

- [ ] **Schritt 4: `gemeinderat/page.tsx` — Route-Guard hinzufügen**

`getGemeinde()` wird in dieser Datei noch nicht aufgerufen. Imports und Guard direkt nach der Funktionsdeklaration ergänzen:

```typescript
// Neue Imports hinzufügen:
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'

export default async function GemeinderatPage() {
  const gemeinde = await getGemeinde()
  if (!isFeatureAktiv(gemeinde, 'gemeinderat')) redirect('/home')

  // Ab hier: bestehender Code unverändert
  const supabase = await createClient()
  // ...
```

> `getGemeinde()` nutzt React's `cache()` — mehrfache Aufrufe in derselben Request kosten nichts extra.

- [ ] **Schritt 5: `lokale-angebote/page.tsx` — Route-Guard**

```typescript
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
// Am Anfang der Page-Funktion:
const gemeinde = await getGemeinde()
if (!isFeatureAktiv(gemeinde, 'gewerbe')) redirect('/home')
```

- [ ] **Schritt 6: `vereine/page.tsx` — Route-Guard**

```typescript
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
// Am Anfang der Page-Funktion:
const gemeinde = await getGemeinde()
if (!isFeatureAktiv(gemeinde, 'vereine')) redirect('/home')
```

- [ ] **Schritt 7: `marktplatz/page.tsx` — Route-Guard**

```typescript
import { getGemeinde } from '@/lib/gemeinde'
import { isFeatureAktiv } from '@/lib/features'
// Bereits getGemeinde()-Aufruf vorhanden — Guard hinzufügen:
const gemeinde = await getGemeinde()
if (!isFeatureAktiv(gemeinde, 'marktplatz')) redirect('/home')
```

- [ ] **Schritt 8: `(admin)/dashboard/page.tsx` — AbfallkalenderSection auf `isFeatureAktiv` umstellen**

Zeile 126 in `src/app/(admin)/dashboard/page.tsx` ersetzen:

```typescript
// Vorher:
const wasteFeatureAktiv = (gemeinde?.features as { wasteCalendarEnabled?: boolean } | null | undefined)?.wasteCalendarEnabled ?? false

// Nachher:
import { isFeatureAktiv } from '@/lib/features'
// ...
const wasteFeatureAktiv = isFeatureAktiv(gemeinde, 'abfallkalender')
```

- [ ] **Schritt 9: Build prüfen**

```bash
npm run build 2>&1 | tail -30
```
Erwartetes Ergebnis: Keine TypeScript-Fehler.

- [ ] **Schritt 10: End-to-End-Test im Browser**

1. Im Super-Admin-Dashboard `umfragen: false` für eine Testgemeinde setzen
2. Als Bürger dieser Gemeinde einloggen → „Umfragen"-Item fehlt in BottomNav
3. Direkt `/umfragen` aufrufen → redirect auf `/home`
4. `umfragen: true` setzen → Item erscheint wieder, Seite lädt normal
5. `buergermeisterLabel: 'verwaltung'` setzen → Label ändert sich in BottomNav

- [ ] **Schritt 11: Alle Tests ausführen**

```bash
npm run test
```
Erwartetes Ergebnis: Alle Tests grün (inkl. neue `features.test.ts`)

- [ ] **Schritt 12: Commit**

```bash
git add src/app/\(app\)/abfallkalender/ src/app/\(app\)/umfragen/page.tsx \
        src/app/\(app\)/gemeinderat/page.tsx src/app/\(app\)/lokale-angebote/page.tsx \
        src/app/\(app\)/vereine/page.tsx src/app/\(app\)/marktplatz/page.tsx \
        src/app/\(admin\)/dashboard/page.tsx
git commit -m "feat: add route guards for all optional features using isFeatureAktiv"
```

---

## Fertig

Nach Task 10 ist das Feature-Flag-System vollständig:
- Super-Admin setzt Toggles per Slide-over pro Gemeinde
- Navigation blendet deaktivierte Features aus
- Routen leiten auf `/home` um wenn Feature nicht aktiv
- `buergermeisterLabel` steuert den Label-Text in Navigation und Seitentiteln
