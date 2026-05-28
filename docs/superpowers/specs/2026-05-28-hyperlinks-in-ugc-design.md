# Design: Hyperlinks in nutzergenerierten Inhalten

**Datum:** 2026-05-28  
**Status:** Genehmigt  
**Scope:** Alle Fließtext-Felder in Dorfly (Posts, Umfragen, Bürgermeister-Fragen/-Antworten)

---

## Zusammenfassung

Nutzer aller Rollen (Gemeinde, Verein, Gewerbe, Gemeinderat, Organisation) sollen in Fließtext-Feldern Hyperlinks einfügen können — entweder als benannten Link mit eigenem Anzeigetext oder als nackte URL die automatisch erkannt wird. Kein neues Paket. Erweiterung des bestehenden `richText.tsx`-Systems.

---

## Speicherformat

Kein Datenbankschema-Change. Alle betroffenen Felder sind bereits `text`. Das Speicherformat bleibt Plain-Text-Markdown — rückwärtskompatibel.

| Syntax | Bedeutung |
|---|---|
| `[Anzeigetext](https://example.com)` | Benannter Link (neu) |
| `https://example.com` | Nackte URL — wird auto-linkifiziert (neu) |
| `**fett**` | Bold (bereits vorhanden) |

Bestehende Inhalte in der Datenbank sind unberührt. Felder ohne Link-Syntax rendern weiterhin als Plain-Text.

---

## Renderer (`renderRichText`)

**Datei:** `src/lib/richText.tsx`

Die Funktion `renderRichText(text: string)` wird um Link-Parsing erweitert. Parsing-Reihenfolge (wichtig für korrekte Regex-Anwendung):

1. HTML-Escaping (bereits vorhanden, läuft zuerst — XSS-Schutz)
2. Benannte Links `[text](url)` → `<a>`
3. Auto-Linkify — nackte `https://`, `http://`, `www.` URLs → `<a>`
4. Bold `**text**` → `<strong>` (bereits vorhanden)
5. Zeilenumbrüche → `<br>` (bereits vorhanden)

**Sicherheit:** Vor jedem Link-Render wird die URL geprüft. Erlaubt: `http://` und `https://`. Geblockt: `javascript:`, `data:`, `vbscript:`, relative Pfade und alles andere — diese werden als Plain-Text ausgegeben, nicht als `<a>`.

**Alle `<a>`-Tags** erhalten `target="_blank"` und `rel="noopener noreferrer"`.

### Neu eingebunden in

| Datei | Bisher | Nach Änderung |
|---|---|---|
| `src/features/feed/FeedCard.tsx` | `renderRichText()` ✓ | unverändert |
| `src/components/umfrage/UmfrageCard.tsx` | Plain-Text (`whitespace-pre-wrap`) | `renderRichText()` für `beschreibung` + `frage_text` |
| `src/app/(app)/buergermeister/BuergermeisterClient.tsx` | Plain-Text | `renderRichText()` für `frage` + `antwort` |

---

## Editor (`RichTextEditor`)

**Datei:** `src/lib/richText.tsx`

### Neuer Link-Button in der Toolbar

Neben dem bestehenden Bold-Button erscheint ein Link-Button mit:
- `aria-label="Link einfügen"`
- Link-Icon mit `aria-hidden="true"`

### Klick-Verhalten

**Fall 1 — Text markiert:**  
Ein Popup erscheint mit einem einzelnen Feld „URL". Der markierte Text wird als Anzeigetext übernommen. Bestätigung fügt `[markierter Text](https://...)` an der Cursorposition ein.

**Fall 2 — Kein Text markiert:**  
Das Popup zeigt zwei Felder: „Anzeigetext" und „URL". Bestätigung fügt `[Anzeigetext](https://...)` ein.

### Popup-Details

- Kleines Inline-Overlay direkt unter dem Toolbar-Button
- `Enter` bestätigt, `Escape` schließt ohne Einfügen
- Fokus-Trap via `useFocusTrap` aus `src/hooks/useFocusTrap.ts`
- Fokus kehrt nach Schließen zum Editor zurück
- URL-Feld zeigt Inline-Fehlermeldung (`role="alert"`) wenn keine `http://`- oder `https://`-URL eingegeben wurde
- URL-Feld validiert on-submit (nicht on-change) um Tipp-Unterbrechungen zu vermeiden

### Neue Prop

```ts
<RichTextEditor minHeight?: string />
```

Optionale `minHeight`-Prop damit der Editor in kompakten Kontexten (Fragentext, Antworten) kleiner erscheint als in der vollen Post-Erstellung. Default: bestehende Höhe.

### Kein Link-Entfernen im ersten Schritt

Nutzer können `[text](url)` manuell im Editor löschen. Ein dedizierter „Link entfernen"-Button ist nicht Bestandteil dieses Features.

---

## Deployment-Scope (Formulare)

### Bereits `RichTextEditor`

Post-Erstellungsformulare die `RichTextEditor` schon nutzen (z.B. `VereinPostForm.tsx`) erhalten den Link-Button automatisch durch die Toolbar-Erweiterung. Alle weiteren Post-Formulare (Gemeinde, Gewerbe, Gemeinderat, Organisation) müssen geprüft werden — falls sie noch `<textarea>` verwenden, werden sie ebenfalls umgestellt.

### Neu auf `RichTextEditor` umstellen

| Formular | Feld | Kontext |
|---|---|---|
| Umfrage erstellen (Admin-Dashboard) | `beschreibung` | Beschreibungsfeld der Umfrage |
| Umfrage bearbeiten (Admin-Dashboard) | `beschreibung` | Bearbeitung nach Veröffentlichung |
| Umfrage-Fragen Eingabe (Admin-Dashboard) | `frage_text` | Fragetext pro Frage |
| Bürgermeister-Fragen (Bürger-Seite) | `frage` | Bürger stellt Frage |
| Bürgermeister-Antworten (Admin) | `antwort` | Admin beantwortet Frage |

### Nicht umgestellt

Titel-Felder, Ortsangaben, E-Mail-Felder, Datum-Felder — kein Fließtext-Kontext.

---

## Accessibility (WCAG 2.2 AA)

- Link-Button: `aria-label="Link einfügen"`, Icon `aria-hidden="true"`
- Popup: Fokus-Trap (`useFocusTrap`), Fokus-Restore nach Schließen
- URL-Fehler: `role="alert"` auf Fehlermeldung
- Gerenderte `<a>`-Tags: Anzeigetext muss vom Nutzer sinnvoll befüllt werden (keine Einschränkung technisch, aber Toolbar-UI macht es natürlich)

---

## Nicht in diesem Feature

- Link-Entfernen-Button im Editor
- Vorschau-Popup beim Hover über gerenderte Links
- Einschränkung auf bestimmte Domains
- Moderation/Meldung von Links (wird durch bestehenden `ReportButton` auf Posts abgedeckt)
- Weitere Markdown-Syntax (Listen, Überschriften, etc.)
