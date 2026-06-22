# Warnmeldungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baue das Warnmeldungen-Feature: DB-Erweiterung, DWD-Cron, Admin-UI im Verwaltungs-Dashboard, und Kachel + Banner auf der Startseite.

**Architecture:** `post_channel` enum bekommt `warnung`; die `posts`-Tabelle erhält 4 nullable Spalten für DWD-Metadaten (`dwd_id`, `severity`, `expires_at`, `is_active`). DWD-Alerts werden alle 10 Minuten per Vercel Cron gesynct. Manuelles Erstellen/Deaktivieren läuft über Server Actions im (admin)-Bereich, Deaktivierung über eine eigene API-Route mit service_role.

**Tech Stack:** Next.js 16 App Router, Supabase (SSR + service_role), react-hook-form, zod, Tailwind v4, OneSignal REST API, DWD Bright Sky API

---

## File Map

| Datei | Neu / Änderung | Zweck |
|---|---|---|
| `supabase/migrations/040_warnmeldungen.sql` | Neu | DB-Schema |
| `src/features/warnmeldungen/types.ts` | Neu | Geteilte Typen und Konstanten |
| `src/features/warnmeldungen/dwd.ts` | Neu | Pure DWD-Parsing-Funktionen |
| `src/features/warnmeldungen/dwd.test.ts` | Neu | Unit-Tests für DWD-Utilities |
| `src/app/api/cron/dwd-warnmeldungen/route.ts` | Neu | Vercel Cron Endpoint |
| `src/app/api/warnmeldungen/deaktivieren/route.ts` | Neu | Deaktivierungs-Endpoint |
| `src/app/(admin)/dashboard/warnmeldungen/actions.ts` | Neu | Server Actions für Admin-Formular |
| `src/app/(admin)/dashboard/warnmeldungen/WarnmeldungForm.tsx` | Neu | Client-Formular-Komponente |
| `src/app/(admin)/dashboard/warnmeldungen/page.tsx` | Neu | Admin-Übersichtsseite |
| `src/app/(admin)/dashboard/warnmeldungen/neu/page.tsx` | Neu | Admin-Formularseite |
| `src/app/(app)/warnmeldungen/page.tsx` | Neu | Öffentliche Warnmeldungs-Liste |
| `vercel.json` | Änderung | DWD-Cron hinzufügen |
| `src/app/(app)/home/page.tsx` | Änderung | Kachel + Banner |

---

## Task 1: Datenbank-Migration

**Files:**
- Create: `supabase/migrations/040_warnmeldungen.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- 040_warnmeldungen.sql
-- Warnmeldungs-Typ für Posts + DWD-Konfigurationsfeld auf Gemeinden

-- 1. Neuer Post-Channel
ALTER TYPE public.post_channel ADD VALUE IF NOT EXISTS 'warnung';

-- 2. author_id nullable (DWD-Posts haben keinen menschlichen Autor)
ALTER TABLE public.posts ALTER COLUMN author_id DROP NOT NULL;

-- 3. DWD-spezifische Spalten
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS dwd_id     text,
  ADD COLUMN IF NOT EXISTS severity   smallint,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;

-- 4. Unique-Index verhindert doppeltes Anlegen derselben DWD-Warnung
CREATE UNIQUE INDEX IF NOT EXISTS posts_dwd_id_unique
  ON public.posts(dwd_id)
  WHERE dwd_id IS NOT NULL;

-- 5. Warncell-ID für DWD-Polling
ALTER TABLE public.gemeinden
  ADD COLUMN IF NOT EXISTS warncell_id text;

-- Keine neuen GRANTs nötig:
-- - service_role: DWD-Cron und Deaktivierungs-Route nutzen createServiceClient()
--   das bypassed RLS und braucht keine expliziten GRANTs für neue Spalten
-- - authenticated: bestehende Grants auf posts/gemeinden decken neue Spalten ab
```

- [ ] **Step 2: Migration anwenden**

```bash
npx supabase db push
```

Erwartete Ausgabe: Migration 040 erfolgreich angewendet.

- [ ] **Step 3: TypeScript-Typen regenerieren**

```bash
npm run db:types
```

Danach prüfen: In `src/types/supabase.ts` sollte `post_channel` nun `'warnung'` enthalten und `posts` die neuen Spalten (`dwd_id`, `severity`, `expires_at`, `is_active`) haben. `gemeinden` hat `warncell_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/040_warnmeldungen.sql src/types/supabase.ts
git commit -m "feat: add warnmeldungen DB schema (post_channel warnung, DWD metadata columns)"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/features/warnmeldungen/types.ts`

- [ ] **Step 1: Typen-Datei erstellen**

