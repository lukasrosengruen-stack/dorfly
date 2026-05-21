# Maßnahmenplan Barrierefreiheit

Erstellt: 2026-05-21. Grundlage: `ACCESSIBILITY_AUDIT.md` vom gleichen Datum.

---

## Priorisierung

- **P0:** Vor erstem öffentlichem Launch in Mötzingen
- **P1:** Vor erster zahlender Gemeinde (nach Mötzingen, vor weiterem Rollout)
- **P2:** Nice-to-have, vor Skalierung

Aufwandsschätzungen sind in Stunden für eine einzelne Entwicklerin/einen einzelnen Entwickler mit Dorfly-Kenntnissen. Sie enthalten Recherche, Implementierung und manuelle Überprüfung, aber keine automatisierten Tests.

---

## P0-Maßnahmen

### P0.1 User-Zoom entsperren

**Was:** `maximumScale: 1` aus dem `viewport`-Export in `src/app/layout.tsx` (Zeile 38) entfernen.

**Warum:** SC 1.4.4 (Größenveränderung von Text) ist eine absolute Grundanforderung. Nutzer mit Sehbeeinträchtigung können ohne Zoom nichts lesen. Jede andere Maßnahme wird wirkungslos, solange der Zoom gesperrt ist.

**Betroffene Datei:** `src/app/layout.tsx`

**Aufwand:** 0,5 Stunden

**Abhängigkeiten:** Keine. Prüfen ob Layout bei 200% Zoom horizontal scrollt, ggf. Overflow-Fixes nachziehen.

---

### P0.2 Skip-Link einbauen

**Was:** Einen sichtbar-werdenden Skip-Link "Zum Hauptinhalt springen" als erstes focusbares Element in `src/app/layout.tsx` einfügen. Target ist das `<main>`-Element in `src/app/(app)/layout.tsx`.

**Warum:** SC 2.4.1 (Blöcke umgehen). Tastaturnutzer müssen auf jeder Seite durch BottomNav und Header navigieren, bevor sie den Inhalt erreichen.

**Betroffene Dateien:** `src/app/layout.tsx`, `src/app/(app)/layout.tsx`

**Aufwand:** 2 Stunden

**Abhängigkeiten:** Keine.

---

### P0.3 Labels auf allen Login-Formularfeldern

**Was:** Alle Inputs in `src/app/(auth)/login/page.tsx` mit korrekten `<label>`-Elementen versehen (verknüpft via `htmlFor`/`id`). Außerdem `autocomplete`-Attribute setzen (`email`, `current-password`, `new-password`, `given-name`, `family-name`). Den Wrapper von `<div>` auf `<form>` umbauen mit `onSubmit`.

**Warum:** SC 1.3.1 (Informationen und Beziehungen), SC 3.3.2 (Beschriftungen oder Anweisungen), SC 1.3.5 (Eingabezweck bestimmen). Screenreader lesen bei placeholder-only kein Label vor, da placeholder bei Eingabe verschwindet.

**Betroffene Datei:** `src/app/(auth)/login/page.tsx`

**Aufwand:** 3 Stunden

**Abhängigkeiten:** Keine.

---

### P0.4 Labels auf MangelMeldenForm

**Was:** Alle drei Inputs und die Textarea in `src/features/maengel/MangelMeldenForm.tsx` mit `<label>` versehen. Das Pflichtfeld "Titel" mit `required` und `aria-required="true"` kennzeichnen.

**Warum:** SC 1.3.1, SC 3.3.2. Der Mängelmelder ist das prominenteste Bürger-Feature.

**Betroffene Datei:** `src/features/maengel/MangelMeldenForm.tsx`

**Aufwand:** 2 Stunden

**Abhängigkeiten:** Keine.

---

### P0.5 `aria-label` auf alle Icon-Only-Buttons

**Was:** Folgende Buttons haben keinen zugänglichen Text und benötigen `aria-label`:

