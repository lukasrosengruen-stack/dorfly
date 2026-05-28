# Hyperlinks in nutzergenerierten Inhalten — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nutzer aller Rollen können in allen Fließtext-Eingaben Hyperlinks einfügen (benannte Links + Auto-Linkify), die sicher und barrierefrei in der Anzeige als anklickbare `<a>`-Tags erscheinen.

**Architecture:** Erweiterung des bestehenden `src/lib/richText.tsx`-Systems ohne neue Abhängigkeiten. Speicherformat bleibt Plain-Text-Markdown (`[text](url)`). Pure Parsing-Logik wird in testbare Funktionen extrahiert (`parseRichText`, `isValidLinkUrl`), die React-Rendering-Schicht darüber aufgebaut. Alle Fließtext-Textareas werden auf `RichTextEditor` umgestellt, der einen neuen Link-Button mit Popup bekommt.

**Tech Stack:** React 19, TypeScript, Vitest, lucide-react (bereits vorhanden), `useFocusTrap` (bereits vorhanden unter `src/hooks/useFocusTrap.ts`)

---

## Dateiübersicht

| Datei | Änderung |
|---|---|
| `src/lib/richText.tsx` | Neue Funktionen `isValidLinkUrl`, `parseRichText`, `Segment`-Typ; `renderRichText` umgebaut; `htmlToMd` erweitert; `LinkPopup`-Komponente neu; Link-Button in Toolbar |
| `src/lib/richText.test.ts` | Neu — Unit-Tests für `isValidLinkUrl` und `parseRichText` |
| `src/components/umfrage/UmfrageCard.tsx` | `renderRichText` für `beschreibung` und `frage_text` |
| `src/app/(app)/buergermeister/BuergermeisterClient.tsx` | `renderRichText` für Anzeige + `RichTextEditor` für Eingabe |
| `src/components/umfrage/UmfrageErstellen.tsx` | `RichTextEditor` statt `textarea` (beschreibung) und `input` (frage_text) |
| `src/components/umfrage/UmfrageBearbeiten.tsx` | `RichTextEditor` statt `textarea` (beschreibung) via react-hook-form `Controller` |

---

## Task 1: Pure Parsing-Funktionen einfügen (TDD)

Ziel: `isValidLinkUrl`, `parseRichText` und der `Segment`-Typ werden in `richText.tsx` eingefügt — noch VOR der bestehenden `renderRichText`-Funktion, die unverändert bleibt. Der Build bleibt grün.

**Files:**
- Modify: `src/lib/richText.tsx`
- Create: `src/lib/richText.test.ts`

- [ ] **Step 1: Test-Datei mit Failing Tests erstellen**

