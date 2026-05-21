# Barrierefreiheits-Audit Dorfly Bürger-Interface

Erstellt: 2026-05-21. Geprüfte Version: HEAD master.
Grundlage: WCAG 2.2 Level AA, BITV 2.0, EN 301 549, DSA-Mindestpflichten für nutzergenerierte Inhalte.

---

## Zusammenfassung

### Geprüfte Routen und Komponenten

24 Routen und Seiten, 16 Shared Components:

**Auth-Bereich:**
- `/login` (Login, Registrierung, Passwort-vergessen in einem Multi-Mode-Formular)
- `/passwort-zuruecksetzen`
- `/auth/callback` (Route Handler, kein UI)

**App-Bereich (authentifiziert):**
- `/home` (Kachel-Dashboard)
- `/feed` (Newsfeed)
- `/buergermeister` (Frag den Bürgermeister)
- `/gemeinderat` (Gemeinderat-Lese-Ansicht)
- `/umfragen` (Bürgerbeteiligung)
- `/maengel` (Mängelmelder)
- `/lokale-angebote`, `/lokale-angebote/[id]`
- `/vereine`, `/vereine/[id]`
- `/abfallkalender`, `/abfallkalender/einstellungen`
- `/veranstaltungen`
- `/marktplatz`
- `/profil`
- `/profil/datenschutz-daten`, `.../meine-daten`, `.../konto-loeschen`

**Globale Seiten:**
- `/posts/[id]` (öffentlicher Post-Permalink)
- `/datenschutz`, `/impressum`

**Shared Components:**
`BottomNav`, `PageHeader`, `PushNotificationInit`, `GalleryLightbox`, `ShareButton`, `UmfrageCard`, `FeedCard`, `FeedFilter`, `MangelMeldenForm`, `MangelKarte`, `Button`, `EmptyState`, `Badge`, `Card`

### Konformitätseinschätzung

**Nicht konform (SC-Verletzungen in mehreren Kernbereichen)**

Einzelne Elemente erfüllen WCAG-AA-Anforderungen (lang-Attribut, semantische `<main>`, focus-visible auf Button-Komponente, alt-Text auf Beitragsbildern). Der Gesamtzustand ist jedoch nicht konform. Besonders kritisch: fehlende Labels auf allen Formularfeldern, kein Skip-Link, kein Fokus-Trap in Modals, gesperrter User-Zoom und fehlende ARIA-Semantik auf Tabs, Dialogen und interaktiven Widgets.

### Top 5 kritische Befunde

1. **Kein Label auf keinem Formularfeld** (Login, Mängelmelder, Frag-Formular, Suche, Passwort-Änderung). Betrifft SC 1.3.1 und SC 3.3.2. Screenreader lesen nur den placeholder vor, der bei Eingabe verschwindet.

2. **`maximumScale: 1` sperrt User-Zoom** in `app/layout.tsx` Zeile 38. Verletzt SC 1.4.4. Nutzer mit Sehbeeinträchtigung können die App nicht vergrößern.

3. **Kein Skip-Link** vorhanden. Tastaturnutzer müssen auf jeder Seite die gesamte BottomNav und den Header durchtabben bevor sie zum Inhalt kommen. Verletzt SC 2.4.1.

4. **Kein Fokus-Trap in Modals** (FeedFilter, MangelMeldenForm, GalleryLightbox, Frage-Modal in GemeinderatClient). Tastaturnutzer können das Modal mit Tab verlassen ohne es zu schließen. Verletzt SC 2.1.2.

5. **`div onClick` statt interaktives Element** an mehreren Stellen. Betroffen: "Mehr lesen" in FeedCard (Zeile 147), Bild-Klick für Galerie in FeedCard (Zeile 105), Text-Expand in GemeinderatClient (Zeile 158). Verletzt SC 2.1.1.

---

## Befunde nach Kriterium

### a) Semantische Struktur

**`src/app/layout.tsx`**
- Kein Skip-Link vorhanden. SC 2.4.1.

**`src/app/(app)/layout.tsx`**
- `<main>` vorhanden (Zeile 29) ✓
- Keine semantischen `<header>`- oder `<footer>`-Wrapper um BottomNav. Funktioniert, da BottomNav selbst `<nav>` ist.