| Datei | Zeile | Element | Vorgeschlagenes Label |
|---|---|---|---|
| `FeedFilter.tsx` | 67 | Close-Button `<X>` | "Filter schließen" |
| `MangelMeldenForm.tsx` | 104 | Close-Button `<X>` | "Formular schließen" |
| `GemeinderatClient.tsx` | 313 | Close-Button `<X>` | "Frage abbrechen" |
| `GalleryLightbox.tsx` | 33 | Close-Button `<X>` | "Galerie schließen" |
| `GalleryLightbox.tsx` | 41 | Zurück `<ChevronLeft>` | "Vorheriges Bild" |
| `GalleryLightbox.tsx` | 47 | Weiter `<ChevronRight>` | "Nächstes Bild" |
| `GalleryLightbox.tsx` | 59 | Thumbnail `<img>` | "Bild {i+1} von {bilder.length}" |
| `BottomNav.tsx` | 41 | Home-Link `<Grid2x2>` | "Startseite" |
| `ProfilClient.tsx` | 210 | Eye/EyeOff-Toggle | "Passwort anzeigen" / "Passwort verbergen" |
| `LokaleAngeboteClient.tsx` | 68 | Clear-Button `<X>` | "Suche leeren" |
| `VereinListeClient.tsx` | 65 | Clear-Button `<X>` | "Suche leeren" |

**Warum:** SC 4.1.2 (Name, Rolle, Wert). Icon-Buttons ohne Text sind für Screenreader nicht identifizierbar.

**Betroffene Dateien:** Alle oben genannten.

**Aufwand:** 3 Stunden

**Abhängigkeiten:** Keine.

---

### P0.6 `aria-current="page"` in BottomNav

**Was:** Den aktiven Link in `src/components/layout/BottomNav.tsx` mit `aria-current="page"` markieren (Zeile 28 und 53). Analog für die Home-Link-Variante.

**Warum:** SC 4.1.2. Ohne `aria-current` weiß ein Screenreader-Nutzer nicht, auf welcher Seite er sich befindet.

**Betroffene Datei:** `src/components/layout/BottomNav.tsx`

**Aufwand:** 1 Stunde

**Abhängigkeiten:** Keine.

---

### P0.7 `div onClick` durch tastaturzugängliche Elemente ersetzen

**Was:** Drei Fundstellen, bei denen Klick-Handler auf nicht-interaktiven Elementen liegen:

1. `src/features/feed/FeedCard.tsx` Zeile 147: `<div onClick={onToggleExpand}>` auf Textbereich. Durch `<button>` ersetzen oder `tabIndex={0}` + `onKeyDown` ergänzen. Empfohlen: `<button>`.
2. `src/features/feed/FeedCard.tsx` Zeile 105: Bild-Wrapper `<div onClick>` für Lightbox-Öffnung. Durch `<button>` ersetzen.
3. `src/app/(app)/gemeinderat/GemeinderatClient.tsx` Zeile 158: Text-Expand `<div onClick>`. Durch `<button>` ersetzen.

**Warum:** SC 2.1.1 (Tastatur). Alle Funktionen müssen per Tastatur erreichbar sein.

**Betroffene Dateien:** `FeedCard.tsx`, `GemeinderatClient.tsx`

**Aufwand:** 3 Stunden

**Abhängigkeiten:** Keine.

---

### P0.8 Fehlermeldungen zugänglich verknüpfen

**Was:**
- `src/app/(auth)/login/page.tsx` Zeile 265-282: Fehlermeldung mit `role="alert"` oder `aria-live="assertive"` versehen. Felder mit `aria-describedby` auf die Fehlermeldungs-ID verlinken.
- `src/app/(app)/buergermeister/BuergermeisterClient.tsx` Zeile 57: `<p>` mit `role="alert"` versehen.
- `src/components/umfrage/UmfrageCard.tsx` Zeile 173: `<p>` mit `role="alert"` versehen.
- `src/app/(app)/profil/ProfilClient.tsx` Zeile 222: `pwError`-Absatz mit `role="alert"` und `aria-describedby` auf den Passwort-Input verlinken.

**Warum:** SC 3.3.1 (Fehlererkennung), SC 4.1.3 (Statusmeldungen). Screenreader erhalten sonst keine Rückmeldung bei Validierungsfehlern.

**Betroffene Dateien:** `login/page.tsx`, `BuergermeisterClient.tsx`, `UmfrageCard.tsx`, `ProfilClient.tsx`

**Aufwand:** 3 Stunden

**Abhängigkeiten:** Keine.

---

## P1-Maßnahmen

### P1.1 Fokus-Management in Modals (Trap und Restore)