```typescript
// src/features/warnmeldungen/types.ts

export type WarnSeverity = 1 | 2 | 3 | 4

export const SEVERITY_LABEL: Record<WarnSeverity, string> = {
  1: 'Hinweis',
  2: 'Warnung',
  3: 'Starke Warnung',
  4: 'Extreme Warnung',
}

export const SEVERITY_COLOR: Record<WarnSeverity, string> = {
  1: '#f59e0b',
  2: '#f97316',
  3: '#dc2626',
  4: '#7f1d1d',
}

export const SEVERITY_BG: Record<WarnSeverity, string> = {
  1: 'rgba(245,158,11,0.12)',
  2: 'rgba(249,115,22,0.12)',
  3: 'rgba(220,38,38,0.12)',
  4: 'rgba(127,29,29,0.12)',
}

export interface DwdAlert {
  id: string
  event: string
  headline: string
  description: string | null
  instruction: string | null
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Extreme'
  status: string
  message_type: string
  effective: string
  expires: string | null
  warn_cell_ids: string[]
}

export interface DwdAlertsResponse {
  alerts: DwdAlert[]
}

export const SEVERITY_MAP: Record<DwdAlert['severity'], WarnSeverity> = {
  Minor: 1,
  Moderate: 2,
  Severe: 3,
  Extreme: 4,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/warnmeldungen/types.ts
git commit -m "feat: add warnmeldungen shared types"
```

---

## Task 3: DWD Utilities (TDD)

**Files:**
- Create: `src/features/warnmeldungen/dwd.ts`
- Create: `src/features/warnmeldungen/dwd.test.ts`

- [ ] **Step 1: Tests schreiben**

```typescript
// src/features/warnmeldungen/dwd.test.ts
import { describe, it, expect } from 'vitest'
import { filterActiveAlerts, buildPostContent } from './dwd'
import type { DwdAlert } from './types'

function mockAlert(overrides: Partial<DwdAlert> = {}): DwdAlert {
  return {
    id: 'alert-1',
    event: 'STARKREGEN',
    headline: 'Amtliche WARNUNG vor STARKREGEN',
    description: 'Örtlich Starkregen zwischen 20 und 30 l/m².',
    instruction: 'Keller leerpumpen.',
    severity: 'Moderate',
    status: 'Actual',
    message_type: 'Alert',
    effective: '2024-01-15T10:00:00+00:00',
    expires: '2024-01-15T22:00:00+00:00',
    warn_cell_ids: ['DE-BW-08135000'],
    ...overrides,
  }
}

describe('filterActiveAlerts', () => {
  it('includes Moderate severity active alerts', () => {
    expect(filterActiveAlerts([mockAlert()])).toHaveLength(1)
  })

  it('excludes Minor severity alerts', () => {
    expect(filterActiveAlerts([mockAlert({ severity: 'Minor' })])).toHaveLength(0)
  })

  it('includes Severe and Extreme', () => {
    const alerts = [
      mockAlert({ severity: 'Severe' }),
      mockAlert({ id: 'alert-2', severity: 'Extreme' }),
    ]
    expect(filterActiveAlerts(alerts)).toHaveLength(2)
  })

  it('excludes cancelled messages', () => {
    expect(filterActiveAlerts([mockAlert({ message_type: 'Cancel' })])).toHaveLength(0)
  })

  it('excludes non-Actual status', () => {
    expect(filterActiveAlerts([mockAlert({ status: 'Exercise' })])).toHaveLength(0)
  })
})

describe('buildPostContent', () => {
  it('builds titel from headline', () => {
    const { titel } = buildPostContent(mockAlert())
    expect(titel).toBe('Unwetterwarnung: Amtliche WARNUNG vor STARKREGEN')
  })

  it('includes description in inhalt', () => {
    const { inhalt } = buildPostContent(mockAlert())
    expect(inhalt).toContain('Örtlich Starkregen')
  })

  it('includes instruction when present', () => {
    const { inhalt } = buildPostContent(mockAlert())
    expect(inhalt).toContain('Keller leerpumpen')
  })

  it('handles null description gracefully', () => {
    const { inhalt } = buildPostContent(mockAlert({ description: null }))
    expect(typeof inhalt).toBe('string')
    expect(inhalt.length).toBeGreaterThan(0)
  })

  it('handles null expires gracefully', () => {
    const { inhalt } = buildPostContent(mockAlert({ expires: null }))
    expect(typeof inhalt).toBe('string')
  })
})
```

- [ ] **Step 2: Tests ausführen — müssen SCHEITERN**

```bash
npm run test -- dwd.test
```

Erwartete Ausgabe: `Cannot find module './dwd'`

- [ ] **Step 3: Implementation schreiben**

