# Feedback-Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein temporärer Feedback-Button auf der Startseite (Banner analog zum Dashboard-Zugang), der ein Modal mit Kontaktformular öffnet und eine E-Mail an `hallo@dorfly.de` sendet — pro Gemeinde im Super-Admin-Dashboard an-/abschaltbar.

**Architecture:** Kein neues DB-Schema nötig — `gemeinden.features` ist bereits schemalos (`jsonb`). Der neue `feedback`-Key wird wie die bestehenden Feature-Flags über `isFeatureAktiv()` gelesen und über die bestehende `PATCH /api/admin/gemeinden/[id]/features`-Route geschrieben. Eine neue Client-Komponente `FeedbackButton` (Banner-Trigger + Modal in einer Datei, nach dem Vorbild von `ReportButton.tsx`) wird auf der Home-Page gerendert und postet an eine neue `/api/feedback`-Route, die per Resend eine E-Mail verschickt (kein DB-Fallback).

**Tech Stack:** Next.js App Router (Server Component `home/page.tsx` + Client Component), Supabase (Auth-Check in der API-Route), Resend (E-Mail-Versand), Tailwind v4.

**Referenz-Spec:** `docs/superpowers/specs/2026-07-28-feedback-button-design.md`

---

### Task 1: Feature-Flag `feedback` im Typ ergänzen

**Files:**
- Modify: `src/lib/features.ts:1-9`

- [ ] **Step 1: `feedback` zum `GemeindeFeatures`-Type hinzufügen**

In `src/lib/features.ts`, ersetze:

```ts
export type GemeindeFeatures = {
  abfallkalender?:      boolean
  umfragen?:            boolean
  gemeinderat?:         boolean
  gewerbe?:             boolean
  vereine?:             boolean
  marktplatz?:          boolean
  buergermeisterLabel?: 'buergermeister' | 'verwaltung'
}
```

durch:

```ts
export type GemeindeFeatures = {
  abfallkalender?:      boolean
  umfragen?:            boolean
  gemeinderat?:         boolean
  gewerbe?:             boolean
  vereine?:             boolean
  marktplatz?:          boolean
  feedback?:            boolean
  buergermeisterLabel?: 'buergermeister' | 'verwaltung'
}
```

- [ ] **Step 2: Typecheck laufen lassen**

Run: `npm run build -- --no-lint` (oder `npx tsc --noEmit`, falls schneller)
Expected: Kein neuer Typfehler durch die Erweiterung (die restlichen Verwendungsstellen von `GemeindeFeatures` sind additiv-kompatibel, da alle Keys optional sind).

- [ ] **Step 3: Commit**

```bash
git add src/lib/features.ts
git commit -m "feat: feedback-Feature-Flag zu GemeindeFeatures hinzufuegen"
```

---

### Task 2: Feedback-Toggle im Super-Admin-Dashboard registrieren

**Files:**
- Modify: `src/app/admin/dashboard/GemeindeKonfigSlideOver.tsx:8-15`

- [ ] **Step 1: `FEATURE_LABELS` um den Feedback-Eintrag erweitern**

In `src/app/admin/dashboard/GemeindeKonfigSlideOver.tsx`, ersetze:

```ts
const FEATURE_LABELS: { key: keyof Omit<GemeindeFeatures, 'buergermeisterLabel'>; label: string }[] = [
  { key: 'abfallkalender', label: 'Abfallkalender' },
  { key: 'umfragen',       label: 'Umfragen' },
  { key: 'gemeinderat',    label: 'Gemeinderat' },
  { key: 'gewerbe',        label: 'Gewerbe & Lokale Angebote' },
  { key: 'vereine',        label: 'Vereine' },
  { key: 'marktplatz',     label: 'Marktplatz' },
]
```

durch:

```ts
const FEATURE_LABELS: { key: keyof Omit<GemeindeFeatures, 'buergermeisterLabel'>; label: string }[] = [
  { key: 'abfallkalender', label: 'Abfallkalender' },
  { key: 'umfragen',       label: 'Umfragen' },
  { key: 'gemeinderat',    label: 'Gemeinderat' },
  { key: 'gewerbe',        label: 'Gewerbe & Lokale Angebote' },
  { key: 'vereine',        label: 'Vereine' },
  { key: 'marktplatz',     label: 'Marktplatz' },
  { key: 'feedback',       label: 'Feedback' },
]
```