**Was:** Einen wiederverwendbaren `useFocusTrap`-Hook implementieren und auf alle vier Modal-Typen anwenden: `MangelMeldenForm`, `FeedFilter`, `GalleryLightbox`, Frage-Modal in `GemeinderatClient`. Der Hook muss:
- Fokus beim Öffnen auf das erste interaktive Element setzen (oder auf den Dialog-Container mit `tabIndex={-1}`).
- Tab/Shift-Tab innerhalb des Modals halten.
- Fokus beim Schließen auf das auslösende Element zurückgeben.

Außerdem auf alle Modals `role="dialog"`, `aria-modal="true"` und `aria-labelledby` (auf die Überschrift) setzen.

**Warum:** SC 2.1.2 (Keine Tastaturfalle), SC 2.4.3 (Fokusreihenfolge). Ohne Trap verlassen Tastaturnutzer das Modal unbeabsichtigt. Ohne Restore verlieren sie ihren Kontext.

**Betroffene Dateien:** `MangelMeldenForm.tsx`, `FeedFilter.tsx`, `GalleryLightbox.tsx`, `GemeinderatClient.tsx`. Neuer Hook z.B. `src/hooks/useFocusTrap.ts`.

**Aufwand:** 8 Stunden

**Abhängigkeiten:** Keine, aber dieser Hook sollte vor P1.3 (accessible Modal-Komponente) fertiggestellt sein.

---

### P1.2 ARIA-Semantik für Tabs

**Was:** Alle Tab-Widgets (Login, BuergermeisterClient, GemeinderatClient, UmfrageCard) mit korrekter ARIA-Semantik versehen:
- Container: `role="tablist"`.
- Einzelne Buttons: `role="tab"`, `aria-selected="true/false"`, `aria-controls="panel-id"`.
- Zugehöriger Inhaltsbereich: `role="tabpanel"`, `id`, `aria-labelledby="tab-id"`.

**Warum:** SC 4.1.2 (Name, Rolle, Wert). Ohne ARIA weiß ein Screenreader nicht, dass es sich um Tab-Navigation handelt.

**Betroffene Dateien:** `login/page.tsx`, `BuergermeisterClient.tsx`, `GemeinderatClient.tsx`, `UmfrageCard.tsx`

**Aufwand:** 5 Stunden

**Abhängigkeiten:** Keine.

---

### P1.3 Labels auf Suchfeldern

**Was:** Sucheingaben in `LokaleAngeboteClient.tsx` und `VereinListeClient.tsx` mit `<label>` oder `aria-label` versehen. Den Container mit `role="search"` markieren.

**Warum:** SC 1.3.1, SC 3.3.2. Suchfelder sind zentrales Navigations-UI für diese Features.

**Betroffene Dateien:** `LokaleAngeboteClient.tsx`, `VereinListeClient.tsx`

**Aufwand:** 2 Stunden

**Abhängigkeiten:** Keine.

---

### P1.4 Labels auf restlichen Formularfeldern

**Was:**
- `BuergermeisterClient.tsx`: Textarea "Was möchtest du wissen?" mit `<label>`.
- `GemeinderatClient.tsx` Frage-Modal: Textarea mit `<label>`.
- `ProfilClient.tsx` Passwort-Felder: `<label>` für "Neues Passwort" und "Passwort bestätigen". `autocomplete="new-password"` auf beide Felder.

**Warum:** SC 1.3.1, SC 3.3.2, SC 1.3.5.

**Betroffene Dateien:** `BuergermeisterClient.tsx`, `GemeinderatClient.tsx`, `ProfilClient.tsx`

**Aufwand:** 2 Stunden

**Abhängigkeiten:** Keine.

---

### P1.5 `aria-expanded` auf Akkordeons

**Was:** Alle Akkordeon-/Collapse-Buttons mit `aria-expanded` versehen:
- `BuergermeisterClient.tsx` Zeile 185: Fragen-Item-Button.
- `GemeinderatClient.tsx` Zeile 197: Ratsmitglied-Button.
- `UmfrageCard.tsx` Zeile 115: Expand-Button.
- `FeedCard.tsx`: "Mehr lesen"-Button (nach P0.7-Fix).

**Warum:** SC 4.1.2. Screenreader-Nutzer wissen sonst nicht, ob ein Bereich auf- oder zugeklappt ist.

**Betroffene Dateien:** Alle oben genannten.

**Aufwand:** 2 Stunden

**Abhängigkeiten:** P0.7 (FeedCard).

---

