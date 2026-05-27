# Umfrage-Text nachbearbeiten — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verwaltungs-Rolle kann Titel, Beschreibung und Enddatum einer bestehenden Umfrage bearbeiten — ohne die Fragen anzufassen.

**Architecture:** Neues kompaktes Modal `UmfrageBearbeiten`, ausgelöst durch Pencil-Button in `UmfrageCard`. Nutzt das bestehende `/api/umfragen/bearbeiten` Endpoint (nur `fragen`-Parameter wird optional gemacht). Kein neues Backend, keine DB-Änderungen.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript · react-hook-form · zod · @hookform/resolvers · Tailwind v4 · lucide-react

---

## File Map

| Aktion | Datei | Was ändert sich |
|--------|-------|-----------------|
| Modify | `src/app/api/umfragen/bearbeiten/route.ts` | `fragen` im Schema optional machen; Fragen-Update nur wenn `fragen` vorhanden |
| Create | `src/components/umfrage/UmfrageBearbeiten.tsx` | Neues Modal mit 3 Feldern (Titel, Beschreibung, Enddatum) |
| Modify | `src/components/umfrage/UmfrageCard.tsx` | Import tauschen, Pencil-Button rendern, Modal einbinden |

---

## Task 1: `fragen` im Bearbeiten-Endpoint optional machen

**Files:**
- Modify: `src/app/api/umfragen/bearbeiten/route.ts`

Aktuell ist `fragen` im lokalen Schema Pflichtfeld (erbt `.min(1)` von `umfrageErstellenSchema`). Für den Text-Only-Edit darf die Route keine Fragen erwarten.

- [ ] **Schritt 1: Schema und Handler anpassen**

Ersetze den gesamten Inhalt von `src/app/api/umfragen/bearbeiten/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, umfrageErstellenSchema, umfrageBearbeitenSchema } from '@/lib/validations'

const bearbeitenSchema = umfrageBearbeitenSchema.extend({
  fragen: umfrageErstellenSchema.shape.fragen.optional(),
})

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(bearbeitenSchema, body)
    if (!v.success) return v.error

    const { id: umfrageId, titel, beschreibung, enddatum, fragen } = v.data
    const service = await createServiceClient()

    const { error: updateError } = await service
      .from('umfragen')
      .update({ titel, beschreibung: beschreibung ?? null, enddatum })
      .eq('id', umfrageId)
      .eq('gemeinde_id', profile.gemeinde_id!)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    if (fragen) {
      await service.from('umfrage_fragen').delete().eq('umfrage_id', umfrageId)

      for (const frage of fragen) {
        const { data: dbFrage, error: frageError } = await service
          .from('umfrage_fragen')
          .insert({ umfrage_id: umfrageId, reihenfolge: frage.reihenfolge, frage_text: frage.frage_text, typ: frage.typ })
          .select()
          .single()

        if (frageError || !dbFrage) return NextResponse.json({ error: frageError?.message ?? 'Fehler' }, { status: 500 })

        if (frage.umfrage_optionen?.length) {
          await service.from('umfrage_optionen').insert(
            frage.umfrage_optionen.map(o => ({ frage_id: dbFrage.id, reihenfolge: o.reihenfolge, option_text: o.option_text }))
          )
        }
      }
    }

    const { data: full } = await service
      .from('umfragen')
      .select('*, umfrage_fragen(*, umfrage_optionen(*))')
      .eq('id', umfrageId)
      .single()

    return NextResponse.json({ success: true, umfrage: full })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
```

- [ ] **Schritt 2: TypeScript-Build prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: kein Output (keine Fehler).

- [ ] **Schritt 3: Commit**

```bash
git add src/app/api/umfragen/bearbeiten/route.ts
git commit -m "feat: fragen im Bearbeiten-Endpoint optional machen"
```

---

## Task 2: `UmfrageBearbeiten.tsx` erstellen

**Files:**
- Create: `src/components/umfrage/UmfrageBearbeiten.tsx`

Kompaktes Modal mit react-hook-form + zod. Schickt nur `id`, `titel`, `beschreibung`, `enddatum` — keine Fragen.

- [ ] **Schritt 1: Datei erstellen**

Erstelle `src/components/umfrage/UmfrageBearbeiten.tsx` mit folgendem Inhalt:

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Loader2 } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Umfrage } from '@/types/umfrage'