```typescript
// src/features/warnmeldungen/dwd.ts
import type { DwdAlert, DwdAlertsResponse } from './types'
import { SEVERITY_MAP } from './types'

export function filterActiveAlerts(alerts: DwdAlert[]): DwdAlert[] {
  return alerts.filter(
    (a) =>
      a.status === 'Actual' &&
      a.message_type !== 'Cancel' &&
      SEVERITY_MAP[a.severity] >= 2,
  )
}

export function buildPostContent(alert: DwdAlert): { titel: string; inhalt: string } {
  const titel = `Unwetterwarnung: ${alert.headline}`
  const parts: string[] = []
  if (alert.description) parts.push(alert.description)
  if (alert.expires) {
    const date = new Date(alert.expires)
    parts.push(`Gültig bis: ${date.toLocaleString('de-DE')}`)
  }
  if (alert.instruction) parts.push(`Verhaltenshinweis: ${alert.instruction}`)
  return { titel, inhalt: parts.join('\n\n') || titel }
}

export async function fetchDwdAlerts(warncellId: string): Promise<DwdAlert[]> {
  const url = `https://api.brightsky.dev/alerts?warn_cell_id=${encodeURIComponent(warncellId)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`DWD API error: ${res.status}`)
  const data: DwdAlertsResponse = await res.json()
  return data.alerts ?? []
}
```

- [ ] **Step 4: Tests ausführen — müssen BESTEHEN**

```bash
npm run test -- dwd.test
```

Erwartete Ausgabe: Alle 10 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/features/warnmeldungen/dwd.ts src/features/warnmeldungen/dwd.test.ts
git commit -m "feat: add DWD alert parsing utilities with tests"
```

---

## Task 4: DWD Cron Route