### P1.6 Abstimmungs-Widgets semantisch korrekt

**Was:** In `src/components/umfrage/UmfrageCard.tsx`:
- Ja/Nein-Buttons (Zeile 207): `role="radiogroup"` auf Container, `role="radio"` + `aria-checked` auf Buttons. Unicode `✓` und `✗` durch visuell identische, aber korrekte Darstellung ersetzen oder mit `aria-hidden` versehen und sichtbarem Text-Label ausstatten.
- Einzelauswahl-Optionen: `role="radiogroup"` + `role="radio"` + `aria-checked`.
- Mehrfachauswahl-Optionen: `role="group"` + `role="checkbox"` + `aria-checked`.
- Bewertungs-Skala 1-5: `role="radiogroup"` + `aria-label="Bewertung von 1 bis 5"`.

**Warum:** SC 4.1.2 (Name, Rolle, Wert). Ohne korrekte Semantik ist die gesamte Abstimmungs-Funktionalität für Screenreader nutzlos.

**Betroffene Datei:** `src/components/umfrage/UmfrageCard.tsx`

**Aufwand:** 4 Stunden

**Abhängigkeiten:** Keine.

---

### P1.7 Kontrast-Korrekturen für kritische Texte

**Was:** Folgende Farbpaare verletzen SC 1.4.3 und sind priorisiert zu korrigieren:

1. `text-white/60` auf `primary-500`-Hintergrund (PageHeader-Untertitel, Home-Beschreibungstext): Opazität auf mindestens 75% erhöhen oder Farbe zu `text-white/80` ändern.
2. `text-white/55` auf `primary-500` (Home-Begrüßungstext): wie oben.
3. `text-gray-400` als Texte mit informativer Funktion (Timestamps, Metadaten): Auf `text-gray-500` erhöhen (noch ca. 4.6:1). Rein dekorative gray-400-Elemente können bleiben.
4. `text-primary-200` auf `primary-500` (AbfallkalenderClient Header): Auf `text-white/80` oder `text-primary-100` anpassen.

Hinweis: `text-gray-400` kommt an sehr vielen Stellen vor. Ein globales Tailwind-Konfig-Update (`gray-400` -> `gray-500` für Text-Utility) wäre effizienter als file-by-file-Patches.

**Warum:** SC 1.4.3 (Kontrast, Minimum).

**Betroffene Dateien:** `PageHeader.tsx`, `home/page.tsx`, `AbfallkalenderClient.tsx`, und viele weitere durch globale Tailwind-Änderung.

**Aufwand:** 6 Stunden (inkl. vollständiger visueller Prüfung aller geänderten Stellen)

**Abhängigkeiten:** Keine. Visuelles Review durch Designer empfohlen.

---

### P1.8 Alt-Text-Feld im Mängelmelder

**Was:** In `MangelMeldenForm.tsx` nach der Foto-Auswahl ein optionales Eingabefeld "Bildinhalt kurz beschreiben (optional)" ergänzen. Den Wert beim Upload in der Datenbank als `foto_alt_text` speichern und in `MangelKarte.tsx` als `alt`-Text verwenden.

**Warum:** SC 1.1.1 (Nicht-Text-Inhalte). Das Foto ist inhaltstragendes Element der Meldung. Blinde Nutzer können den Schaden nicht durch das Bild beschreiben.

**Betroffene Dateien:** `MangelMeldenForm.tsx`, `MangelKarte.tsx`, Supabase-Schema (`maengel`-Tabelle neue Spalte).

**Aufwand:** 4 Stunden

**Abhängigkeiten:** Datenbankänderung (neue Migration nötig).

---

### P1.9 DSA-Meldebutton an nutzergenerierten Inhalten

**Was:** Einen kleinen "Inhalt melden"-Button (Icon + Text oder Dropdown-Option) an jedem öffentlichen Beitrag in `FeedCard.tsx`, `GemeinderatClient.tsx` (Posts), und `BuergermeisterClient.tsx` (öffentliche Fragen) ergänzen. Der Klick öffnet ein schlankes Modal mit: Kategorie (Falschinformation, Beleidigung, rechtswidrig, Sonstiges), optionalem Freitextfeld, Submit.

**Warum:** DSA Art. 16. Für alle Plattformen mit nutzergenerierten Inhalten verpflichtend, sobald die EU-Schwellenwerte greifen oder die Gemeinde als öffentliche Stelle auftritt.