**`src/app/(app)/home/page.tsx`**
- Kacheln sind `<Link>`-Elemente in einem `<div>` statt einer `<ul>`. Kachelgitter würde semantisch von `<ul role="list">` profitieren. SC 1.3.1.
- H1 "Guten Morgen, {vorname}!" ist vorhanden ✓.

**`src/components/layout/BottomNav.tsx`**
- `<nav>` vorhanden ✓.
- Home-Link hat kein Text-Label (nur Grid2x2-Icon ohne `aria-label`). SC 1.3.1, SC 4.1.2.

**Tab-Widgets** (BuergermeisterClient Zeile 85, GemeinderatClient Zeile 107, Login Zeile 198, UmfrageCard Zeile 115):
- Alle Tabs sind plain `<button>`-Elemente ohne `role="tablist"`, `role="tab"`, `aria-selected` und `aria-controls`. SC 4.1.2.

**Modal-Overlays** (FeedFilter, MangelMeldenForm, GalleryLightbox, Frage-Modal GemeinderatClient):
- Kein `role="dialog"` oder `role="alertdialog"`. Kein `aria-modal="true"`. Kein `aria-labelledby`. SC 4.1.2.

**`src/app/(app)/gemeinderat/GemeinderatClient.tsx` Zeile 158:**
- Inhalt-Expand via `<div onClick>` statt Button. SC 2.1.1.

**`src/features/feed/FeedCard.tsx` Zeile 147:**
- "Mehr lesen"-Bereich als `<div onClick>` statt `<button>`. SC 2.1.1.

**`src/features/feed/FeedCard.tsx` Zeile 105:**
- Bild-Wrapper als `<div onClick>` ohne Tastatur-Trigger für Lightbox. SC 2.1.1.

---

### b) ARIA und Labels

**`src/app/(auth)/login/page.tsx`**
- Zeile 213: E-Mail-Input ohne `<label>` oder `aria-label`. SC 1.3.1, 3.3.2.
- Zeile 221: Passwort-Input ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 246, 252: Vorname/Nachname-Inputs ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 265, 281: Fehlermeldung nicht via `aria-describedby` mit den Eingabefeldern verknüpft. SC 3.3.1.
- Zeile 198: Tab-Buttons ohne `aria-selected`. SC 4.1.2.
- Icons (ArrowRight, Loader2, Mail, ChevronDown) ohne `aria-hidden`. SC 1.3.3.

**`src/features/maengel/MangelMeldenForm.tsx`**
- Zeile 111: Titel-Input ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 118: Beschreibung-Textarea ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 125: Adresse-Input ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 104: Close-Button nur `<X>`-Icon ohne `aria-label`. SC 4.1.2.
- Kein `aria-live`-Bereich für Erfolg/Fehler-Feedback. SC 4.1.3.

**`src/app/(app)/buergermeister/BuergermeisterClient.tsx`**
- Zeile 118: Textarea ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 85: Tab-Buttons ohne `aria-selected`. SC 4.1.2.
- Zeile 185: Akkordeon-Button ohne `aria-expanded`. SC 4.1.2.
- Icons (Globe, Lock, ChevronDown, ChevronUp) ohne `aria-hidden`. SC 1.3.3.

**`src/app/(app)/gemeinderat/GemeinderatClient.tsx`**
- Zeile 326: Textarea im Frage-Modal ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 313: Close-Button im Modal ohne `aria-label`. SC 4.1.2.
- Zeile 107: Tab-Buttons ohne `aria-selected`. SC 4.1.2.
- Zeile 197: Akkordeon-Button ohne `aria-expanded`. SC 4.1.2.
- Icons (MessageCircle, Send) ohne `aria-hidden` in Buttons mit Text-Label. SC 1.3.3.

**`src/app/(app)/profil/ProfilClient.tsx`**
- Zeile 207: "Neues Passwort"-Input ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 215: "Passwort bestätigen"-Input ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 210: Eye/EyeOff-Button ohne `aria-label`. SC 4.1.2.
- Zeile 222: `pwError` ohne `aria-live` oder `aria-describedby`. SC 3.3.1.
- Labels für Vorname/Nachname im Edit-Modus vorhanden ✓ (Zeile 148, 155).