**Files:**
- Create: `src/app/api/cron/dwd-warnmeldungen/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Cron-Route erstellen**

```typescript
// src/app/api/cron/dwd-warnmeldungen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchDwdAlerts, filterActiveAlerts, buildPostContent } from '@/features/warnmeldungen/dwd'
import { SEVERITY_MAP } from '@/features/warnmeldungen/types'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = await createServiceClient()

  const { data: gemeinden, error } = await service
    .from('gemeinden')
    .select('id, slug, warncell_id')
    .not('warncell_id', 'is', null)

  if (error || !gemeinden?.length) {
    return NextResponse.json({ ok: true, created: 0, deactivated: 0, message: 'Keine Gemeinden mit warncell_id' })
  }

  let created = 0
  let deactivated = 0

  for (const gemeinde of gemeinden) {
    try {
      const allAlerts = await fetchDwdAlerts(gemeinde.warncell_id!)
      const activeAlerts = filterActiveAlerts(allAlerts)
      const activeDwdIds = new Set(activeAlerts.map((a) => a.id))

      const { data: existingPosts } = await service
        .from('posts')
        .select('id, dwd_id, is_active')
        .eq('gemeinde_id', gemeinde.id)
        .eq('channel', 'warnung')
        .not('dwd_id', 'is', null)

      const existingDwdIds = new Set((existingPosts ?? []).map((p) => p.dwd_id!))

      // Neue Warnungen anlegen
      for (const alert of activeAlerts) {
        if (existingDwdIds.has(alert.id)) continue

        const { titel, inhalt } = buildPostContent(alert)
        await service.from('posts').insert({
          gemeinde_id: gemeinde.id,
          channel: 'warnung',
          titel,
          inhalt,
          dwd_id: alert.id,
          severity: SEVERITY_MAP[alert.severity],
          expires_at: alert.expires,
          is_active: true,
          pinned: true,
          status: 'published',
        })

        await sendPushNotification(gemeinde.slug, titel)
        created++
      }

      // Nicht mehr aktive DWD-Warnungen deaktivieren
      for (const post of existingPosts ?? []) {
        if (!post.is_active) continue
        if (activeDwdIds.has(post.dwd_id!)) continue

        await service.from('posts').update({ is_active: false }).eq('id', post.id)
        deactivated++
      }
    } catch (err) {
      console.error(`[DWD Cron] Fehler für Gemeinde ${gemeinde.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, created, deactivated })
}

async function sendPushNotification(gemeindeSlug: string, titel: string) {
  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      filters: [{ field: 'tag', key: 'gemeinde_slug', relation: '=', value: gemeindeSlug }],
      headings: { de: 'Unwetterwarnung', en: 'Unwetterwarnung' },
      contents: { de: titel, en: titel },
      url: `${process.env.NEXT_PUBLIC_APP_URL}/warnmeldungen`,
    }),
  }).catch((e) => console.error('[DWD Cron] Push-Fehler:', e))
}
```

- [ ] **Step 2: vercel.json aktualisieren**

```json
{
  "crons": [
    {
      "path": "/api/cron/abfall-benachrichtigungen",
      "schedule": "0 17 * * *"
    },
    {
      "path": "/api/cron/dwd-warnmeldungen",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

> Hinweis: `*/10 * * * *` erfordert Vercel Pro-Plan.

- [ ] **Step 3: Route manuell testen**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/dwd-warnmeldungen
```

Erwartete Ausgabe: `{"ok":true,"created":0,"deactivated":0,"message":"Keine Gemeinden mit warncell_id"}` (solange keine Gemeinde eine warncell_id hat).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/dwd-warnmeldungen/route.ts vercel.json
git commit -m "feat: add DWD Unwetterwarnungen cron route"
```

---

## Task 5: Deaktivierungs-API-Route

**Files:**
- Create: `src/app/api/warnmeldungen/deaktivieren/route.ts`

- [ ] **Step 1: Route erstellen**

```typescript
// src/app/api/warnmeldungen/deaktivieren/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, gemeinde_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const body = await req.json()
  const { post_id } = body as { post_id?: string }
  if (!post_id) return NextResponse.json({ error: 'post_id erforderlich' }, { status: 400 })

  const service = await createServiceClient()

  const { data: post } = await service
    .from('posts')
    .select('id, gemeinde_id, dwd_id, channel')
    .eq('id', post_id)
    .single()

  if (!post) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  if (post.channel !== 'warnung') {
    return NextResponse.json({ error: 'Kein Warnmeldungs-Post' }, { status: 400 })
  }
  if (post.dwd_id !== null) {
    return NextResponse.json({ error: 'DWD-Warnungen können nicht manuell deaktiviert werden' }, { status: 400 })
  }
  if (post.gemeinde_id !== profile.gemeinde_id) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  await service.from('posts').update({ is_active: false }).eq('id', post_id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/warnmeldungen/deaktivieren/route.ts
git commit -m "feat: add manual warning deactivation API route"
```

---

## Task 6: Server Actions für Admin-Formular

**Files:**
- Create: `src/app/(admin)/dashboard/warnmeldungen/actions.ts`

- [ ] **Step 1: Server Action und Zod-Schema erstellen**

```typescript
// src/app/(admin)/dashboard/warnmeldungen/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const warnmeldungSchema = z.object({
  titel: z.string().min(1, 'Titel erforderlich').max(200),
  inhalt: z.string().min(1, 'Beschreibung erforderlich'),
  severity: z.coerce.number().int().min(1).max(4),
  sendPush: z.boolean().default(true),
})

export type WarnmeldungFormValues = z.infer<typeof warnmeldungSchema>

export async function createWarnmeldungAction(values: WarnmeldungFormValues): Promise<{ error?: string }> {
  const parsed = warnmeldungSchema.safeParse(values)
  if (!parsed.success) return { error: 'Ungültige Eingabe' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, gemeinde_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') return { error: 'Keine Berechtigung' }
  if (!profile.gemeinde_id) return { error: 'Keine Gemeinde zugewiesen' }

  const service = await createServiceClient()

  const { error: insertError } = await service.from('posts').insert({
    gemeinde_id: profile.gemeinde_id,
    author_id: user.id,
    channel: 'warnung',
    titel: parsed.data.titel,
    inhalt: parsed.data.inhalt,
    severity: parsed.data.severity,
    is_active: true,
    pinned: true,
    status: 'published',
  })

  if (insertError) return { error: 'Fehler beim Erstellen der Warnmeldung' }

  if (parsed.data.sendPush) {
    const { data: gemeinde } = await service
      .from('gemeinden')
      .select('slug')
      .eq('id', profile.gemeinde_id)
      .single()

    if (gemeinde) {
      await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          filters: [{ field: 'tag', key: 'gemeinde_slug', relation: '=', value: gemeinde.slug }],
          headings: { de: 'Warnmeldung', en: 'Warnmeldung' },
          contents: { de: parsed.data.titel, en: parsed.data.titel },
          url: `${process.env.NEXT_PUBLIC_APP_URL}/warnmeldungen`,
        }),
      }).catch((e) => console.error('[Warnmeldung] Push-Fehler:', e))
    }
  }

  revalidatePath('/dashboard/warnmeldungen')
  redirect('/dashboard/warnmeldungen')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/dashboard/warnmeldungen/actions.ts
git commit -m "feat: add createWarnmeldung server action"
```

---

## Task 7: Admin-Formular-Komponente

**Files:**
- Create: `src/app/(admin)/dashboard/warnmeldungen/WarnmeldungForm.tsx`

- [ ] **Step 1: Formular-Komponente erstellen**

```tsx
// src/app/(admin)/dashboard/warnmeldungen/WarnmeldungForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { warnmeldungSchema, type WarnmeldungFormValues, createWarnmeldungAction } from './actions'
import { SEVERITY_LABEL } from '@/features/warnmeldungen/types'