Kein weiterer Code nötig — die Zeile wird durch das bestehende `.map()` (Zeilen 102-127) automatisch als Toggle-Zeile gerendert und nutzt den bestehenden `updateFeature()`-Mechanismus.

- [ ] **Step 2: Manuell im Dev-Server prüfen**

Run: `npm run dev`, als `super_admin` einloggen, `/admin/dashboard` öffnen, bei einer Test-Gemeinde auf "Konfiguration" klicken.
Expected: Ein neuer Toggle "Feedback" erscheint unterhalb von "Marktplatz", standardmäßig aus (grau). Klick schaltet ihn auf aktiv (indigo) um, kein Fehler-Toast.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/dashboard/GemeindeKonfigSlideOver.tsx
git commit -m "feat: Feedback-Toggle im Super-Admin-Dashboard ergaenzen"
```

---

### Task 3: API-Route `/api/feedback`

**Files:**
- Create: `src/app/api/feedback/route.ts`

- [ ] **Step 1: Route-Datei anlegen**

```ts
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  }

  const { message, email, gemeindeId, gemeindeName } = await req.json()

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Feedback-Text fehlt' }, { status: 400 })
  }
  if (!gemeindeId || typeof gemeindeId !== 'string') {
    return NextResponse.json({ error: 'Gemeinde fehlt' }, { status: 400 })
  }
  if (email !== undefined && email !== '' && (typeof email !== 'string' || !EMAIL_REGEX.test(email))) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[api/feedback] RESEND_API_KEY nicht gesetzt')
    return NextResponse.json({ error: 'Versand aktuell nicht möglich' }, { status: 500 })
  }

  const safeMessage = escapeHtml(message.trim()).replace(/\n/g, '<br>')
  const safeGemeindeName = escapeHtml(String(gemeindeName ?? gemeindeId))
  const safeEmail = email ? escapeHtml(String(email)) : null

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Dorfly Feedback <noreply@dorfly.de>',
      to: process.env.FEEDBACK_EMAIL || 'hallo@dorfly.de',
      replyTo: safeEmail ?? undefined,
      subject: `Feedback aus ${safeGemeindeName}`,
      html: `
        <h2 style="font-family:sans-serif;color:#0D1B2A;">Neues Feedback</h2>
        <table style="font-family:sans-serif;font-size:15px;border-collapse:collapse;width:100%;">
          <tr><td style="padding:8px 0;color:#64748B;width:140px;">Gemeinde</td><td style="padding:8px 0;font-weight:600;color:#0D1B2A;">${safeGemeindeName}</td></tr>
          ${safeEmail ? `<tr><td style="padding:8px 0;color:#64748B;">E-Mail</td><td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#0057A8;">${safeEmail}</a></td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#64748B;vertical-align:top;">Feedback</td><td style="padding:8px 0;color:#0D1B2A;">${safeMessage}</td></tr>
        </table>
      `,
    })
  } catch (sendErr) {
    console.error('[api/feedback] Mailversand fehlgeschlagen:', sendErr)
    return NextResponse.json({ error: 'Versand fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Auth-Gate manuell prüfen (ausgeloggt)**

Run: `npm run dev`, dann im Terminal (ohne Session-Cookie):

```bash
curl -s -o - -w "\n%{http_code}\n" -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"message":"Test","gemeindeId":"x"}'
```

Expected: `{"error":"Nicht eingeloggt"}` und Statuscode `401`.

- [ ] **Step 3: Validierung manuell prüfen (eingeloggt, ungültige Eingaben)**

Im Browser eingeloggt, DevTools-Konsole:

```js
fetch('/api/feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: '', gemeindeId: 'x' }),
}).then(r => r.status).then(console.log)
```

Expected: `400` (leere Nachricht). Ebenso mit `email: 'keine-email'` statt leerer `message` → `400` wegen ungültiger E-Mail.

- [ ] **Step 4: Erfolgreichen Versand prüfen**

Voraussetzung: `RESEND_API_KEY` ist in `.env.local` gesetzt (siehe CLAUDE.md-Liste der benötigten Env-Variablen).

```js
fetch('/api/feedback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Testfeedback', gemeindeId: 'abc', gemeindeName: 'Testgemeinde' }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ ok: true }`, und die E-Mail kommt im `hallo@dorfly.de`-Postfach (bzw. dem in `FEEDBACK_EMAIL` konfigurierten Test-Postfach) an, mit Betreff "Feedback aus Testgemeinde".

- [ ] **Step 5: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: API-Route fuer Feedback-Versand per E-Mail"
```