**`src/components/umfrage/UmfrageCard.tsx`**
- Zeile 115: Tab-Button (Expand) ohne `aria-expanded`. SC 4.1.2.
- Zeile 173: Fehlermeldung `error` ohne `aria-live`. SC 4.1.3.
- Zeile 208: Ja/Nein-Buttons ohne `role="radio"` oder `aria-pressed`. SC 4.1.2.
- Zeile 251: Optionen ohne `role="radio/checkbox"`. SC 4.1.2.
- Unicode-Zeichen `✓ Ja` und `✗ Nein` in Button-Text: Screenreader sprechen das Symbol aus ("Häkchen"). SC 3.1.1 (keine WCAG-Verletzung, aber schlechte UX).

**`src/components/layout/BottomNav.tsx`**
- Zeile 41: Home-Link ohne `aria-label`. SC 4.1.2.
- Kein `aria-current="page"` auf dem aktiven Link. SC 4.1.2.
- Icons ohne `aria-hidden` trotz sichtbarem Text-Label. SC 1.3.3.

**`src/components/GalleryLightbox.tsx`**
- Zeile 33: Close-Button ohne `aria-label`. SC 4.1.2.
- Zeile 41: Zurück-Button ohne `aria-label`. SC 4.1.2.
- Zeile 47: Weiter-Button ohne `aria-label`. SC 4.1.2.
- Zeile 59: Thumbnail-Buttons ohne `aria-label`. SC 4.1.2.
- Kein `aria-live` für Bildwechsel (aktuelles Bild nicht angekündigt). SC 4.1.3.

**`src/app/(app)/lokale-angebote/LokaleAngeboteClient.tsx` und `VereinListeClient.tsx`**
- Zeile 61 (lokale) / Zeile 58 (vereine): Suche-Input ohne `<label>`. SC 1.3.1, 3.3.2.
- Zeile 68 / Zeile 65: Clear-Button ohne `aria-label`. SC 4.1.2.

**`src/components/ui/PageHeader.tsx`**
- Zeile 66: Profil-Link hat `aria-label="Zum Profil"` ✓.
- User-Icon in PageHeader ohne `aria-hidden` (das aria-label ist auf dem Link, daher unkritisch, aber besser mit `aria-hidden`).

---

### c) Tastaturbedienung

**Kein Skip-Link** (Root-Layout und alle Seiten):
- Betrifft alle Bürger-Routen. SC 2.4.1.

**`src/features/feed/FeedCard.tsx`**
- Zeile 147: Inhalt-Toggle (`<div onClick>`) nicht per Tastatur erreichbar. SC 2.1.1.
- Zeile 105: Bild-Klick für Lightbox-Öffnung (`<div onClick>`) nicht per Tastatur erreichbar. SC 2.1.1.

**`src/app/(app)/gemeinderat/GemeinderatClient.tsx` Zeile 158:**
- Inline-Expand-Klick im Post-Body (`<div onClick>`) nicht per Tastatur erreichbar. SC 2.1.1.

**Fehlender Fokus-Trap in allen Modals:**
- `MangelMeldenForm`, `FeedFilter`, `GalleryLightbox`, Frage-Modal in GemeinderatClient.
- Tab verlässt das Modal, Fokus wandert in den verdunkelten Hintergrund. SC 2.1.2.
- Kein Fokus-Restore beim Schließen. SC 2.4.3.

**`src/components/ui/Button.tsx`:**
- `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2` ✓ gut.

**Inline-Buttons ohne expliziten Focus-Indikator:**
- Tab-Buttons in Login, BuergermeisterClient, GemeinderatClient, UmfrageCard: nutzen nur den Browser-Default (der durch CSS-Reset/Tailwind ggf. entfernt wird). SC 2.4.7.
- FAB (Mängelmelder): kein `focus-visible`-Ring. SC 2.4.7.

**Logische Tab-Reihenfolge:**
- Sticky Header + Sticky Filter-Bar: können durch Tab-Reihenfolge unlogisch sein wenn visuell überlappt. Zu verifizieren.

---

### d) Visuelle Anforderungen