export default function WarnmeldungForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<WarnmeldungFormValues>({
    resolver: zodResolver(warnmeldungSchema),
    defaultValues: { titel: '', inhalt: '', severity: 2, sendPush: true },
  })

  async function onSubmit(values: WarnmeldungFormValues) {
    setServerError(null)
    const result = await createWarnmeldungAction(values)
    if (result?.error) setServerError(result.error)
    // Bei Erfolg redirected die Server Action automatisch
  }

  const severityOptions = ([1, 2, 3, 4] as const).map((s) => ({
    value: s,
    label: SEVERITY_LABEL[s],
  }))

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 max-w-xl">
      {serverError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="titel" className="block text-sm font-medium text-gray-700">
          Titel
        </label>
        <input
          id="titel"
          type="text"
          placeholder="z.B. Unwetterwarnung: Starkregen"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          {...form.register('titel')}
        />
        {form.formState.errors.titel && (
          <p role="alert" className="text-xs text-red-600">{form.formState.errors.titel.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="inhalt" className="block text-sm font-medium text-gray-700">
          Beschreibung
        </label>
        <textarea
          id="inhalt"
          rows={4}
          placeholder="Details zur Warnmeldung..."
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          {...form.register('inhalt')}
        />
        {form.formState.errors.inhalt && (
          <p role="alert" className="text-xs text-red-600">{form.formState.errors.inhalt.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="severity" className="block text-sm font-medium text-gray-700">
          Schweregrad
        </label>
        <select
          id="severity"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
          {...form.register('severity')}
        >
          {severityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="sendPush"
          type="checkbox"
          className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
          {...form.register('sendPush')}
        />
        <label htmlFor="sendPush" className="text-sm text-gray-700">
          Push-Benachrichtigung an alle Nutzer senden
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors"
        >
          {form.formState.isSubmitting ? 'Wird erstellt…' : 'Warnmeldung erstellen'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/dashboard/warnmeldungen/WarnmeldungForm.tsx
git commit -m "feat: add WarnmeldungForm client component"
```

---

## Task 8: Admin-Übersichtsseite + Neu-Seite

**Files:**
- Create: `src/app/(admin)/dashboard/warnmeldungen/page.tsx`
- Create: `src/app/(admin)/dashboard/warnmeldungen/neu/page.tsx`

- [ ] **Step 1: Übersichtsseite erstellen**

```tsx
// src/app/(admin)/dashboard/warnmeldungen/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ShieldAlert, Plus, Clock } from 'lucide-react'
import { SEVERITY_LABEL, SEVERITY_COLOR, type WarnSeverity } from '@/features/warnmeldungen/types'

export const metadata = { title: 'Warnmeldungen – Dashboard' }

export default async function WarnmeldungenAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, gemeinde_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') redirect('/dashboard')

  const service = await createServiceClient()

  const { data: warnmeldungen } = await service
    .from('posts')
    .select('id, titel, inhalt, severity, is_active, dwd_id, created_at')
    .eq('gemeinde_id', profile.gemeinde_id!)
    .eq('channel', 'warnung')
    .order('created_at', { ascending: false })

  const aktive = (warnmeldungen ?? []).filter((w) => w.is_active)
  const inaktive = (warnmeldungen ?? []).filter((w) => !w.is_active)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Warnmeldungen</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manuelle und DWD-Warnmeldungen verwalten</p>
          </div>
          <Link
            href="/dashboard/warnmeldungen/neu"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Neue Warnmeldung
          </Link>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {aktive.length > 0 && (
          <section aria-label="Aktive Warnmeldungen">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Aktiv ({aktive.length})
            </h2>
            <div className="space-y-3">
              {aktive.map((w) => (
                <WarnCard key={w.id} w={w} showDeactivate={w.dwd_id === null} />
              ))}
            </div>
          </section>
        )}

        {aktive.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p className="text-sm">Keine aktiven Warnmeldungen</p>
          </div>
        )}

        {inaktive.length > 0 && (
          <section aria-label="Inaktive Warnmeldungen">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Inaktiv / Archiv ({inaktive.length})
            </h2>
            <div className="space-y-3">
              {inaktive.map((w) => (
                <WarnCard key={w.id} w={w} showDeactivate={false} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function WarnCard({
  w,
  showDeactivate,
}: {
  w: {
    id: string
    titel: string
    severity: number | null
    is_active: boolean
    dwd_id: string | null
    created_at: string
  }
  showDeactivate: boolean
}) {
  const sev = (w.severity ?? 2) as WarnSeverity
  const color = SEVERITY_COLOR[sev]
  const label = SEVERITY_LABEL[sev]
  const quelle = w.dwd_id ? 'DWD (automatisch)' : 'Manuell'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}
      >
        <ShieldAlert className="w-5 h-5" style={{ color }} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 leading-snug">{w.titel}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color, background: `${color}18` }}
          >
            {label}
          </span>
          <span className="text-xs text-gray-400">{quelle}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {new Date(w.created_at).toLocaleDateString('de-DE')}
          </span>
        </div>
      </div>
      {showDeactivate && (
        <DeactivateButton postId={w.id} />
      )}
    </div>
  )
}

// Inline Client Component für den Deaktivieren-Button
// (minimiert Client Bundle — nur der Button ist interaktiv)
```

Achtung: `DeactivateButton` muss eine separate Client-Komponente sein. Erstelle sie als eigene Datei:

```tsx
// src/app/(admin)/dashboard/warnmeldungen/DeactivateButton.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeactivateButton({ postId }: { postId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDeactivate() {
    if (!confirm('Warnmeldung wirklich deaktivieren?')) return
    setLoading(true)
    await fetch('/api/warnmeldungen/deaktivieren', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleDeactivate}
      disabled={loading}
      className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
    >
      {loading ? '…' : 'Deaktivieren'}
    </button>
  )
}
```

Dann importiere `DeactivateButton` in `page.tsx` und ersetze den Platzhalter-Kommentar:

```tsx
// Am Anfang von page.tsx hinzufügen:
import DeactivateButton from './DeactivateButton'
```

Und im `WarnCard`-JSX den Kommentar-Platzhalter durch den echten Import ersetzen.

Vollständige `page.tsx` mit Import:

```tsx
// src/app/(admin)/dashboard/warnmeldungen/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ShieldAlert, Plus, Clock } from 'lucide-react'
import { SEVERITY_LABEL, SEVERITY_COLOR, type WarnSeverity } from '@/features/warnmeldungen/types'
import DeactivateButton from './DeactivateButton'

export const metadata = { title: 'Warnmeldungen – Dashboard' }

export default async function WarnmeldungenAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, gemeinde_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') redirect('/dashboard')

  const service = await createServiceClient()

  const { data: warnmeldungen } = await service
    .from('posts')
    .select('id, titel, severity, is_active, dwd_id, created_at')
    .eq('gemeinde_id', profile.gemeinde_id!)
    .eq('channel', 'warnung')
    .order('created_at', { ascending: false })

  const aktive = (warnmeldungen ?? []).filter((w) => w.is_active)
  const inaktive = (warnmeldungen ?? []).filter((w) => !w.is_active)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Warnmeldungen</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manuelle und DWD-Warnmeldungen verwalten</p>
          </div>
          <Link
            href="/dashboard/warnmeldungen/neu"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Neue Warnmeldung
          </Link>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {aktive.length > 0 && (
          <section aria-label="Aktive Warnmeldungen">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Aktiv ({aktive.length})
            </h2>
            <div className="space-y-3">
              {aktive.map((w) => (
                <WarnCard key={w.id} w={w} />
              ))}
            </div>
          </section>
        )}

        {aktive.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p className="text-sm">Keine aktiven Warnmeldungen</p>
          </div>
        )}

        {inaktive.length > 0 && (
          <section aria-label="Inaktive Warnmeldungen">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
              Inaktiv / Archiv ({inaktive.length})
            </h2>
            <div className="space-y-3">
              {inaktive.map((w) => (
                <WarnCard key={w.id} w={w} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function WarnCard({
  w,
}: {
  w: {
    id: string
    titel: string
    severity: number | null
    is_active: boolean
    dwd_id: string | null
    created_at: string
  }
}) {
  const sev = (w.severity ?? 2) as WarnSeverity
  const color = SEVERITY_COLOR[sev]
  const label = SEVERITY_LABEL[sev]
  const quelle = w.dwd_id ? 'DWD (automatisch)' : 'Manuell'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}
      >
        <ShieldAlert className="w-5 h-5" style={{ color }} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 leading-snug">{w.titel}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ color, background: `${color}18` }}
          >
            {label}
          </span>
          <span className="text-xs text-gray-400">{quelle}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            {new Date(w.created_at).toLocaleDateString('de-DE')}
          </span>
        </div>
      </div>
      {w.is_active && w.dwd_id === null && (
        <DeactivateButton postId={w.id} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Neue-Warnmeldung-Seite erstellen**

```tsx
// src/app/(admin)/dashboard/warnmeldungen/neu/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WarnmeldungForm from '../WarnmeldungForm'

export const metadata = { title: 'Neue Warnmeldung – Dashboard' }

export default async function NeueWarnmeldungPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'verwaltung') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <h1 className="text-2xl font-bold text-gray-900">Neue Warnmeldung</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manuelle Warnung für die Bürger erstellen</p>
      </div>
      <div className="px-8 py-6">
        <WarnmeldungForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/dashboard/warnmeldungen/
git commit -m "feat: add Warnmeldungen admin pages (list + form)"
```

---

## Task 9: Öffentliche Warnmeldungen-Seite

**Files:**
- Create: `src/app/(app)/warnmeldungen/page.tsx`

- [ ] **Step 1: Seite erstellen**

```tsx
// src/app/(app)/warnmeldungen/page.tsx
import type { Metadata } from 'next'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getGemeinde } from '@/lib/gemeinde'
import { SEVERITY_LABEL, SEVERITY_COLOR, SEVERITY_BG, type WarnSeverity } from '@/features/warnmeldungen/types'

export const metadata: Metadata = { title: 'Warnmeldungen – Dorfly' }

export default async function WarnmeldungenPage() {
  const [supabase, gemeinde] = await Promise.all([
    createClient(),
    getGemeinde(),
  ])

  const { data: warnmeldungen } = await supabase
    .from('posts')
    .select('id, titel, inhalt, severity, dwd_id, created_at, expires_at')
    .eq('gemeinde_id', gemeinde?.id ?? '')
    .eq('channel', 'warnung')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const liste = warnmeldungen ?? []

  return (
    <div className="min-h-screen bg-[#f5f7fc]">
      <div className="bg-red-600 px-6 pt-14 pb-6">
        <p className="text-[10px] font-bold tracking-[3px] text-red-200 uppercase">{gemeinde?.name}</p>
        <h1 className="text-white font-extrabold text-[28px] mt-1.5 leading-snug">
          Warnmeldungen
        </h1>
        <p className="text-white/60 text-[13px] mt-1.5">
          {liste.length > 0
            ? `${liste.length} aktive Warnung${liste.length !== 1 ? 'en' : ''}`
            : 'Keine aktiven Warnmeldungen'}
        </p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {liste.length === 0 && (
          <div className="bg-white rounded-[18px] p-6 shadow-[0_2px_14px_rgba(15,45,107,0.08)] text-center">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-500" aria-hidden="true" />
            <p className="font-semibold text-[#0f172a]">Alles in Ordnung</p>
            <p className="text-[13px] text-[#64748b] mt-1">
              Momentan gibt es keine Warnmeldungen für {gemeinde?.name ?? 'Ihre Gemeinde'}.
            </p>
          </div>
        )}

        {liste.map((w) => {
          const sev = (w.severity ?? 2) as WarnSeverity
          const color = SEVERITY_COLOR[sev]
          const bg = SEVERITY_BG[sev]
          const label = SEVERITY_LABEL[sev]
          const quelle = w.dwd_id ? 'Deutscher Wetterdienst' : 'Gemeindeverwaltung'

          return (
            <article
              key={w.id}
              className="bg-white rounded-[18px] p-4 shadow-[0_2px_14px_rgba(15,45,107,0.08)]"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: bg }}
                >
                  <ShieldAlert className="w-5 h-5" style={{ color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color, background: bg }}
                    >
                      {label}
                    </span>
                    <span className="text-[11px] text-[#64748b]">{quelle}</span>
                  </div>
                  <p className="font-bold text-[14px] text-[#0f172a] leading-snug">{w.titel}</p>
                  {w.inhalt && (
                    <p className="text-[13px] text-[#475569] mt-2 leading-relaxed whitespace-pre-line">
                      {w.inhalt}
                    </p>
                  )}
                  <p className="text-[11px] text-[#94a3b8] mt-3">
                    {new Date(w.created_at).toLocaleString('de-DE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {w.expires_at && (
                      <> · Gültig bis {new Date(w.expires_at).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}</>
                    )}
                  </p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/warnmeldungen/page.tsx
git commit -m "feat: add public Warnmeldungen page"
```

---

## Task 10: Startseite — Kachel + Banner

**Files:**
- Modify: `src/app/(app)/home/page.tsx`

Die Startseite bekommt:
1. Eine permanente Kachel „Warnmeldungen" im Grid (rot wenn aktiv, grau wenn inaktiv)
2. Einen breiten roten Banner über dem Grid (nur wenn aktive Warnung vorhanden)

- [ ] **Step 1: Import-Zeile erweitern**

In `src/app/(app)/home/page.tsx`, Zeile 4 (`import { Newspaper, ...`) um `ShieldAlert` ergänzen:

```tsx
import { Newspaper, AlertTriangle, BarChart2, MessageCircleQuestion, LayoutDashboard, CalendarDays, ExternalLink, ScrollText, Scale, UserCircle, Store, Trash2, Users, Phone, Globe, BookOpen, ShieldAlert, LucideIcon } from 'lucide-react'
```

- [ ] **Step 2: Warnmeldungen-Kachel zu BASE_TILES hinzufügen**

Nach der letzten Kachel in `BASE_TILES` (Zeile 29, `Abfallkalender`) einfügen:

```tsx
  { href: '/warnmeldungen', label: 'Warnmeldungen', icon: ShieldAlert, color: '#475569', bg: 'rgba(71,85,105,0.1)', desc: 'Aktuelle Warnungen' },
```

- [ ] **Step 3: Aktive Warnung serverseitig abrufen**

Im Body der `HomePage`-Funktion, nach den bestehenden `Promise.all`-Aufrufen (nach Zeile 43), einfügen:

```tsx
  const { data: activeWarnung } = await supabase
    .from('posts')
    .select('id, titel, severity')
    .eq('gemeinde_id', gemeinde?.id ?? '')
    .eq('channel', 'warnung')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
```

- [ ] **Step 4: Kachel-Farbe dynamisch setzen**

Nach der `tiles`-Berechnung (nach Zeile 63) einfügen:

```tsx
  const tilesWithWarn = tiles.map((t) =>
    t.href === '/warnmeldungen' && activeWarnung
      ? { ...t, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' }
      : t,
  )
```

Und im JSX weiter unten `tiles` durch `tilesWithWarn` ersetzen (in der `.map()`-Zeile, Zeile 98).

- [ ] **Step 5: Warnungs-Banner einfügen**

Im JSX, nach dem Dashboard-Banner (nach dem schließenden `)}` von `{hasDashboard && (...)}`, Zeile 94), einfügen:

```tsx
        {/* Warnmeldungs-Banner — nur bei aktiver Warnung */}
        {activeWarnung && (
          <Link
            href="/warnmeldungen"
            className="bg-red-600 rounded-[20px] p-4 flex items-center gap-4 shadow-[0_4px_14px_rgba(220,38,38,0.35)] transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none"
          >
            <div className="w-11 h-11 rounded-[14px] bg-white/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-[22px] h-[22px] text-white" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[14.5px] leading-snug line-clamp-1">{activeWarnung.titel}</p>
              <p className="text-white/60 text-xs mt-0.5">Aktive Warnung · Details ansehen</p>
            </div>
            <div className="w-[30px] h-[30px] rounded-[9px] bg-white/20 flex items-center justify-center shrink-0">
              <svg width="15" height="15" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <path d="M4 11h14M13 5l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
        )}
```

- [ ] **Step 6: Vollständige Änderungsliste zusammenfassen und prüfen**

Prüfe, dass in `home/page.tsx` folgendes stimmt:
1. `ShieldAlert` ist im Import ✓
2. `BASE_TILES` hat den `/warnmeldungen`-Eintrag ✓
3. `activeWarnung`-Query vorhanden (nach dem `Promise.all`) ✓
4. `tilesWithWarn` berechnet ✓
5. `tilesWithWarn.map(...)` statt `tiles.map(...)` im Grid ✓
6. Warnungs-Banner nach Dashboard-Banner ✓

- [ ] **Step 7: Dev-Server starten und Startseite prüfen**

```bash
npm run dev
```

Im Browser `http://localhost:3000` öffnen:
- Kachel „Warnmeldungen" erscheint im Grid (grau, da keine aktive Warnung)
- Kein roter Banner sichtbar (korrekt bei keiner aktiven Warnung)
- Kachel klickbar, führt zu `/warnmeldungen`

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/home/page.tsx
git commit -m "feat: add Warnmeldungen tile and alert banner to homepage"
```

---

## Task 11: Build-Validierung

- [ ] **Step 1: TypeScript-Check**

```bash
npx tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler. Bei Fehlern: Typen anpassen (häufig: neue Spalten nach `db:types` noch nicht bekannt → Task 1 Step 3 sicherstellen).

- [ ] **Step 2: Alle Tests**

```bash
npm run test
```

Erwartete Ausgabe: Alle Tests grün, insbesondere `dwd.test.ts`.

- [ ] **Step 3: Production-Build**

```bash
npm run build
```

Erwartete Ausgabe: Build erfolgreich, keine Fehler.

- [ ] **Step 4: Final-Commit**

```bash
git add -A
git commit -m "feat: Warnmeldungen feature complete"
```

---

## Abschluss-Checkliste

Nach der Implementierung manuell prüfen:

- [ ] Migration 040 in Supabase angewendet, `npm run db:types` ausgeführt
- [ ] DWD-Cron manuell getestet (mit CRON_SECRET)
- [ ] Admin-Seite `/dashboard/warnmeldungen` erreichbar (nur als `verwaltung`)
- [ ] Manuelle Warnung erstellen → erscheint auf Startseite + `/warnmeldungen`
- [ ] Manuelle Warnung deaktivieren → verschwindet von Startseite + `/warnmeldungen`
- [ ] Warntile im Grid sichtbar, wird rot bei aktiver Warnung
- [ ] Roter Banner erscheint nur bei aktiver Warnung
- [ ] Push-Checkbox im Formular funktioniert
- [ ] Vercel Pro-Plan bestätigt (für `*/10 * * * *` Cron)
- [ ] `warncell_id` für Test-Gemeinde in Supabase gesetzt (z.B. über Admin-Dashboard oder direkt in DB)