const schema = z.object({
  titel: z.string().min(1, 'Titel erforderlich').max(200),
  beschreibung: z.string().max(1000).optional(),
  enddatum: z.string().min(1, 'Enddatum erforderlich'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  umfrage: Umfrage
  onClose: () => void
  onUpdate: (umfrage: Umfrage) => void
}

export default function UmfrageBearbeiten({ umfrage, onClose, onUpdate }: Props) {
  const containerRef = useFocusTrap(true)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      titel: umfrage.titel,
      beschreibung: umfrage.beschreibung ?? '',
      enddatum: umfrage.enddatum.slice(0, 16),
    },
  })

  async function onSubmit(values: FormValues) {
    setServerError('')
    try {
      const res = await fetch('/api/umfragen/bearbeiten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: umfrage.id, ...values }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Speichern')
      onUpdate(data.umfrage)
      onClose()
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="umfrage-bearbeiten-titel"
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="umfrage-bearbeiten-titel" className="font-bold text-gray-900">Umfrage bearbeiten</h2>
          <button onClick={onClose} aria-label="Schließen">
            <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="umfrage-titel" className="block text-sm font-medium text-gray-700 mb-1">
              Titel
            </label>
            <input
              id="umfrage-titel"
              type="text"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              {...register('titel')}
            />
            {errors.titel && (
              <p role="alert" className="text-red-500 text-xs mt-1">{errors.titel.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="umfrage-beschreibung" className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <textarea
              id="umfrage-beschreibung"
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none"
              {...register('beschreibung')}
            />
            {errors.beschreibung && (
              <p role="alert" className="text-red-500 text-xs mt-1">{errors.beschreibung.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="umfrage-enddatum" className="block text-sm font-medium text-gray-700 mb-1">
              Enddatum
            </label>
            <input
              id="umfrage-enddatum"
              type="datetime-local"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              {...register('enddatum')}
            />
            {errors.enddatum && (
              <p role="alert" className="text-red-500 text-xs mt-1">{errors.enddatum.message}</p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="text-red-500 text-sm">{serverError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl text-sm"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-primary-500 text-white font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript-Build prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: kein Output.

- [ ] **Schritt 3: Commit**

```bash
git add src/components/umfrage/UmfrageBearbeiten.tsx
git commit -m "feat: UmfrageBearbeiten Modal erstellen"
```

---

## Task 3: Pencil-Button in `UmfrageCard.tsx` verdrahten

**Files:**
- Modify: `src/components/umfrage/UmfrageCard.tsx`

Drei Änderungen: (1) Import tauschen, (2) Modal-Instanz tauschen, (3) Pencil-Button rendern.

- [ ] **Schritt 1: Import in UmfrageCard tauschen**

Ersetze in `src/components/umfrage/UmfrageCard.tsx` Zeile 12:

```tsx
// Alt:
import UmfrageErstellen from './UmfrageErstellen'

// Neu:
import UmfrageBearbeiten from './UmfrageBearbeiten'
```

- [ ] **Schritt 2: Modal-Instanz austauschen**

Ersetze in `src/components/umfrage/UmfrageCard.tsx` den Block (aktuell Zeilen 102–109):

```tsx
// Alt:
{showEditForm && (
  <UmfrageErstellen
    gemeindeId={umfrage.gemeinde_id}
    onClose={() => setShowEditForm(false)}
    onCreated={handleUpdated}
    existingUmfrage={umfrage}
  />
)}

// Neu:
{showEditForm && (
  <UmfrageBearbeiten
    umfrage={umfrage}
    onClose={() => setShowEditForm(false)}
    onUpdate={handleUpdated}
  />
)}
```

- [ ] **Schritt 3: Pencil-Button in den Header einfügen**

Im rechten Header-Bereich (aktuell Zeilen 131–139) befindet sich:

```tsx
<div className="flex items-center gap-2 shrink-0">
  <span className="text-xs text-gray-500">{teilnehmer} Teilnehmer</span>
  <button onClick={() => setIsExpanded(v => !v)}>
    {isExpanded
      ? <ChevronUp className="w-4 h-4 text-gray-400" />
      : <ChevronDown className="w-4 h-4 text-gray-400" />
    }
  </button>
</div>
```

Ersetzen durch:

```tsx
<div className="flex items-center gap-2 shrink-0">
  <span className="text-xs text-gray-500">{teilnehmer} Teilnehmer</span>
  {isVerwaltung && (
    <button
      onClick={() => setShowEditForm(true)}
      aria-label="Umfrage bearbeiten"
      className="text-gray-400 hover:text-gray-600 transition-colors"
    >
      <Pencil className="w-4 h-4" aria-hidden="true" />
    </button>
  )}
  <button onClick={() => setIsExpanded(v => !v)} aria-label={isExpanded ? 'Zuklappen' : 'Aufklappen'}>
    {isExpanded
      ? <ChevronUp className="w-4 h-4 text-gray-400" />
      : <ChevronDown className="w-4 h-4 text-gray-400" />
    }
  </button>
</div>
```

- [ ] **Schritt 4: TypeScript-Build prüfen**

```bash
npx tsc --noEmit
```

Erwartetes Ergebnis: kein Output.

- [ ] **Schritt 5: Commit und Push**

```bash
git add src/components/umfrage/UmfrageCard.tsx
git commit -m "feat: Verwaltung kann Umfragetext nachbearbeiten"
git push
```