**`src/app/layout.tsx` Zeile 38:**
- `maximumScale: 1` sperrt User-Zoom. Klare Verletzung SC 1.4.4.

**Kontraste (Schätzungen, formale Messung steht aus):**

| Fundstelle | Element | Farbpaar | Geschätztes Verhältnis | SC |
|---|---|---|---|---|
| `PageHeader.tsx` Z.58 | Untertitel `text-white/60` auf primary-500 | rgba(255,255,255,0.6) auf #0f2d6b | ~4.3:1 | SC 1.4.3 FAIL |
| `GemeinderatClient.tsx` Z.113 | Tab `text-white/75` auf primary-500 | rgba(255,255,255,0.75) auf #0f2d6b | ~5.5:1 | SC 1.4.3 OK |
| `GemeinderatClient.tsx` Z.113 | Inaktiver Tab `bg-white/15 text-white/75` | rgba(255,255,255,0.75) auf rgba(255,255,255,0.15) über #0f2d6b | ~4.0:1 | SC 1.4.3 FAIL |
| `home/page.tsx` Z.57 | `text-white/60` auf primary-500 | wie PageHeader | ~4.3:1 | SC 1.4.3 FAIL |
| `home/page.tsx` Z.74 | `text-white/55` auf primary-500 | rgba(255,255,255,0.55) auf #0f2d6b | ~3.8:1 | SC 1.4.3 FAIL |
| Viele Stellen | `text-gray-400` auf weißem Hintergrund | #9ca3af auf #fff | ~2.9:1 | SC 1.4.3 FAIL |
| `AbfallkalenderClient.tsx` Z.65 | `text-primary-200` auf primary-500 | sehr helles Blau auf Dunkelblau | <3:1 | SC 1.4.3 FAIL |
| `BottomNav.tsx` | Inaktive Links `text-[#64748b]` auf weiß | #64748b auf #fff | ~4.6:1 | SC 1.4.3 OK |

Hinweis: `text-gray-400` (`#9ca3af` auf Weiß = 2.9:1) kommt an sehr vielen Stellen vor (Timestamps, Metadaten, Platzhalter, Beschriftungen). Das betrifft jeden einzelnen Zeitstempel in FeedCard, MangelKarte, BuergermeisterClient usw.

**Touch-Targets:**
- `w-8 h-8` (32×32 px): Profil-Links in PageHeader, BottomNav, viele Header-Icons. WCAG 2.2 SC 2.5.8 Minimum 24×24 px ist formal erfüllt. Empfohlene 44×44 px nicht erfüllt.
- Back-Chevron (`ChevronLeft`) in AbfallkalenderClient Zeile 63 und KalenderClient Zeile 83: ist ein `<Link>` mit nur Icon-Größe, kein expliziter Padding. SC 2.5.8 Mindestgröße je nach Rendering.

**prefers-reduced-motion:**
- Keine Bedingung für `animate-spin` (Loader2-Spinner in Buttons und Forms). SC 2.3.3 (AAA, aber Best Practice bei AA).
- Keine `motion-reduce:` Tailwind-Varianten auf Transitions.

**Zoom bei 200%:**
- `maximumScale: 1` verhindert User-Zoom. Nicht testbar ohne Codeänderung. SC 1.4.4.

---

### e) Forms und Validierung

**Login (`src/app/(auth)/login/page.tsx`):**
- Kein `<form>`-Element. Formular wird per `onClick` abgesendet, kein Enter-Submit für Screenreader möglich (außer der manuell verdrahtete Enter-Handler auf dem Passwort-Input, Zeile 227). SC 3.3.1.
- Kein `autocomplete` auf E-Mail-Input (sollte `autocomplete="email"`). SC 1.3.5.
- Kein `autocomplete` auf Passwort-Input (sollte `autocomplete="current-password"` / `"new-password"`). SC 1.3.5.
- Kein `autocomplete` auf Vorname/Nachname (sollte `given-name`/`family-name`). SC 1.3.5.
- Kein `required`-Attribut auf Pflichtfeldern. SC 3.3.2.
- Fehlermeldungen nicht via `aria-describedby` verknüpft. SC 3.3.1.
- Nach fehlgeschlagenem Submit kein Fokus-Routing zur Fehlermeldung. SC 3.3.1.