**Betroffene Dateien:** `FeedCard.tsx`, `GemeinderatClient.tsx`, `BuergermeisterClient.tsx`. Neuer API-Endpunkt `src/app/api/meldung/route.ts`. Neue Supabase-Tabelle `content_reports`.

**Aufwand:** 12 Stunden

**Abhängigkeiten:** Keine. Moderationsworkflow in Verwaltungsdashboard ist separates P1-Backend-Feature.

---

### P1.10 Seitentitel pro Route

**Was:** In jeder `page.tsx` im `(app)`-Bereich eine `generateMetadata`-Funktion ergänzen oder ein `<title>`-Update via Next.js Metadata-API durchführen. Titelformat: `"{Seitenname} – {Gemeindename} | Dorfly"`.

Beispiel für `src/app/(app)/feed/page.tsx`:
```ts
export async function generateMetadata(): Promise<Metadata> {
  const gemeinde = await getGemeinde()
  return { title: `Neuigkeiten – ${gemeinde?.name ?? 'Gemeinde'} | Dorfly` }
}
```

**Warum:** SC 2.4.2 (Seite mit Titel). Jede Seite muss einen beschreibenden Titel haben.

**Betroffene Dateien:** Alle `page.tsx` im `(app)/`-Bereich (ca. 14 Dateien).

**Aufwand:** 4 Stunden

**Abhängigkeiten:** Keine.

---

### P1.11 `aria-hidden` auf dekorative Icons in Buttons mit Text-Label

**Was:** Überall wo ein Icon zusammen mit einem Text-Label in einem Button vorkommt (z.B. "GPS-Standort erfassen", "Foto aufnehmen", "Absenden", "Filtern", "Meldung abschicken"), das Icon mit `aria-hidden="true"` versehen. Dies verhindert, dass der Screenreader sowohl Icon-Namen als auch Button-Text vorliest.

**Warum:** SC 1.3.3 (Sensorische Merkmale). Technisch kein hartes SC-1.3.3-Thema, aber beste Praxis für sauberes AT-Erlebnis.

**Betroffene Dateien:** Betrifft viele Komponenten. Am einfachsten: Linting-Regel oder einmalige Suche nach `<Icon className=` innerhalb von `<button>` ohne `aria-hidden`.

**Aufwand:** 4 Stunden

**Abhängigkeiten:** Keine.

---

### P1.12 Barrierefreiheits-Erklärung (Vorlage)

**Was:** Eine Vorlage für die "Erklärung zur Barrierefreiheit" gemäß BITV 2.0 §12 erstellen. Die Vorlage wird von Dorfly bereitgestellt, jede Gemeinde füllt sie für ihre Subdomain aus. Inhalt: Konformitätsstatus, bekannte Ausnahmen, Kontaktweg für Feedback, Durchsetzungsverfahren.

Speicherort: `docs/accessibility/ERKLAERUNG_VORLAGE.md`.

**Warum:** BITV 2.0 §12 (Erklärung zur Barrierefreiheit) gilt für alle öffentlichen Stellen. Kommunen als Betreiber der Plattform sind verpflichtet.

**Betroffene Dateien:** Neue Datei `docs/accessibility/ERKLAERUNG_VORLAGE.md`. Frontend-Verlinkung aus der App heraus (z.B. Footer oder Profil-Seite).

**Aufwand:** 3 Stunden

**Abhängigkeiten:** P1.7 (Kontraste) sollte zuerst adressiert sein, damit die Erklärung keine zu vielen offenen kritischen Punkte enthält.

---

## P2-Maßnahmen

### P2.1 Konsistente Du/Sie-Form

**Was:** Du-Form in BuergermeisterClient, GemeinderatClient und Login auf die projektweite Konvention vereinheitlichen. Login derzeit Du-Form ("erstelle ein Konto"), App-Seiten gemischt.

**Warum:** Keine SC-Verletzung, aber Inkonsistenz verwirrt Nutzer und ist für eine Behördenplattform unprofessionell.

**Aufwand:** 2 Stunden

**Abhängigkeiten:** Entscheidung welche Form gewünscht ist.

---

### P2.2 `prefers-reduced-motion` respektieren