```typescript
// src/lib/richText.test.ts
import { describe, it, expect } from 'vitest'
import { isValidLinkUrl, parseRichText } from './richText'

describe('isValidLinkUrl', () => {
  it('erlaubt http://', () => expect(isValidLinkUrl('http://example.com')).toBe(true))
  it('erlaubt https://', () => expect(isValidLinkUrl('https://example.com')).toBe(true))
  it('erlaubt https:// mit führendem Leerzeichen', () => expect(isValidLinkUrl('  https://example.com')).toBe(true))
  it('blockiert javascript:', () => expect(isValidLinkUrl('javascript:alert(1)')).toBe(false))
  it('blockiert data:', () => expect(isValidLinkUrl('data:text/html,<h1>x</h1>')).toBe(false))
  it('blockiert relative Pfade', () => expect(isValidLinkUrl('/evil')).toBe(false))
  it('blockiert protokoll-relativ', () => expect(isValidLinkUrl('//example.com')).toBe(false))
  it('blockiert nackte Domain', () => expect(isValidLinkUrl('example.com')).toBe(false))
  it('blockiert leeren String', () => expect(isValidLinkUrl('')).toBe(false))
})

describe('parseRichText', () => {
  it('leerer String ergibt leeres Array', () =>
    expect(parseRichText('')).toEqual([]))

  it('plain text ergibt ein Text-Segment', () =>
    expect(parseRichText('hallo welt')).toEqual([{ type: 'text', content: 'hallo welt' }]))

  it('parst Bold', () =>
    expect(parseRichText('**fett**')).toEqual([{ type: 'bold', content: 'fett' }]))

  it('parst benannten Link', () =>
    expect(parseRichText('[Klick](https://example.com)')).toEqual([
      { type: 'link', text: 'Klick', url: 'https://example.com' }
    ]))

  it('benannter Link mit javascript: URL → plain text', () =>
    expect(parseRichText('[evil](javascript:alert(1))')).toEqual([
      { type: 'text', content: '[evil](javascript:alert(1))' }
    ]))

  it('parst nackte URL', () =>
    expect(parseRichText('https://example.com')).toEqual([
      { type: 'url', url: 'https://example.com' }
    ]))

  it('parst nackte URL in umgebendem Text', () =>
    expect(parseRichText('Schau: https://example.com hier!')).toEqual([
      { type: 'text', content: 'Schau: ' },
      { type: 'url', url: 'https://example.com' },
      { type: 'text', content: ' hier!' },
    ]))

  it('erzeugt br-Segmente bei Zeilenumbrüchen', () =>
    expect(parseRichText('Zeile 1\nZeile 2')).toEqual([
      { type: 'text', content: 'Zeile 1' },
      { type: 'br' },
      { type: 'text', content: 'Zeile 2' },
    ]))

  it('dekodiert HTML-Entities', () =>
    expect(parseRichText('Hallo &amp; Welt')).toEqual([
      { type: 'text', content: 'Hallo & Welt' }
    ]))

  it('gemischter Inhalt: Text + Link + Bold', () =>
    expect(parseRichText('Besuche [unsere Seite](https://dorfly.de) für **mehr**')).toEqual([
      { type: 'text', content: 'Besuche ' },
      { type: 'link', text: 'unsere Seite', url: 'https://dorfly.de' },
      { type: 'text', content: ' für ' },
      { type: 'bold', content: 'mehr' },
    ]))
})
```

- [ ] **Step 2: Tests laufen — müssen FAIL sein**

```
npm run test -- src/lib/richText.test.ts
```
Erwartetes Ergebnis: Fehler mit "isValidLinkUrl is not a function".

- [ ] **Step 3: Neue Imports + Typen + Parsing-Funktionen in `richText.tsx` einfügen**

Ersetze die erste Zeile der Datei (`import { ReactNode, ... } from 'react'`) durch:

```typescript
import { ReactNode, useEffect, useRef, useState } from 'react'
import { Link2 } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// ── Typen ────────────────────────────────────────────────────────────────────

export type Segment =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'url'; url: string }
  | { type: 'br' }

// ── Parsing ───────────────────────────────────────────────────────────────────

export function isValidLinkUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

const COMBINED_RE = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s<>"]+)|(\*\*[^*]+\*\*)/g

function appendTextWithBreaks(text: string, segments: Segment[]): void {
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (line) segments.push({ type: 'text', content: line })
    if (i < lines.length - 1) segments.push({ type: 'br' })
  })
}

export function parseRichText(raw: string): Segment[] {
  if (!raw) return []
  const decoded = raw
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  const segments: Segment[] = []
  let lastIdx = 0
  COMBINED_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = COMBINED_RE.exec(decoded)) !== null) {
    if (match.index > lastIdx) {
      appendTextWithBreaks(decoded.slice(lastIdx, match.index), segments)
    }
    const full = match[0]
    if (full.startsWith('[')) {
      const m = full.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
      if (m) {
        segments.push({ type: 'link', text: m[1], url: m[2] })
      } else {
        appendTextWithBreaks(full, segments)
      }
    } else if (full.startsWith('http')) {
      segments.push({ type: 'url', url: full })
    } else if (full.startsWith('**')) {
      segments.push({ type: 'bold', content: full.slice(2, -2) })
    }
    lastIdx = match.index + full.length
  }
  if (lastIdx < decoded.length) {
    appendTextWithBreaks(decoded.slice(lastIdx), segments)
  }
  return segments
}

```

Die bestehende `// ── Display: ...`-Sektion und `renderRichText`-Funktion bleibt danach unverändert im File.

- [ ] **Step 4: Tests laufen — müssen PASS sein**

```
npm run test -- src/lib/richText.test.ts
```
Erwartetes Ergebnis: Alle 18 Tests grün.

