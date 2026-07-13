# Gemeinde-Branding (Farbschema + Wappen/Logo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verwaltungen können im Dashboard eine Primary- und eine Akzentfarbe sowie ein Gemeindewappen/Logo einstellen; die Farben wirken App-weit (Tailwind-Klassen bleiben unverändert), das Wappen erscheint im Home-Header.

**Architecture:** `gemeinden.primary_color`/`accent_color` (Hex) werden im Root-Layout serverseitig in eine 10-stufige Farbskala aufgelöst (`generateColorScale`) und als CSS-Custom-Properties injiziert. `globals.css` referenziert diese Properties mit den heutigen Hex-Werten als Fallback, sodass alle bestehenden `bg-primary-500`/`text-gold-500`-Klassen automatisch die Gemeinde-Farbe übernehmen. `logo_url` wird im Home-Header angezeigt. Verwaltung bearbeitet alles in einer neuen „Design“-Sektion in `GemeindeEinstellungen.tsx`.

**Tech Stack:** Next.js Server Components, Tailwind v4 `@theme inline`, Supabase (Postgres + Storage), Zod, Vitest.

---

### Task 1: Migration — `accent_color`-Spalte

**Files:**
- Create: `supabase/migrations/050_gemeinden_accent_color.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- Akzentfarbe pro Gemeinde (analog primary_color aus 038_gemeinden_theming_columns.sql).
-- Kein neues Objekt, daher keine neuen GRANTs nötig — bestehende Grants auf
-- public.gemeinden (siehe 012_explicit_grants.sql) decken die neue Spalte ab.
ALTER TABLE gemeinden ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#e8a020';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/050_gemeinden_accent_color.sql
git commit -m "feat: add accent_color column to gemeinden"
```

---

### Task 2: Generierte Typen manuell nachziehen

Der Codebase-Standard ist `npm run db:types` gegen die echte Supabase-Instanz. Da das in dieser Umgebung nicht garantiert verfügbar ist, patchen wir `src/types/supabase.ts` von Hand identisch zu dem, was der Generator erzeugen würde.

**Files:**
- Modify: `src/types/supabase.ts:260-317`

- [ ] **Step 1: `accent_color` in Row/Insert/Update ergänzen**

In `Row` (nach `logo_url: string | null` Zeile, alphabetisch vor `bundesland`... tatsächlich alphabetisch nach `accent_color` einsortieren, direkt nach `Row: {`):

```ts
        Row: {
          accent_color: string | null
          bundesland: string
          created_at: string | null
          einwohner: number | null
          features: Json
          haushalte: number | null
          homepage_url: string | null
          id: string
          ist_oeffentlich: boolean
          logo_url: string | null
          mitteilungsblatt_url: string | null
          name: string
          notfallnummern_url: string | null
          plz: string | null
          primary_color: string | null
          ratsinformation_url: string | null
          slug: string
          warncell_id: string | null
        }
        Insert: {
          accent_color?: string | null
          bundesland: string
          created_at?: string | null
          einwohner?: number | null
          features?: Json
          haushalte?: number | null
          homepage_url?: string | null
          id?: string
          ist_oeffentlich?: boolean
          logo_url?: string | null
          mitteilungsblatt_url?: string | null
          name: string
          notfallnummern_url?: string | null
          plz?: string | null
          primary_color?: string | null
          ratsinformation_url?: string | null
          slug: string
          warncell_id?: string | null
        }
        Update: {
          accent_color?: string | null
          bundesland?: string
          created_at?: string | null
          einwohner?: number | null
          features?: Json
          haushalte?: number | null
          homepage_url?: string | null
          id?: string
          ist_oeffentlich?: boolean
          logo_url?: string | null
          mitteilungsblatt_url?: string | null
          name?: string
          notfallnummern_url?: string | null
          plz?: string | null
          primary_color?: string | null
          ratsinformation_url?: string | null
          slug?: string
          warncell_id?: string | null
        }
```

Nutze den `Edit`-Tool-Aufruf mit dem exakten bestehenden Block (Zeilen 260-317 im ursprünglichen File) als `old_string` und obigem als `new_string`.