---

### Task 4: `FeedbackButton`-Komponente (Banner + Modal)

**Files:**
- Create: `src/components/FeedbackButton.tsx`

- [ ] **Step 1: Komponente anlegen**

```tsx
'use client'

import { useState } from 'react'
import { MessageSquare, X, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Props {
  gemeindeId: string
  gemeindeName: string
}

export default function FeedbackButton({ gemeindeId, gemeindeName }: Props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trapRef = useFocusTrap(open)

  function handleClose() {
    setOpen(false)
    if (sent) {
      setMessage('')
      setEmail('')
      setSent(false)
    }
    setError(null)
  }

  async function submit() {
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          email: email.trim() || undefined,
          gemeindeId,
          gemeindeName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Feedback konnte nicht gesendet werden, bitte versuche es erneut.')
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feedback konnte nicht gesendet werden, bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left bg-primary-500 rounded-[20px] p-4 flex items-center gap-4 shadow-[0_4px_14px_rgba(15,45,107,0.33)] transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none"
      >
        <div className="w-11 h-11 rounded-[14px] bg-white/14 flex items-center justify-center shrink-0">
          <MessageSquare className="w-[22px] h-[22px] text-white" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-white font-bold text-[14.5px]">Feedback</p>
          <p className="text-white/55 text-xs mt-0.5">Hilf uns, Dorfly zu verbessern</p>
        </div>
        <div className="w-[30px] h-[30px] rounded-[9px] bg-gold-500 flex items-center justify-center shrink-0">
          <svg width="15" height="15" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M4 11h14M13 5l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4"
          onClick={handleClose}
          onKeyDown={e => e.key === 'Escape' && handleClose()}
        >
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="feedback-dialog-title" className="font-bold text-gray-900">Feedback</h2>
              <button onClick={handleClose} aria-label="Dialog schließen" className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {sent ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">Danke für dein Feedback! Wir schauen es uns an.</p>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium"
                >
                  Schließen
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Das ist die erste öffentliche Version von Dorfly. Wenn dir etwas auffällt oder etwas
                  unklar ist, kannst du hier Feedback geben. So hilfst du dabei, Dorfly kontinuierlich
                  zu verbessern.
                </p>

                <div>
                  <label htmlFor="feedback-message" className="text-sm font-medium text-gray-700 mb-1 block">
                    Dein Feedback
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Was ist dir aufgefallen?"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="feedback-email" className="text-sm font-medium text-gray-700 mb-1 block">
                    Deine E-Mail <span className="font-normal text-gray-500">(falls wir antworten sollen, optional)</span>
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-red-600">{error}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={submit}
                    disabled={!message.trim() || loading}
                    className={clsx(
                      'flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2',
                      'bg-primary-500 text-white disabled:opacity-50',
                    )}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    Senden
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Typecheck/Lint laufen lassen**

Run: `npm run lint`
Expected: Keine neuen Fehler/Warnungen für `src/components/FeedbackButton.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/FeedbackButton.tsx
git commit -m "feat: FeedbackButton-Komponente mit Modal-Formular"
```

---

### Task 5: `FeedbackButton` auf der Startseite einbinden

**Files:**
- Modify: `src/app/(app)/home/page.tsx`

- [ ] **Step 1: Import ergänzen**

In `src/app/(app)/home/page.tsx`, nach der bestehenden Import-Zeile für `isFeatureAktiv` (Zeile 5) ergänzen:

```ts
import { isFeatureAktiv } from '@/lib/features'
import FeedbackButton from '@/components/FeedbackButton'
```

- [ ] **Step 2: Banner nach dem Dashboard-Banner einfügen**

In `src/app/(app)/home/page.tsx`, direkt nach dem schließenden `)}` des Dashboard-Banner-Blocks (nach Zeile 130, vor dem Kommentar `{/* Warnmeldungs-Banner ... */}`) einfügen:

```tsx
        {/* Feedback-Banner — nur wenn fuer die Gemeinde aktiviert, nicht fuer Gaeste */}
        {!isGuest && gemeinde?.id && isFeatureAktiv(gemeinde, 'feedback') && (
          <FeedbackButton gemeindeId={gemeinde.id} gemeindeName={gemeindeName} />
        )}