- [ ] **Step 5: Build prüfen**

```
npm run build 2>&1 | head -30
```
Erwartetes Ergebnis: Keine neuen Fehler.

- [ ] **Step 6: Commit**

```
git add src/lib/richText.tsx src/lib/richText.test.ts
git commit -m "feat: isValidLinkUrl und parseRichText mit Unit-Tests"
```

---

## Task 2: `renderRichText` und `htmlToMd` aktualisieren

**Files:**
- Modify: `src/lib/richText.tsx`

- [ ] **Step 1: `renderRichText` ersetzen**

Suche die Funktion, die mit `export function renderRichText(text: string): ReactNode {` beginnt (aktuell nach dem `// ── Display: ...`-Kommentar), und ersetze die gesamte Funktion (inklusive Kommentar darüber) durch:

```typescript
// ── Display ───────────────────────────────────────────────────────────────────

export function renderRichText(text: string): ReactNode {
  if (!text) return null
  const segments = parseRichText(text)
  if (segments.length === 0) return null
  if (segments.length === 1 && segments[0].type === 'text') return segments[0].content
  return segments.map((seg, i) => {
    switch (seg.type) {
      case 'text': return seg.content
      case 'br':   return <br key={i} />
      case 'bold': return <strong key={i}>{seg.content}</strong>
      case 'link':
        return (
          <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer"
             className="text-primary-600 underline underline-offset-2 break-all">
            {seg.text}
          </a>
        )
      case 'url':
        return (
          <a key={i} href={seg.url} target="_blank" rel="noopener noreferrer"
             className="text-primary-600 underline underline-offset-2 break-all">
            {seg.url}
          </a>
        )
    }
  })
}
```

- [ ] **Step 2: `htmlToMd` um `<a>`-Tag-Konvertierung erweitern**

Suche in `htmlToMd` die Zeile `.replace(/<[^>]+>/g, '')` und füge DAVOR folgende Zeile ein:

```typescript
    .replace(/<a[^>]*\shref="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, inner) => {
      const txt = inner.replace(/<[^>]+>/g, '').trim()
      return txt && txt !== url ? `[${txt}](${url})` : url
    })
```

Die vollständige `htmlToMd`-Funktion sieht danach so aus:

```typescript
function htmlToMd(html: string): string {
  if (!html || html === '<br>') return ''
  return html
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<span[^>]*font-weight:\s*bold[^>]*>([\s\S]*?)<\/span>/gi, '**$1**')
    .replace(/<a[^>]*\shref="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, inner) => {
      const txt = inner.replace(/<[^>]+>/g, '').trim()
      return txt && txt !== url ? `[${txt}](${url})` : url
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n+$/, '')
}
```

- [ ] **Step 3: Build und Tests**

```
npm run build 2>&1 | head -30
npm run test
```
Erwartetes Ergebnis: Build grün, alle Tests grün.

- [ ] **Step 4: Commit**

```
git add src/lib/richText.tsx
git commit -m "feat: renderRichText nutzt parseRichText, htmlToMd konvertiert Links"
```

---

## Task 3: `LinkPopup`-Komponente

**Files:**
- Modify: `src/lib/richText.tsx`

- [ ] **Step 1: `LinkPopup`-Komponente einfügen**

Suche den Kommentar `// ── RichTextEditor ──` und füge direkt DAVOR ein:

```typescript
// ── LinkPopup ────────────────────────────────────────────────────────────────

interface LinkPopupProps {
  selectedText: string
  onInsert: (displayText: string, url: string) => void
  onClose: () => void
}

function LinkPopup({ selectedText, onInsert, onClose }: LinkPopupProps) {
  const containerRef = useFocusTrap(true)
  const [displayText, setDisplayText] = useState(selectedText)
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function handleSubmit() {
    if (!isValidLinkUrl(url)) {
      setUrlError('Bitte eine gültige URL eingeben (https://...)')
      return
    }
    onInsert(displayText.trim() || url, url.trim())
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Link einfügen"
      className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72 space-y-2"
    >
      {!selectedText && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">Anzeigetext</label>
          <input
            value={displayText}
            onChange={e => setDisplayText(e.target.value)}
            placeholder="Anzeigetext"
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-600 mb-1">URL</label>
        <input
          value={url}
          onChange={e => { setUrl(e.target.value); setUrlError('') }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit() } }}
          placeholder="https://..."
          type="url"
          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {urlError && <p role="alert" className="text-red-500 text-xs mt-1">{urlError}</p>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 text-xs py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
        >
          Einfügen
        </button>
      </div>
    </div>
  )
}

```

