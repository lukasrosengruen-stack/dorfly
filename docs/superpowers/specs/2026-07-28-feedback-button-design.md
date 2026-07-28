# Feedback-Button (temporär, erste öffentliche Version)

## Kontext

Dorfly ist in der ersten öffentlichen Version live. Wir wollen Bürgern eine
niedrigschwellige Möglichkeit geben, direktes Feedback zu geben, ohne die App
zu verlassen. Die Funktion ist bewusst temporär gedacht (erste Version) und
soll pro Gemeinde vom Super-Admin an- und abschaltbar sein, genau wie die
bestehenden Kacheln (Umfragen, Gemeinderat, Gewerbe, Vereine, Marktplatz,
Abfallkalender).

## Ziel

Ein Feedback-Banner auf der Startseite (Home), sichtbar für alle eingeloggten
Nutzer (unabhängig von Rolle), der ein Modal mit Kontaktformular öffnet. Das
Formular sendet eine E-Mail an `hallo@dorfly.de` inklusive der Gemeinde, aus
der das Feedback stammt.

## Nicht-Ziele

- Kein Speichern des Feedback-Inhalts in einer eigenen Datenbanktabelle —
  ausschließlich E-Mail-Versand.
- Kein globaler Kill-Switch/Env-Variable — Steuerung ausschließlich über den
  bestehenden Gemeinde-Feature-Toggle im Super-Admin-Dashboard.
- Keine Admin-Übersicht über eingegangenes Feedback (landet nur im Postfach).
- Keine automatisierten Tests — manuelles Testen im Dev-Server reicht, da die
  Funktion explizit temporär ist.

## Design

### 1. Feature-Flag

`gemeinden.features` ist bereits eine schemalose `jsonb`-Spalte
(`supabase/migrations/007_abfallkalender.sql`), daher ist **keine neue
Migration** nötig.

- `src/lib/features.ts`: `GemeindeFeatures`-Type um `feedback?: boolean`
  erweitern.
- Default: `false`/`undefined` (aus) für alle bestehenden Gemeinden — muss
  pro Gemeinde manuell aktiviert werden.
- `src/app/admin/dashboard/GemeindeKonfigSlideOver.tsx`: `FEATURE_LABELS` um
  `{ key: 'feedback', label: 'Feedback' }` erweitern. Der Toggle erscheint
  dadurch automatisch in der bestehenden Liste, nutzt den bestehenden
  `updateFeature()`-Mechanismus und die bestehende
  `PATCH /api/admin/gemeinden/[id]/features`-Route (keine Änderung an der
  API-Route nötig).

### 2. Home-Banner

In `src/app/(app)/home/page.tsx`:

- Neuer Banner, gerendert wenn `isFeatureAktiv(gemeinde, 'feedback')` true
  ist — unabhängig von `profile.role` (anders als der Dashboard-Banner, der
  nur für bestimmte Rollen sichtbar ist).
- Visuell am bestehenden Dashboard-Banner orientiert (abgerundete Card,
  Icon-Kreis, Pfeil-Chip rechts, `active:scale-[0.96]`-Tap-Animation), aber
  mit eigenem Icon (`MessageSquare` aus `lucide-react`) und eigener Farbe zur
  Unterscheidung vom Dashboard-Banner.
- Text: Titel "Feedback", Untertitel z.B. "Hilf uns, Dorfly zu verbessern".
- Klick öffnet das Feedback-Modal (kein Navigations-Link).

### 3. Feedback-Modal

Neue Client-Komponente, z.B. `src/components/FeedbackModal.tsx`.

Props: `gemeindeId: string`, `gemeindeName: string`, `open: boolean`,
`onClose: () => void` — analog zum bestehenden Muster, `gemeindeId`/
`gemeindeName` werden von der Server-Page (`home/page.tsx`, die bereits
`getGemeinde()` aufruft) durchgereicht.

Barrierefreiheit (Pflicht laut CLAUDE.md-Checkliste):

- `role="dialog"`, `aria-modal="true"`
- `useFocusTrap` aus `src/hooks/useFocusTrap.ts`
- Fokus-Restore beim Schließen
- Textarea und E-Mail-Feld haben je ein `<label>` (kein Placeholder-Ersatz)
- Fehlermeldungen mit `role="alert"`

Inhalt:

1. Intro-Text (vom Nutzer vorgegeben, sinngemäß): *"Das ist die erste
   öffentliche Version von Dorfly. Wenn Ihnen etwas auffällt oder etwas
   unklar ist, können Sie hier Feedback geben. So helfen Sie dabei, Dorfly
   kontinuierlich zu verbessern."*
2. Textarea "Dein Feedback" (required, labelled)
3. Optionales Eingabefeld "Deine E-Mail (falls wir antworten sollen)"
   (type=email, labelled, optional)
4. Submit-Button + Schließen-Button

Verhalten:

- Submit → `POST /api/feedback` mit `{ message, email?, gemeindeId }`
- Erfolg → Inline-Bestätigung ("Danke für dein Feedback!"), Modal danach
  schließbar
- Fehler → Inline-Fehlermeldung (`role="alert"`, "Feedback konnte nicht
  gesendet werden, bitte versuche es erneut"), eingegebener Text bleibt
  erhalten

### 4. API-Route

Neue Route `src/app/api/feedback/route.ts`, analog zu
`src/app/api/demo/route.ts`:

- Erfordert eine eingeloggte Session (bestehender Auth-Helper, wie bei
  anderen App-internen Routen).
- Body-Validierung via `zod`: `message` (required, non-empty),
  `email` (optional, valide E-Mail-Form), `gemeindeId` (required).
- HTML-Escaping der Freitext-Felder (wie in `api/demo/route.ts`).
- Versand via `Resend` (gleiches Muster wie `src/lib/email.ts` /
  `api/demo/route.ts`):
  - `from: 'Dorfly Feedback <noreply@dorfly.de>'`
  - `to: 'hallo@dorfly.de'`
  - `replyTo`: E-Mail des Nutzers, falls angegeben
  - Betreff enthält den Gemeindenamen
  - Body enthält Feedback-Text, Gemeindename, optional die Nutzer-E-Mail
- **Kein DB-Fallback**: Schlägt der Versand fehl (oder `RESEND_API_KEY`
  fehlt), gibt die Route einen 500-Fehler zurück; das Modal zeigt die
  Retry-Fehlermeldung. Es gibt bewusst keine Tabelle, in die stattdessen
  geschrieben wird.

### 5. Testing

Manuelles Testen im Dev-Server (`npm run dev`), da die Funktion explizit
temporär ist und keine automatisierten Tests vorgesehen sind:

- Banner erscheint nur, wenn `feedback`-Flag für die Test-Gemeinde aktiv ist
- Banner ist für verschiedene Rollen sichtbar (Bürger, Verwaltung, Verein, …)
- Modal öffnet mit korrektem Gemeindenamen, Fokus-Trap funktioniert, Escape/
  Close stellt Fokus wieder her
- Leere Nachricht wird clientseitig/serverseitig abgelehnt
- Ungültiges E-Mail-Format wird abgelehnt, leeres E-Mail-Feld ist erlaubt
- Erfolgreicher Versand kommt bei `hallo@dorfly.de` an (bzw. Test-Postfach)
- Fehler beim Versand zeigt Retry-Hinweis, Text bleibt im Textfeld erhalten
- Toggle im Super-Admin-Dashboard (`GemeindeKonfigSlideOver`) schaltet den
  Banner live an/aus