**MangelMeldenForm (`src/features/maengel/MangelMeldenForm.tsx`):**
- Kein `required` auf Titelfeld (obwohl Pflichtfeld: `if (!form.titel) return`). SC 3.3.2.
- Fehler via `toast.error()`: Toast-Bibliothek (Sonner) rendert außerhalb des DOM-Flusses. Prüfen ob `aria-live` korrekt gesetzt ist. Sonner nutzt `role="status"` intern, das ist akzeptabel. Aber Inline-Validierungsfehler fehlen. SC 3.3.1.

**BuergermeisterClient (`src/app/(app)/buergermeister/BuergermeisterClient.tsx`):**
- Zeile 57: `if (error)` rendert `<p className="text-red-500">` ohne `aria-live`. SC 4.1.3.

**UmfrageCard:**
- Zeile 57: Validierungsfehler `error` als `<p className="text-red-500">` ohne `aria-live` oder `aria-describedby`. SC 4.1.3.

**Profil Edit-Modus:**
- Vorname/Nachname haben sichtbare `<label>` ✓.
- Passwort-Felder ohne `<label>` und ohne `autocomplete`. SC 1.3.1, 1.3.5.

---

### f) Bilder und Medien

**FeedCard (`src/features/feed/FeedCard.tsx`) Zeile 107:**
- `alt={post.titel}` für erstes Bild ✓.
- Overlay-Zähler-Badge `{bilder.length}` innerhalb Bild: enthält `Images`-Icon ohne `aria-hidden`, Zeile 109.

**GalleryLightbox (`src/components/GalleryLightbox.tsx`) Zeile 46:**
- Hauptbild `alt=""`: im Lightbox-Kontext akzeptabel, da das Bild inhaltlich im Kontext des umgebenden Posts identifiziert wird.
- Thumbnail-Bilder `alt=""` (Zeile 63): akzeptabel als dekorativ da Thumbnail-Buttons keinen zugänglichen Namen haben (Problem unter Punkt b).

**PostPage (`src/app/posts/[id]/page.tsx`):**
- Erstes Bild `alt={post.titel}` ✓.
- Galerie-Thumbnails `alt=""` (Zeile 128): Für eine öffentliche Seite, die als alleinige Inhaltsseite dient, sollte zumindest ein aussagekräftiger Alt-Text vorhanden sein. SC 1.1.1.

**MangelMeldenForm:**
- **Kein Alt-Text-Eingabefeld** für das hochgeladene Foto. Für die Verwaltung ist das Foto inhaltlich entscheidend. Wenn ein blinder Nutzer einen Schaden meldet, kann die Verwaltung das Foto nicht ohne Beschreibung verstehen. SC 1.1.1 (nutzergenerierter Inhalt).

**MangelKarte (`src/features/maengel/MangelKarte.tsx`) Zeile 31:**
- `alt={m.titel}` ✓. Titel als Bildbeschreibung ist ausreichend für eine Statusansicht.

**Dekorative Icons in Buttons:**
- Lucide-Icons in Buttons, die auch Text-Label haben (z.B. "Absenden", "GPS-Standort erfassen"), fehlt `aria-hidden` auf dem Icon. Screenreader lesen Icon-Name + Button-Text. Beispiele überall.

---

### g) Feature-spezifische Prüfungen

**Mängelmelder:**
- GPS-Alternative: Adressfeld (`src/features/maengel/MangelMeldenForm.tsx` Zeile 125) ist vorhanden ✓. Aber kein Hinweistext "oder gib eine Adresse ein". Beziehung zwischen GPS und Adressfeld ist nicht kommuniziert.
- Foto-Alternative: Foto ist optional ✓ (kein `required`, Submit ohne Foto möglich).
- Keine Schritt-für-Schritt-Struktur: alles in einem Formular. Bei Schreifelern kein Zwischenspeichern.
- Kein Hinweis auf Datenschutz bezüglich GPS-Koordinaten und Foto (öffentlich zugängliche URL).