- [ ] **Step 2: Build prüfen**

```
npm run build 2>&1 | head -30
```
Erwartetes Ergebnis: Keine Fehler.

- [ ] **Step 3: Commit**

```
git add src/lib/richText.tsx
git commit -m "feat: LinkPopup-Komponente"
```

---

## Task 4: Link-Button in `RichTextEditor`-Toolbar

**Files:**
- Modify: `src/lib/richText.tsx`

- [ ] **Step 1: Neue State/Refs in `RichTextEditor` einfügen**

Suche im `RichTextEditor` die Zeile:

```typescript
  const [empty, setEmpty] = useState(!value)
```

und ersetze sie durch:

```typescript
  const [empty, setEmpty] = useState(!value)
  const [showLinkPopup, setShowLinkPopup] = useState(false)
  const savedRange = useRef<Range | null>(null)
  const savedSelection = useRef('')
```

- [ ] **Step 2: Neue Funktionen nach `handlePaste` einfügen**

Suche die schließende geschweifte Klammer der `handlePaste`-Funktion und füge direkt danach ein:

```typescript
  function openLinkPopup() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && divRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
      savedSelection.current = sel.toString()
    } else {
      savedRange.current = null
      savedSelection.current = ''
    }
    setShowLinkPopup(true)
  }

  function insertLink(displayText: string, url: string) {
    if (!divRef.current) return
    divRef.current.focus()
    if (savedRange.current) {
      const sel = window.getSelection()
      if (sel) { sel.removeAllRanges(); sel.addRange(savedRange.current) }
    }
    document.execCommand('insertText', false, `[${displayText}](${url})`)
    sync()
    savedRange.current = null
    savedSelection.current = ''
    setShowLinkPopup(false)
  }

  function closeLinkPopup() {
    setShowLinkPopup(false)
    savedRange.current = null
    savedSelection.current = ''
    divRef.current?.focus()
  }
```

- [ ] **Step 3: Toolbar-Block ersetzen**

Suche den Toolbar-Block (beginnt mit `<div className="flex gap-1 mb-1">`) und ersetze ihn durch:

```typescript
      <div className="flex gap-1 mb-1 relative">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); applyBold() }}
          className="px-2 py-0.5 text-xs font-bold border border-gray-200 rounded hover:bg-gray-100 transition-colors"
          title="Fett"
          aria-label="Fett"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); openLinkPopup() }}
          className="px-2 py-0.5 text-xs border border-gray-200 rounded hover:bg-gray-100 transition-colors flex items-center"
          aria-label="Link einfügen"
          title="Link einfügen"
        >
          <Link2 className="w-3 h-3" aria-hidden="true" />
        </button>
        {showLinkPopup && (
          <LinkPopup
            selectedText={savedSelection.current}
            onInsert={insertLink}
            onClose={closeLinkPopup}
          />
        )}
      </div>
```

- [ ] **Step 4: Build prüfen und manuell testen**

```
npm run build 2>&1 | head -30
```

Dann `npm run dev` starten und im Browser:
- Post erstellen → Link-Button klicken ohne Selektion → Popup erscheint mit Anzeigetext- und URL-Feld
- Text im Editor markieren → Link-Button klicken → Popup erscheint nur mit URL-Feld
- URL `javascript:alert(1)` eingeben → Fehlermeldung `role="alert"` erscheint
- URL `https://example.com` eingeben + Text → `[Anzeigetext](https://example.com)` im Editor
- Escape schließt Popup, Fokus kehrt zum Editor zurück
- Gespeicherter Post zeigt Link klickbar im Feed

- [ ] **Step 5: Commit**

```
git add src/lib/richText.tsx
git commit -m "feat: Link-Button und Popup in RichTextEditor-Toolbar"
```