- [ ] **Step 2: Typecheck laufen lassen**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler durch diese Änderung (bestehende, unabhängige Fehler ignorieren).

- [ ] **Step 3: Commit**

```bash
git add src/types/supabase.ts
git commit -m "chore: add accent_color to generated Supabase types"
```

---

### Task 3: Farbskalen-Generator (`generateColorScale`)

**Files:**
- Create: `src/lib/colorScale.ts`
- Test: `src/lib/colorScale.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
// src/lib/colorScale.test.ts
import { describe, it, expect } from 'vitest'
import { generateColorScale } from './colorScale'

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

describe('generateColorScale', () => {
  it('behält die Eingabefarbe exakt (± Rundung) als 500-Stufe', () => {
    const scale = generateColorScale('#0f2d6b')
    const [r1, g1, b1] = hexToRgb(scale['500'])
    const [r2, g2, b2] = hexToRgb('#0f2d6b')
    expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(1)
    expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(1)
    expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(1)
  })

  it('wird von 50 nach 900 monoton dunkler', () => {
    const scale = generateColorScale('#0f2d6b')
    const luminance = (hex: string) => {
      const [r, g, b] = hexToRgb(hex)
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const order: (keyof typeof scale)[] = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
    for (let i = 1; i < order.length; i++) {
      expect(luminance(scale[order[i]])).toBeLessThan(luminance(scale[order[i - 1]]))
    }
  })

  it('gibt gültige 6-stellige Hex-Codes für alle Stufen zurück', () => {
    const scale = generateColorScale('#e8a020')
    for (const hex of Object.values(scale)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/colorScale.test.ts`
Expected: FAIL — `Cannot find module './colorScale'`

- [ ] **Step 3: Implementierung schreiben**

```ts
// src/lib/colorScale.ts
export type ColorScale = {
  '50': string; '100': string; '200': string; '300': string; '400': string
  '500': string; '600': string; '700': string; '800': string; '900': string
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return { h, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const toChannel = (n: number): string => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(Math.min(Math.max(c, 0), 1) * 255).toString(16).padStart(2, '0')
  }
  return `#${toChannel(0)}${toChannel(8)}${toChannel(4)}`
}

const LIGHTER_MIX = { '50': 0.92, '100': 0.8, '200': 0.6, '300': 0.4, '400': 0.18 } as const
const DARKER_MIX = { '600': 0.15, '700': 0.3, '800': 0.45, '900': 0.6 } as const

export function generateColorScale(baseHex: string): ColorScale {
  const { h, s, l } = hexToHsl(baseHex)
  const scale = { '500': hslToHex(h, s, l) } as ColorScale

  for (const shade of Object.keys(LIGHTER_MIX) as (keyof typeof LIGHTER_MIX)[]) {
    const mix = LIGHTER_MIX[shade]
    scale[shade] = hslToHex(h, s, l + (1 - l) * mix)
  }
  for (const shade of Object.keys(DARKER_MIX) as (keyof typeof DARKER_MIX)[]) {
    const mix = DARKER_MIX[shade]
    scale[shade] = hslToHex(h, s, l * (1 - mix))
  }

  return scale
}
```

- [ ] **Step 4: Test ausführen, Erfolg bestätigen**

Run: `npx vitest run src/lib/colorScale.test.ts`
Expected: PASS (3 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/colorScale.ts src/lib/colorScale.test.ts
git commit -m "feat: add generateColorScale for per-gemeinde theming"
```

---

### Task 4: Kontrast-Berechnung (`getContrastRatio`)

**Files:**
- Create: `src/lib/contrast.ts`
- Test: `src/lib/contrast.test.ts`

- [ ] **Step 1: Test schreiben**

```ts
// src/lib/contrast.test.ts
import { describe, it, expect } from 'vitest'
import { getContrastRatio } from './contrast'

describe('getContrastRatio', () => {
  it('liefert 21:1 für Schwarz auf Weiß', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('liefert 1:1 für identische Farben', () => {
    expect(getContrastRatio('#e8a020', '#e8a020')).toBeCloseTo(1, 1)
  })

  it('ist symmetrisch (Reihenfolge der Argumente egal)', () => {
    const a = getContrastRatio('#0f2d6b', '#ffffff')
    const b = getContrastRatio('#ffffff', '#0f2d6b')
    expect(a).toBeCloseTo(b, 5)
  })
})
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/contrast.test.ts`
Expected: FAIL — `Cannot find module './contrast'`