**Was:** Alle `animate-spin`-Klassen und Transition-Klassen (z.B. `transition-colors`) mit der Tailwind-Variante `motion-reduce:animate-none` bzw. `motion-reduce:transition-none` ergänzen. Alternativ: in `globals.css` eine `@media (prefers-reduced-motion: reduce)` Regel für alle Animationen.

**Warum:** SC 2.3.3 (Level AAA, Best Practice bei AA). Nutzer mit vestibulären Störungen können durch Animationen beeinträchtigt werden.

**Aufwand:** 2 Stunden

**Abhängigkeiten:** Keine.

---

### P2.3 `autocomplete` auf Login-Felder (nach P0.3)

P0.3 adressiert Labels. `autocomplete`-Attribute werden dort mit eingebaut. Dieser Punkt ist nach P0.3 automatisch erledigt.

---

### P2.4 GalleryLightbox: `aria-live` für Bildwechsel

**Was:** In `GalleryLightbox.tsx` eine visually-hidden `aria-live="polite"`-Region ergänzen, die bei Bildwechsel "Bild {current + 1} von {bilder.length}" ankündigt.

**Warum:** SC 4.1.3 (Statusmeldungen). Ohne Ankündigung weiß ein Screenreader-Nutzer nicht, dass das Bild gewechselt hat.

**Betroffene Datei:** `src/components/GalleryLightbox.tsx`

**Aufwand:** 2 Stunden

**Abhängigkeiten:** P0.5 (aria-label auf Navigations-Buttons).

---

### P2.5 Komfort-Einstellungen (Kontrast, Schrift, Bewegung)

**Was:** Optional im Profil einen Bereich "Darstellung" mit drei Toggles ergänzen:
- Hoher Kontrast (CSS-Variable-Swap auf Farben mit stärkerem Kontrast)
- Größere Schrift (CSS-Variable für base font size)
- Animationen reduzieren (setzt `prefers-reduced-motion` lokal nach)

**Warum:** Verbessert Nutzbarkeit für Nutzer mit Einschränkungen über den WCAG-Mindeststandard hinaus. Relevant für eine breite kommunale Zielgruppe (ältere Nutzer, Nutzer mit Einschränkungen).

**Aufwand:** 16 Stunden

**Abhängigkeiten:** P2.2 sollte zuerst implementiert sein.

---

### P2.6 Listen-Struktur auf Home-Kacheln

**Was:** Das Kachel-Grid in `src/app/(app)/home/page.tsx` (Zeile 81) von `<div className="grid">` auf `<ul role="list" className="grid">` umstellen. Jede Kachel in `<li>` wrappen.

**Warum:** SC 1.3.1. Screenreader kündigen die Anzahl der Listenelemente an, was Orientierung schafft.

**Aufwand:** 1 Stunde

**Abhängigkeiten:** Keine.

---

## Architektur-Empfehlungen

### Gemeinsame zugängliche Komponenten

Die Barrierefreiheitsprobleme entstehen zu einem großen Teil dadurch, dass UI-Muster ohne gemeinsame Abstraktion wiederholt werden (Tabs, Modals, Akkordeons). Statt jede Fundstelle einzeln zu patchen, empfiehlt sich:

1. **`<AccessibleModal>`-Komponente**: Kapselt `role="dialog"`, `aria-modal`, `aria-labelledby`, Fokus-Trap (via `useFocusTrap`), Escape-Handler, Fokus-Restore. Ersetzt `MangelMeldenForm`-Wrapper, `FeedFilter`-Wrapper, Frage-Modal in GemeinderatClient.

2. **`<TabPanel>`-Komponente**: Kapselt `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`. Ersetzt alle manuellen Tab-Implementierungen.

3. **`<FormField>`-Komponente**: Kapselt `<label>`, `<input>` (oder `<textarea>`), Fehlermeldung mit `aria-describedby` und `role="alert"`. Ersetzt alle standalone-Inputs.

4. **`<IconButton>`-Komponente**: Wie `Button.tsx`, aber mit erzwungenem `aria-label`-Prop für Icon-Only-Verwendung.

Diese vier Komponenten würden die meisten P0/P1-Maßnahmen als Nebeneffekt lösen.

---

### Skip-Link-Implementierung

```tsx
// src/app/layout.tsx – vor dem {children}
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg focus:text-primary-600 focus:font-bold"
>
  Zum Hauptinhalt springen
</a>
```