---

## Task 5: `renderRichText` in `UmfrageCard`

**Files:**
- Modify: `src/components/umfrage/UmfrageCard.tsx`

- [ ] **Step 1: Import hinzufügen**

Füge nach den bestehenden Imports ein:

```typescript
import { renderRichText } from '@/lib/richText'
```

- [ ] **Step 2: `beschreibung`-Rendering ersetzen**

Suche:
```typescript
            {umfrage.beschreibung && <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{umfrage.beschreibung}</p>}
```
Ersetze durch:
```typescript
            {umfrage.beschreibung && <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{renderRichText(umfrage.beschreibung)}</p>}
```

- [ ] **Step 3: `frage_text`-Rendering ersetzen**

Suche:
```typescript
                      <p className="text-sm font-semibold text-gray-800 mb-2">
                        {idx + 1}. {frage.frage_text}
                      </p>
```
Ersetze durch:
```typescript
                      <p className="text-sm font-semibold text-gray-800 mb-2">
                        {idx + 1}. {renderRichText(frage.frage_text)}
                      </p>
```

- [ ] **Step 4: Build prüfen**

```
npm run build 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```
git add src/components/umfrage/UmfrageCard.tsx
git commit -m "feat: renderRichText für Umfrage-Beschreibung und Fragetexte"
```

---

## Task 6: `renderRichText` in `BuergermeisterClient`

**Files:**
- Modify: `src/app/(app)/buergermeister/BuergermeisterClient.tsx`

- [ ] **Step 1: Import hinzufügen**

Füge nach der bestehenden `import { createClient }` Zeile ein:

```typescript
import { renderRichText } from '@/lib/richText'
```

- [ ] **Step 2: Frage-Rendering ersetzen**

Suche:
```typescript
                    <p className={clsx('text-gray-900 font-medium text-sm', !expanded && 'line-clamp-2')}>
                      {f.frage}
                    </p>
```
Ersetze durch:
```typescript
                    <p className={clsx('text-gray-900 font-medium text-sm', !expanded && 'line-clamp-2')}>
                      {renderRichText(f.frage)}
                    </p>
```

- [ ] **Step 3: Antwort-Rendering ersetzen**

Suche:
```typescript
                    <p className="text-sm text-gray-700">{f.antwort}</p>
```
Ersetze durch:
```typescript
                    <p className="text-sm text-gray-700">{renderRichText(f.antwort!)}</p>
```

- [ ] **Step 4: Build prüfen**

```
npm run build 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```
git add src/app/(app)/buergermeister/BuergermeisterClient.tsx
git commit -m "feat: renderRichText für Bürgermeister-Fragen und -Antworten"
```

---

## Task 7: `RichTextEditor` in `UmfrageErstellen`

**Files:**
- Modify: `src/components/umfrage/UmfrageErstellen.tsx`

- [ ] **Step 1: Import hinzufügen**

Füge nach `import { clsx } from 'clsx'` ein:

```typescript
import { RichTextEditor } from '@/lib/richText'
```

- [ ] **Step 2: `beschreibung`-Textarea ersetzen**

Suche:
```typescript
          <textarea
            placeholder="Beschreibung (optional)"
            value={beschreibung}
            onChange={e => setBeschreibung(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
```
Ersetze durch:
```typescript
          <RichTextEditor
            value={beschreibung}
            onChange={setBeschreibung}
            placeholder="Beschreibung (optional)"
            rows={3}
          />
```

- [ ] **Step 3: `frage_text`-Input ersetzen**

Suche:
```typescript
                <input
                  placeholder="Fragetext"
                  value={frage.frage_text}
                  onChange={e => updateFrage(frage.tempId, { frage_text: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
```
Ersetze durch:
```typescript
                <RichTextEditor
                  value={frage.frage_text}
                  onChange={v => updateFrage(frage.tempId, { frage_text: v })}
                  placeholder="Fragetext"
                  rows={2}
                  compact
                />
```

- [ ] **Step 4: Build prüfen und manuell testen**

```
npm run build 2>&1 | head -30
```

Im Browser: Neue Umfrage anlegen → Beschreibung mit `[Link](https://example.com)` eingeben → Link erscheint in UmfrageCard klickbar.