- [ ] **Step 3: Implementierung schreiben**

```ts
// src/lib/contrast.ts
function relativeLuminance(hex: string): number {
  const channels = [0, 2, 4].map(i => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = channels.map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}
```

- [ ] **Step 4: Test ausführen, Erfolg bestätigen**

Run: `npx vitest run src/lib/contrast.test.ts`
Expected: PASS (3 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/contrast.ts src/lib/contrast.test.ts
git commit -m "feat: add getContrastRatio for WCAG contrast checks"
```

---

### Task 5: Runtime-Theming ins Root-Layout injizieren

**Files:**
- Modify: `src/app/globals.css:8-43`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: `globals.css` — Primary/Gold-Stufen auf CSS-Variablen umstellen**

Ersetze den `@theme inline`-Block (aktuelle Zeilen 8-43) durch:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-jakarta);

  /* Primary – Navy (Default aus dem Ehninger Wappen), pro Gemeinde überschreibbar */
  --color-primary-50:  var(--gemeinde-primary-50,  #e8f0fd);
  --color-primary-100: var(--gemeinde-primary-100, #c5d9f2);
  --color-primary-200: var(--gemeinde-primary-200, #8baee5);
  --color-primary-300: var(--gemeinde-primary-300, #5083d8);
  --color-primary-400: var(--gemeinde-primary-400, #1a5cbf);
  --color-primary-500: var(--gemeinde-primary-500, #0f2d6b);
  --color-primary-600: var(--gemeinde-primary-600, #0c2460);
  --color-primary-700: var(--gemeinde-primary-700, #091b55);
  --color-primary-800: var(--gemeinde-primary-800, #061240);
  --color-primary-900: var(--gemeinde-primary-900, #030a2b);

  /* Gold – Akzentfarbe, pro Gemeinde überschreibbar */
  --color-gold-50:  var(--gemeinde-accent-50,  #fdf3e0);
  --color-gold-100: var(--gemeinde-accent-100, #fbe0a6);
  --color-gold-200: var(--gemeinde-accent-200, #f8cc6e);
  --color-gold-300: var(--gemeinde-accent-300, #f5b836);
  --color-gold-400: var(--gemeinde-accent-400, #f3a800);
  --color-gold-500: var(--gemeinde-accent-500, #e8a020);
  --color-gold-600: var(--gemeinde-accent-600, #c88018);
  --color-gold-700: var(--gemeinde-accent-700, #a86010);
  --color-gold-800: var(--gemeinde-accent-800, #884008);
  --color-gold-900: var(--gemeinde-accent-900, #682000);

  /* Akzentrot – nur für Warnungen, bewusst nicht gemeinde-spezifisch */
  --color-accent-50:  #FAE8E8;
  --color-accent-100: #F5CCCC;
  --color-accent-500: #c41e1e;
  --color-accent-600: #B30000;
  --color-accent-700: #990000;
}
```

- [ ] **Step 2: `src/app/layout.tsx` — Theme-Injection ergänzen**

Ersetze den Inhalt von `src/app/layout.tsx` mit:

```tsx
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google'
import { Toaster } from 'sonner'
import { getGemeinde } from '@/lib/gemeinde'
import { generateColorScale } from '@/lib/colorScale'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-dm',
})

export const metadata: Metadata = {
  title: 'Dorfly – Deine Gemeinde. Dein Smartphone.',
  description: 'Der direkte, offizielle Kanal zwischen Ihrer Verwaltung und Ihren Bürgern. Lokal vernetzt. Für Kommunen bis 15.000 Einwohner.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/favicon-32.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dorfly',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f2d6b',
  width: 'device-width',
  initialScale: 1,
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

function buildThemeStyle(primaryColor?: string | null, accentColor?: string | null): string | null {
  const declarations: string[] = []

  if (primaryColor && HEX_RE.test(primaryColor)) {
    const scale = generateColorScale(primaryColor)
    for (const [shade, hex] of Object.entries(scale)) {
      declarations.push(`--gemeinde-primary-${shade}: ${hex};`)
    }
  }
  if (accentColor && HEX_RE.test(accentColor)) {
    const scale = generateColorScale(accentColor)
    for (const [shade, hex] of Object.entries(scale)) {
      declarations.push(`--gemeinde-accent-${shade}: ${hex};`)
    }
  }

  return declarations.length > 0 ? `:root { ${declarations.join(' ')} }` : null
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const gemeinde = await getGemeinde()
  const themeStyle = buildThemeStyle(gemeinde?.primary_color, gemeinde?.accent_color)

  return (
    <html lang="de" className={`${jakarta.variable} ${dmSans.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}
      </head>
      <body className="min-h-full bg-gray-50 font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg focus:text-primary-600 focus:font-bold focus:outline-none"
        >
          Zum Hauptinhalt springen
        </a>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Dead Inline-Styles in `(app)` und `(admin)` Layouts entfernen**

In `src/app/(app)/layout.tsx`, entferne Zeile `const primaryColor = gemeinde?.primary_color ?? '#0f2d6b'` und ändere:

```tsx
    <div
      className="min-h-screen bg-[#F4F6F9]"
      style={{ '--color-primary': primaryColor } as React.CSSProperties}
    >
```
zu:
```tsx
    <div className="min-h-screen bg-[#F4F6F9]">
```

In `src/app/(admin)/layout.tsx`, entferne ebenso Zeile `const primaryColor = gemeinde?.primary_color ?? '#0f2d6b'` und ändere:

```tsx
    <div
      className="min-h-screen bg-[#F4F6F9]"
      style={{ '--color-primary': primaryColor } as React.CSSProperties}
    >
```
zu:
```tsx
    <div className="min-h-screen bg-[#F4F6F9]">
```

- [ ] **Step 4: Dev-Server starten und visuell prüfen**

Run: `npm run dev`
Öffne die App im Browser, navigiere zu `/home`. Erwartet: Seite sieht unverändert aus (Navy/Gold wie bisher), da `gemeinde.primary_color`/`accent_color` für Ehningen bereits auf die Default-Werte gesetzt sind.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx "src/app/(app)/layout.tsx" "src/app/(admin)/layout.tsx"
git commit -m "feat: inject per-gemeinde color scale as CSS custom properties"
```

---

### Task 6: Validierung + API-Route erweitern

**Files:**
- Modify: `src/lib/validations.ts:68-79`
- Modify: `src/app/api/gemeinde/aktualisieren/route.ts`

- [ ] **Step 1: Hex-Validator + Schema-Felder ergänzen**

In `src/lib/validations.ts`, direkt vor `export const gemeindeAktualisierenSchema`, ergänze:

```ts
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Muss ein Hex-Farbcode sein (#rrggbb)').nullable().optional()
```

Und erweitere das Schema (bestehende Zeilen 70-79) um drei Felder:

```ts
export const gemeindeAktualisierenSchema = z.object({
  gemeindeId: uuid,
  einwohner: z.number().int().positive().nullable(),
  haushalte: z.number().int().positive().nullable(),
  ratsinformation_url:  urlOrEmpty,
  notfallnummern_url:   urlOrEmpty,
  homepage_url:         urlOrEmpty,
  mitteilungsblatt_url: urlOrEmpty,
  warncell_id: z.string().max(50).transform(v => v.trim() || null).nullable().optional(),
  primary_color: hexColor,
  accent_color:  hexColor,
  logo_url:      urlOrEmpty,
})
```

- [ ] **Step 2: API-Route — neue Felder ins Update übernehmen**

In `src/app/api/gemeinde/aktualisieren/route.ts`, erweitere das `.update({...})`-Objekt:

```ts
      .update({
        einwohner:            v.data.einwohner,
        haushalte:            v.data.haushalte,
        ratsinformation_url:  v.data.ratsinformation_url  ?? null,
        notfallnummern_url:   v.data.notfallnummern_url   ?? null,
        homepage_url:         v.data.homepage_url         ?? null,
        mitteilungsblatt_url: v.data.mitteilungsblatt_url ?? null,
        warncell_id:          v.data.warncell_id          ?? null,
        primary_color:        v.data.primary_color        ?? null,
        accent_color:         v.data.accent_color         ?? null,
        logo_url:             v.data.logo_url             ?? null,
      })
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/lib/validations.ts "src/app/api/gemeinde/aktualisieren/route.ts"
git commit -m "feat: accept primary_color, accent_color, logo_url in gemeinde update API"
```

---

### Task 7: „Design“-Sektion in `GemeindeEinstellungen.tsx`

**Files:**
- Modify: `src/components/dashboard/GemeindeEinstellungen.tsx`

- [ ] **Step 1: Props, State und Logo-Upload-Handler ergänzen**

Ersetze den Dateikopf (Imports, Props-Interface, Komponentenkopf bis vor `async function save()`) mit:

```tsx
'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { Settings, Check, X, Loader2 } from 'lucide-react'
import { getContrastRatio } from '@/lib/contrast'
import { createClient } from '@/lib/supabase/client'

interface Props {
  gemeindeId: string
  initialEinwohner: number | null
  initialHaushalte: number | null
  initialRatsinformationUrl: string | null
  initialNotfallnummernUrl: string | null
  initialHomepageUrl: string | null
  initialMitteilungsblattUrl: string | null
  initialWarncellId: string | null
  initialPrimaryColor: string | null
  initialAccentColor: string | null
  initialLogoUrl: string | null
}

const DIENSTE = [
  { key: 'ratsinformation_url',  label: 'Ratsinformationssystem', placeholder: 'https://ris.gemeinde.de' },
  { key: 'notfallnummern_url',   label: 'Notfallnummern',         placeholder: 'https://...' },
  { key: 'homepage_url',         label: 'Homepage',               placeholder: 'https://www.gemeinde.de' },
  { key: 'mitteilungsblatt_url', label: 'Mitteilungsblatt',       placeholder: 'https://...' },
] as const

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

export default function GemeindeEinstellungen({
  gemeindeId,
  initialEinwohner,
  initialHaushalte,
  initialRatsinformationUrl,
  initialNotfallnummernUrl,
  initialHomepageUrl,
  initialMitteilungsblattUrl,
  initialWarncellId,
  initialPrimaryColor,
  initialAccentColor,
  initialLogoUrl,
}: Props) {
  const [open, setOpen] = useState(false)
  const [einwohner, setEinwohner] = useState(String(initialEinwohner ?? ''))
  const [haushalte, setHaushalte] = useState(String(initialHaushalte ?? ''))
  const [warncellId, setWarncellId] = useState(initialWarncellId ?? '')
  const [urls, setUrls] = useState({
    ratsinformation_url:  initialRatsinformationUrl  ?? '',
    notfallnummern_url:   initialNotfallnummernUrl   ?? '',
    homepage_url:         initialHomepageUrl         ?? '',
    mitteilungsblatt_url: initialMitteilungsblattUrl ?? '',
  })
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor ?? '#0f2d6b')
  const [accentColor, setAccentColor] = useState(initialAccentColor ?? '#e8a020')
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error('Nur PNG, JPEG oder SVG erlaubt')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Datei zu groß (max. 2 MB)')
      return
    }

    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `gemeinden/${gemeindeId}/logo_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('dorfly-media').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('dorfly-media').getPublicUrl(path)
      setLogoUrl(publicUrl)
    } catch {
      toast.error('Logo-Upload fehlgeschlagen')
    } finally {
      setUploadingLogo(false)
    }
  }

  const primaryContrast = HEX_RE.test(primaryColor) ? getContrastRatio(primaryColor, '#ffffff') : null
  const accentContrast  = HEX_RE.test(accentColor)  ? getContrastRatio(accentColor, '#ffffff')  : null
```

- [ ] **Step 2: `save()` um neue Felder erweitern**

Ersetze den `body: JSON.stringify({...})` in `save()`:

```ts
        body: JSON.stringify({
          gemeindeId,
          einwohner: einwohner ? parseInt(einwohner) : null,
          haushalte: haushalte ? parseInt(haushalte) : null,
          warncell_id: warncellId,
          primary_color: primaryColor,
          accent_color: accentColor,
          logo_url: logoUrl || null,
          ...urls,
        }),
```

- [ ] **Step 3: „Design“-Sektion in die JSX einfügen**

Füge direkt nach der öffnenden `{open && (` `<div>` (vor dem „Statistiken“-Abschnitt) folgende Sektion ein:

```tsx
          {/* Design */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Design</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Primärfarbe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={HEX_RE.test(primaryColor) ? primaryColor : '#0f2d6b'}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer"
                    aria-label="Primärfarbe auswählen"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    placeholder="#0f2d6b"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {primaryContrast !== null && primaryContrast < 4.5 && (
                  <p role="alert" className="text-xs text-amber-600 mt-1">
                    Kontrast zu Weiß ist niedrig ({primaryContrast.toFixed(1)}:1) – heller Text auf dieser Farbe könnte schwer lesbar sein.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Akzentfarbe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={HEX_RE.test(accentColor) ? accentColor : '#e8a020'}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer"
                    aria-label="Akzentfarbe auswählen"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    placeholder="#e8a020"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {accentContrast !== null && accentContrast < 4.5 && (
                  <p role="alert" className="text-xs text-amber-600 mt-1">
                    Kontrast zu Weiß ist niedrig ({accentContrast.toFixed(1)}:1) – heller Text auf dieser Farbe könnte schwer lesbar sein.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Gemeindewappen / Logo</label>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Wappen-Vorschau" className="w-12 h-12 rounded-lg object-contain border border-gray-200 bg-white" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                      Kein Logo
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <span className="text-xs font-bold text-primary-500 bg-primary-50 px-3 py-2 rounded-lg">
                      {uploadingLogo ? 'Lädt…' : 'Bild auswählen'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoChange}
                      disabled={uploadingLogo}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

```

Diese Sektion kommt direkt nach `<div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 space-y-4">` und vor dem bestehenden `{/* Statistiken */}`-Kommentar.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/GemeindeEinstellungen.tsx
git commit -m "feat: add design section (colors + logo) to GemeindeEinstellungen"
```

---

### Task 8: Neue Props von der Dashboard-Seite durchreichen

**Files:**
- Modify: `src/app/(admin)/dashboard/page.tsx:121-129` (Typ-Cast) und `:239-248` (Komponenten-Aufruf)

- [ ] **Step 1: Inline-Typ um neue Felder erweitern**

```tsx
  const gemeindeId = profile.gemeinde_id
  const gemeinde = profile.gemeinden as {
    id: string; name: string; bundesland: string;
    einwohner: number | null; haushalte: number | null; plz: string | null;
    features: Record<string, unknown> | null
    ratsinformation_url: string | null; notfallnummern_url: string | null;
    homepage_url: string | null; mitteilungsblatt_url: string | null;
    warncell_id: string | null;
    primary_color: string | null; accent_color: string | null; logo_url: string | null;
  } | null
```

- [ ] **Step 2: Neue Props an `GemeindeEinstellungen` übergeben**

```tsx
              <GemeindeEinstellungen
                gemeindeId={gemeindeId}
                initialEinwohner={gemeinde?.einwohner ?? null}
                initialHaushalte={gemeinde?.haushalte ?? null}
                initialRatsinformationUrl={gemeinde?.ratsinformation_url ?? null}
                initialNotfallnummernUrl={gemeinde?.notfallnummern_url ?? null}
                initialHomepageUrl={gemeinde?.homepage_url ?? null}
                initialMitteilungsblattUrl={gemeinde?.mitteilungsblatt_url ?? null}
                initialWarncellId={gemeinde?.warncell_id ?? null}
                initialPrimaryColor={gemeinde?.primary_color ?? null}
                initialAccentColor={gemeinde?.accent_color ?? null}
                initialLogoUrl={gemeinde?.logo_url ?? null}
              />
```

(Der Supabase-Select in Zeile 22 nutzt bereits `gemeinden(*)`, es sind also keine Query-Änderungen nötig.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/dashboard/page.tsx"
git commit -m "feat: pass primary_color, accent_color, logo_url to GemeindeEinstellungen"
```

---

### Task 9: Wappen im Home-Header anzeigen

**Files:**
- Modify: `src/app/(app)/home/page.tsx:84-90`

- [ ] **Step 1: Header-Markup um Logo ergänzen**

Ersetze:

```tsx
      {/* Header */}
      <div className="bg-primary-500 px-6 pt-14 pb-6">
        <p className="text-[10px] font-bold tracking-[3px] text-gold-500 uppercase">{gemeindeName}</p>
        <h1 className="text-white font-extrabold text-[28px] mt-1.5 leading-snug">
          Guten Morgen,<br />{vorname}!
        </h1>
        <p className="text-white/60 text-[13px] mt-1.5">Was möchtest du heute tun?</p>
      </div>
```

durch:

```tsx
      {/* Header */}
      <div className="bg-primary-500 px-6 pt-14 pb-6">
        <div className="flex items-center gap-3">
          {gemeinde?.logo_url && (
            <img
              src={gemeinde.logo_url}
              alt=""
              className="w-10 h-10 rounded-lg object-contain bg-white/10 p-1 shrink-0"
            />
          )}
          <div>
            <p className="text-[10px] font-bold tracking-[3px] text-gold-500 uppercase">{gemeindeName}</p>
            <h1 className="text-white font-extrabold text-[28px] mt-1.5 leading-snug">
              Guten Morgen,<br />{vorname}!
            </h1>
          </div>
        </div>
        <p className="text-white/60 text-[13px] mt-1.5">Was möchtest du heute tun?</p>
      </div>
```

(`alt=""` ist bewusst leer: das Wappen ist hier rein dekorativ/redundant, der Gemeindename steht bereits als Text direkt daneben — WCAG-konforme Vermeidung doppelter Vorlesung durch Screenreader.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine neuen Fehler.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/home/page.tsx"
git commit -m "feat: show gemeinde logo in home header"
```

---

### Task 10: End-to-End-Verifikation

**Files:** keine (manueller Test)

- [ ] **Step 1: Migration lokal anwenden**

Run: `supabase db push` (oder das im Projekt übliche Migrations-Kommando)
Expected: `050_gemeinden_accent_color.sql` wird angewendet, keine Fehler.

- [ ] **Step 2: Vollständige Testsuite**

Run: `npm run test`
Expected: alle Tests PASS, inkl. der neuen `colorScale.test.ts` und `contrast.test.ts`.

- [ ] **Step 3: Manueller Test im Dashboard**

Run: `npm run dev`, als `verwaltung`-Rolle einloggen, `/dashboard` öffnen.
- „Gemeinde-Einstellungen“ öffnen → „Design“-Sektion sichtbar.
- Primärfarbe auf einen auffälligen Wert (z. B. `#16a34a`) ändern, speichern.
- Seite neu laden, `/home` aufrufen → Header-Hintergrund, aktiver BottomNav-Zustand etc. sind jetzt grün statt navy.
- Sehr helle Farbe (z. B. `#fef3c7`) eintragen → Kontrast-Warnung erscheint, Speichern bleibt trotzdem möglich.
- Logo hochladen (PNG) → Vorschau im Dashboard erscheint, nach Neuladen von `/home` erscheint das Logo im Header.
- Datei > 2 MB oder falscher Typ (z. B. `.pdf`) auswählen → Fehlermeldung, kein Upload.

- [ ] **Step 4: Regressionscheck**

Prüfe visuell `/feed`, `/maengel`, `/dashboard` (Vereins-/Gewerbe-Bereiche) — bestehende `primary-*`/`gold-*` Farben sehen für Ehningen weiterhin wie vorher aus (Default-Werte greifen).

---

## Spec-Abdeckung (Selbstcheck)

- A. Datenmodell → Task 1, 2
- B. Runtime-Theming (Skalen-Generator + Injection) → Task 3, 5
- C. Wappen/Logo (Anzeige + Upload) → Task 7, 9
- D. Dashboard-UI + API → Task 6, 7, 8
- E. Tests → Task 3, 4 (Unit), Task 10 (E2E)
- Kontrast-Warnung (nicht-blockierend) → Task 4, 7