**Galerie-Lightbox:**
- Keine Listen-Alternative für Screenreader. Bilder im Lightbox-Kontext sind für Screenreader nicht bedeutungstragend (alt=""). Akzeptabel, wenn der Posts-Kontext ausreicht.
- Kein Fokus-Trap. Kein Role="dialog".

**Push-Benachrichtigungen:**
- `PushNotificationInit.tsx`: Initialisiert OneSignal im Hintergrund. Kein User-Dialog durch Dorfly selbst. Der Browser-Permission-Dialog erscheint nach OneSignal.init automatisch. Kein zugänglicher Prompt-Context.
- Profil-Seite: "Aktivieren"-Button vorhanden ✓, aber kein Hinweis was aktiviert wird bevor der Browser-Dialog erscheint.
- Zustand "denied" kommuniziert nur Text, kein Schritt-für-Schritt-Anleitung für Browser-Einstellungen.

**PWA-Install-Prompt:**
- Kein eigener Dorfly-Install-Prompt im Code. Browser-Standard-Prompt. Nicht kontrollierbar bzgl. Barrierefreiheit.

**Verifizierungs-Flow:**
- Kein dedizierter Onboarding-Flow im Code. Verifizierung geschieht via Einladungs-E-Mail. Login-Seite erkennt Token und zeigt Banner ✓.
- E-Mail-Bestätigung nach Registrierung: Statusrückmeldung vorhanden (Zeile 154: "Fast geschafft!") ✓. Aber keine `aria-live`-Ankündigung.
- "Bestätigungs-E-Mail erneut senden"-Button vorhanden ✓.

---

### h) Sprache

- `lang="de"` auf `<html>` ✓ (`src/app/layout.tsx` Zeile 43).
- Keine gemischten Sprachen im UI-Text.
- Inkonsistenz Du/Sie-Form: Login-Seite ("erstelle ein Konto", "deine Gemeinde"), BuergermeisterClient ("Deine Frage"), GemeinderatClient ("du kannst ihnen direkt Fragen stellen") vs. Umfragen ("Ihre Meinung zählt"). Kein SC-Verstoß, aber schlechte UX.

---

### i) Page Titles

- Root-Layout-Titel: `'Dorfly – Deine Gemeinde. Dein Smartphone.'` (sc `src/app/layout.tsx` Zeile 20).
- Keine `generateMetadata` in den `(app)/*/page.tsx`-Dateien. Alle App-Seiten tragen denselben generischen Titel. SC 2.4.2.
- Ausnahme: `src/app/posts/[id]/page.tsx` hat dynamischen Titel ✓.
- Kein Titel-Update bei Client-seitigen Zustandswechseln (Tab-Wechsel in BuergermeisterClient, GemeinderatClient).

---

### j) DSA und nutzergenerierte Inhalte

- **Kein Melde-Mechanismus** an nutzergenerierten Inhalten:
  - FeedCard: keine Meldefunktion an Beiträgen von Vereinen und Gewerbe.
  - GemeinderatClient: keine Meldefunktion an Beiträgen.
  - UmfrageCard: kein Meldebutton.
  - BuergermeisterClient: Fragen sind öffentlich sichtbar, kein Meldebutton.
- **Keine Moderationsrichtlinien** im Bürger-Interface verlinkt oder angezeigt.
- **Kein DSA-Kontaktpunkt** (`trusted-flaggers`, Melde-Formular für Plattform-Missbrauch).

DSA Art. 16 verlangt einen niedrigschwelligen Mechanismus für alle Nutzer zum Melden rechtswidriger Inhalte. Das betrifft öffentlich sichtbare nutzergenerierte Posts.

---

### k) Pflicht-Artefakte

- **Erklärung zur Barrierefreiheit** fehlt vollständig. BITV 2.0 §12 gilt für öffentliche Stellen als Betreiber. Da Dorfly eine Plattform für kommunale Behörden anbietet, muss jede Gemeinde als Betreiber eine eigene Erklärung veröffentlichen. Dorfly sollte eine Vorlage bereitstellen.
- **Feedback-Kanal für Barrieren** fehlt. BITV 2.0 §10 schreibt einen niedrigschwelligen Rückmeldmechanismus vor.
- **DSA-Meldebutton** an nutzergenerierten Inhalten fehlt (siehe j).
- **DSA-Kontaktpunkt** für Behörden und Nutzer fehlt.