```tsx
// src/app/(app)/layout.tsx – auf dem <main>
<main id="main-content" tabIndex={-1} className="max-w-lg mx-auto pb-20">
```

---

### Fokus-Management-Hook für Modals und Route-Wechsel

```ts
// src/hooks/useFocusTrap.ts
// Nimmt eine ref auf den Container entgegen.
// Fängt Tab-Navigation innerhalb des Containers ab.
// Gibt Fokus beim Unmount auf das Element zurück, das den Fokus vor dem Mount hatte.
```

---

### Automated Testing Setup

**axe-core in Vitest:**
```ts
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)
// In jedem Component-Test: const results = await axe(container); expect(results).toHaveNoViolations()
```

**Lighthouse CI in Vercel-Pipeline:**
- `.lighthouserc.json` mit `accessibility: 90` als Mindestscore.
- Fehlschlag der Preview-Deployment bei Unterschreitung.

**Empfehlung:** axe-core-Tests als Rauchmeldung einbauen, bevor manuelle Tests beginnen. axe findet ca. 30-40 % aller WCAG-Probleme automatisch.

---

## Pflicht-Artefakte

### Erklärung zur Barrierefreiheit (Vorlage)

Zu erstellen unter `docs/accessibility/ERKLAERUNG_VORLAGE.md`. Jede Gemeinde-Subdomain braucht eine eigene Erklärung (da die Gemeinde als öffentliche Stelle der Betreiber ist). Die Vorlage sollte enthalten:

- Geltungsbereich (welche URL)
- Konformitätsstatus (teilweise konform / nicht konform mit Begründung)
- Bekannte Ausnahmen (z.B. nutzergenerierte Inhalte ohne Alt-Text-Pflicht)
- Feedback-E-Mail-Adresse
- Ombudsstelle (zuständige Aufsichtsbehörde)
- Datum der letzten Überarbeitung

### Feedback-Komponente

Einbinden als Link oder Button in der Profil-Seite ("Barrierefreiheit melden") und im Footer der `/datenschutz`/`/impressum`-Seiten. Entweder `mailto:barrierefreiheit@{gemeinde-domain}` (einfachste Lösung) oder ein einfaches Formular.

### DSA-Meldebutton-Komponente

Wiederverwendbare `<ReportButton postId={id} />` Komponente für FeedCard, GemeinderatClient und BuergermeisterClient. Öffnet ein kleines Modal mit Kategorie-Auswahl. Speichert in `content_reports`-Tabelle.

---

## Test-Empfehlungen

### Automated checks im CI

- axe-core über `jest-axe` in Vitest-Tests für alle Hauptkomponenten.
- Lighthouse CI in der Vercel-Preview-Pipeline mit Schwellenwert accessibility >= 90.

### Manuelle Tastatur-Walkthroughs pro Bürger-Feature

Vor jedem Launch folgende Punkte mit Tab/Shift-Tab/Enter/Escape durchgehen:

1. Login und Registrierung komplett.
2. Newsfeed: Beiträge lesen, Filter öffnen, schließen.
3. Mängelmelder: FAB, Formular ausfüllen, absenden, schließen.
4. Frag den Bürgermeister: Frage stellen, Formular öffnen, schließen.
5. Umfrage: Aufklappen, abstimmen, zuklappen.
6. Galerie-Lightbox: Öffnen, navigieren, schließen.

### Screenreader-Test

Mindestens zweimal pro Feature-Zyklus:
- **iOS VoiceOver + Safari**: primäre Plattform für mobile PWA.
- **Android TalkBack + Chrome**: Zweitplattform.

Testfokus: Werden Formularfelder korrekt angekündigt? Werden Fehler-Meldungen vorgelesen? Werden Statusänderungen (Tab-Wechsel, Akkordeon, Abstimmung) angekündigt?

### Externer Quick-Check vor erster zahlender Gemeinde

Beauftragung eines externen Barrierefreiheits-Experten für einen halbtägigen Quick-Check (4-6 Stunden) des Bürger-Interfaces. Fokus auf:
- BITV-Konformitätsbewertung.
- Screenreader-Test durch geschulte Tester.
- Schriftliche Kurzstellungnahme zur Einsatz in der Erklärung zur Barrierefreiheit.

Kosten: ca. 500-1.500 EUR. Zeitrahmen: 1-2 Wochen Vorlauf. Empfehlung: DIAS GmbH, BIK e.V. oder ähnliche.