```

Der Block sieht danach so aus (Ausschnitt):

```tsx
        {hasDashboard && (
          <Link href={dashboardHref} ...>
            ...
          </Link>
        )}

        {/* Feedback-Banner — nur wenn fuer die Gemeinde aktiviert, nicht fuer Gaeste */}
        {!isGuest && gemeinde?.id && isFeatureAktiv(gemeinde, 'feedback') && (
          <FeedbackButton gemeindeId={gemeinde.id} gemeindeName={gemeindeName} />
        )}

        {/* Warnmeldungs-Banner — nur bei aktiver Warnung */}
        {activeWarnung && (
          ...
```

- [ ] **Step 3: Manuell im Dev-Server prüfen — Toggle aus**

Run: `npm run dev`, als normaler Bürger einer Test-Gemeinde einloggen, deren `feedback`-Flag noch aus ist (Standard nach Rollout).
Expected: Kein Feedback-Banner auf der Startseite sichtbar.

- [ ] **Step 4: Toggle aktivieren und erneut prüfen**

Im Super-Admin-Dashboard (`/admin/dashboard`) für die Test-Gemeinde den "Feedback"-Toggle aktivieren (aus Task 2). Startseite neu laden.
Expected: Feedback-Banner erscheint unterhalb des Dashboard-Banners (bzw. an erster Stelle, falls kein Dashboard-Zugriff). Klick öffnet das Modal, Fokus springt auf das Textfeld, Tab-Taste bleibt innerhalb des Modals, Escape/Backdrop-Klick/X schließen es und stellen den Fokus auf den Banner-Button zurück.

- [ ] **Step 5: Für einen Gast (nicht eingeloggt) prüfen**

Ausgeloggt `/home` (bzw. die entsprechende Gast-Route) öffnen, für dieselbe Test-Gemeinde mit aktivem Flag.
Expected: Kein Feedback-Banner sichtbar (nur der "Anmelden oder registrieren"-Banner).

- [ ] **Step 6: End-to-End-Versand prüfen**

Im Modal ein Feedback eintragen (mit und ohne E-Mail-Feld), absenden.
Expected: Erfolgsmeldung "Danke für dein Feedback! Wir schauen es uns an." erscheint, E-Mail kommt im Postfach an (siehe Task 3, Step 4). Bei einem simulierten Fehler (z.B. `RESEND_API_KEY` kurzzeitig aus `.env.local` entfernen und Dev-Server neu starten) erscheint stattdessen die Fehlermeldung mit `role="alert"`, und der eingegebene Text bleibt im Textfeld erhalten.

- [ ] **Step 7: Build prüfen**

Run: `npm run build`
Expected: Build läuft ohne Fehler durch.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/home/page.tsx"
git commit -m "feat: Feedback-Banner auf der Startseite einbinden"
```

---

## Zusammenfassung nach Abschluss

- `gemeinden.features.feedback` steuert Sichtbarkeit pro Gemeinde (Standard: aus)
- Super-Admins schalten das Feature in `GemeindeKonfigSlideOver` genau wie die anderen Kacheln
- Eingeloggte Nutzer (alle Rollen, keine Gäste) sehen bei aktivem Flag einen Feedback-Banner auf der Startseite
- Das Modal sendet Freitext + optionale E-Mail + Gemeindename per `POST /api/feedback` als E-Mail an `hallo@dorfly.de` (kein DB-Fallback, kein Admin-UI für eingegangenes Feedback)