---

## Befunde nach Feature

### Login und Registrierung

- Alle Formularfelder ohne Label (5 Felder betroffen).
- Kein `<form>`-Element, Enter-Submit nur für Passwort-Feld verdrahtet.
- Kein `autocomplete` auf einem Feld.
- Fehler ohne `aria-describedby`.
- Tab-Widget (Anmelden/Registrieren) ohne ARIA-Semantik.
- E-Mail-Bestätigungs-Status ohne `aria-live`.
- **Risiko:** Nutzer mit Screenreader können sich kaum registrieren oder einloggen.

### Newsfeed

- "Mehr lesen"-Interaction via `<div onClick>` nicht tastaturzugänglich.
- Bild-Klick für Lightbox via `<div onClick>` nicht tastaturzugänglich.
- FeedFilter-Modal: kein Dialog-Rolle, kein Fokus-Trap.
- Filter-Buttons ohne `aria-pressed`.
- `text-gray-400`-Timestamps unter 3:1 Kontrast.
- Keine Meldefunktion an Beiträgen (DSA).

### Mängelmelder

- Alle 3 Formularfelder ohne Label.
- Kein Hinweis auf Zusammenhang GPS/Adresse.
- Kein Alt-Text-Feld für Meldungsfotos (wichtig für Beschreibung der Beeinträchtigung).
- MangelMeldenForm kein Dialog-Rolle, kein Fokus-Trap.
- **Risiko:** Nutzer mit Motorikeinschränkung, die GPS nicht nutzen können, haben keine klar kommunizierte Alternative.

### Frag den Bürgermeister

- Textarea ohne Label.
- Tabs ohne ARIA-Semantik.
- Error-Meldung ohne `aria-live`.
- Akkordeon ohne `aria-expanded`.
- Icons ohne `aria-hidden` in Buttons mit Text-Label.

### Bürgerbeteiligung (Umfragen)

- Abstimmungs-Optionen ohne `role="radio/checkbox"` und `aria-checked`.
- Bewertungs-Skala 1-5: semantisch unklar.
- Expand-Button ohne `aria-expanded`.
- Error ohne `aria-live`.

### Gemeinderat (Lese-Ansicht)

- Tabs ohne ARIA-Semantik.
- Frage-Modal: kein `role="dialog"`, kein Fokus-Trap, Textarea ohne Label.
- Akkordeon-Buttons ohne `aria-expanded`.
- `<div onClick>` für Text-Expand.
- Keine Meldefunktion an Beiträgen (DSA).

### Lokale Angebote und Vereine

- Suche-Inputs ohne Label.
- Clear-Button ohne `aria-label`.
- Filter-Bottom-Sheet ohne `role="dialog"`.

### Profil und Einstellungen

- Passwort-Felder ohne Label.
- Password-Toggle-Button ohne `aria-label`.
- Fehler-Meldung ohne `aria-live`.
- Push-Aktivieren ohne klare Vorab-Information.

### Navigation (global)

- Kein Skip-Link.
- Home-Link in BottomNav ohne `aria-label`.
- Kein `aria-current="page"` im aktiven Zustand.

### GalleryLightbox (global)

- Kein Dialog-Rolle, kein Fokus-Trap, kein Fokus-Restore.
- Navigations-Buttons ohne `aria-label`.
- Kein `aria-live` für Bildwechsel-Ankündigung.

---

## Fehlende Artefakte

| Artefakt | Rechtsgrundlage | Status |
|---|---|---|
| Erklärung zur Barrierefreiheit (pro Gemeinde) | BITV 2.0 §12, BGG §12b | Fehlt vollständig |
| Barrierefreiheits-Feedback-Kanal | BITV 2.0 §10 | Fehlt vollständig |
| DSA-Meldebutton an UGC-Elementen | DSA Art. 16 | Fehlt vollständig |
| DSA-Kontaktpunkt für Nutzer und Behörden | DSA Art. 11, Art. 12 | Fehlt vollständig |
| Moderationsrichtlinien für Bürger sichtbar | DSA Art. 14 | Fehlt vollständig |