- [ ] **Step 5: Commit**

```
git add src/components/umfrage/UmfrageErstellen.tsx
git commit -m "feat: RichTextEditor für Beschreibung und Fragetexte in UmfrageErstellen"
```

---

## Task 8: `RichTextEditor` in `UmfrageBearbeiten`

**Files:**
- Modify: `src/components/umfrage/UmfrageBearbeiten.tsx`

- [ ] **Step 1: Imports aktualisieren**

Suche:
```typescript
import { useForm } from 'react-hook-form'
```
Ersetze durch:
```typescript
import { useForm, Controller } from 'react-hook-form'
import { RichTextEditor } from '@/lib/richText'
```

- [ ] **Step 2: `control` aus `useForm` extrahieren**

Suche:
```typescript
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
```
Ersetze durch:
```typescript
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
```

- [ ] **Step 3: Beschreibungs-Textarea durch `Controller` + `RichTextEditor` ersetzen**

Suche den gesamten beschreibung-Block:
```typescript
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
```
Ersetze durch:
```typescript
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </p>
            <Controller
              name="beschreibung"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Beschreibung (optional)"
                  rows={4}
                  compact
                />
              )}
            />
            {errors.beschreibung && (
              <p role="alert" className="text-red-500 text-xs mt-1">{errors.beschreibung.message}</p>
            )}
          </div>
```

- [ ] **Step 4: Build prüfen und manuell testen**

```
npm run build 2>&1 | head -30
```

Im Browser: Bestehende Umfrage bearbeiten → Beschreibung mit Link tragen → Speichern → Link erscheint klickbar in UmfrageCard.

- [ ] **Step 5: Commit**

```
git add src/components/umfrage/UmfrageBearbeiten.tsx
git commit -m "feat: RichTextEditor für Beschreibung in UmfrageBearbeiten"
```

---

## Task 9: `RichTextEditor` in `BuergermeisterClient`

**Files:**
- Modify: `src/app/(app)/buergermeister/BuergermeisterClient.tsx`

- [ ] **Step 1: Import erweitern**

Suche:
```typescript
import { renderRichText } from '@/lib/richText'
```
Ersetze durch:
```typescript
import { renderRichText, RichTextEditor } from '@/lib/richText'
```

- [ ] **Step 2: Bürger-Frage-Textarea ersetzen**

Suche:
```typescript
            <label htmlFor="frage-text" className="sr-only">Deine Frage (Pflichtfeld)</label>
            <textarea
              id="frage-text"
              placeholder="Was möchtest du wissen?"
              value={frageText}
              onChange={e => setFrageText(e.target.value)}
              rows={4}
              required
              aria-required="true"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
```
Ersetze durch:
```typescript
            <RichTextEditor
              value={frageText}
              onChange={setFrageText}
              placeholder="Was möchtest du wissen?"
              rows={4}
            />
```

- [ ] **Step 3: Antwort-Textarea in `AnswerForm` ersetzen**

Suche:
```typescript
      <textarea
        placeholder="Antwort der Verwaltung …"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
```
Ersetze durch:
```typescript
      <RichTextEditor
        value={text}
        onChange={setText}
        placeholder="Antwort der Verwaltung …"
        rows={3}
        compact
      />
```

- [ ] **Step 4: Alle Tests und Build**

```
npm run test
npm run build 2>&1 | head -30
```
Erwartetes Ergebnis: Alle Tests grün, Build erfolgreich.

- [ ] **Step 5: End-to-End-Test im Browser**

Sicherstellen dass folgende Flows funktionieren:
- Bürger stellt Frage mit `[Hier klicken](https://beispiel.de)` → Link klickbar in der Fragen-Ansicht
- Verwaltung beantwortet Frage mit Link → Link klickbar in der Antwort
- Post-Formulare (PostErstellenButton, VereinPostForm, GewerbePostForm) zeigen automatisch den Link-Button — kein Code-Change nötig, da diese bereits `RichTextEditor` verwenden

- [ ] **Step 6: Commit**

```
git add src/app/(app)/buergermeister/BuergermeisterClient.tsx
git commit -m "feat: RichTextEditor für Bürger-Frage und Verwaltungs-Antwort"
```
