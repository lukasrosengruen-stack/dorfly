# Gemeinde-Branding: Farbschema + Wappen/Logo

## Ausgangslage

- `gemeinden.primary_color` existiert bereits in der DB (Migration `038_gemeinden_theming_columns.sql`), wird aber nirgends wirksam genutzt: [src/app/(app)/layout.tsx:20](../../../src/app/(app)/layout.tsx#L20) und das Admin-Pendant setzen eine CSS-Variable `--color-primary`, die keine Utility-Klasse referenziert.
- Die tatsächlich verwendeten Farben (`primary-50…900`, `gold-50…900`, `accent-*`) sind in [src/app/globals.css](../../../src/app/globals.css) als feste Hex-Werte in Tailwind v4s `@theme inline`-Block einkompiliert und werden App-weit in 59 Dateien über Klassen wie `bg-primary-500`, `text-gold-500` verwendet.
- `gemeinden.logo_url` existiert seit der initialen Schema-Migration, wird aber für Gemeinden aktuell nirgends angezeigt (nur für Vereine/Gewerbe wird ein analoges `logo_url`-Feld genutzt).
- Das Verwaltungsdashboard für die Rolle `verwaltung` ist `src/app/(admin)/dashboard/page.tsx`, mit der Einstellungs-Komponente [src/components/dashboard/GemeindeEinstellungen.tsx](../../../src/components/dashboard/GemeindeEinstellungen.tsx), die über `POST /api/gemeinde/aktualisieren` speichert (nur die eigene Gemeinde, Rollen `verwaltung`/`super_admin`).
- `getGemeinde()` ([src/lib/gemeinde.ts](../../../src/lib/gemeinde.ts)) liest den Tenant per `x-gemeinde-slug`-Header (von der Middleware für praktisch alle Routen gesetzt, `react cache`d) und funktioniert daher auch im Root-Layout.

## Kernmechanismus: Laufzeit-Theming ohne 59-Datei-Umbau

Tailwind v4 löst bei `@theme inline` definierte `var(...)`-Referenzen **nicht** zur Build-Zeit auf, sondern übernimmt sie unverändert in die generierten Utility-Regeln (z. B. `.text-primary-500 { color: var(--color-primary-500) }`). Das erlaubt:

```css
/* vorher */
--color-primary-500: #0f2d6b;

/* nachher */
--color-primary-500: var(--gemeinde-primary-500, #0f2d6b);
```

Wird `--gemeinde-primary-500` (und die übrigen Primary-/Gold-Stufen) einmal zentral gesetzt, übernehmen alle 59 bestehenden Dateien mit `bg-primary-500`, `text-gold-500` usw. die Gemeinde-Farbe automatisch — ohne dass eine davon geändert werden muss.

## A. Datenmodell

Neue Migration `040_gemeinden_accent_color.sql`:

```sql
alter table gemeinden add column if not exists accent_color text default '#e8a020';
```

(`primary_color` existiert bereits mit Default `#0f2d6b`; `logo_url` existiert bereits.) Migration folgt dem CLAUDE.md-Template inkl. expliziter GRANTs für die betroffenen Rollen, auch wenn hier nur eine Spalte ergänzt wird (kein neues Objekt, aber Konsistenz mit bestehenden Grants auf `gemeinden` prüfen/dokumentieren).

## B. Runtime-Theming

1. **Farbskalen-Generator** `src/lib/colorScale.ts`: reine Funktion `generateColorScale(baseHex: string): Record<'50'|'100'|...|'900', string>`, die aus einer Basisfarbe per HSL-Lightness-Ramp eine 10-stufige Skala erzeugt (gleiches Prinzip wie Tailwinds eigene Paletten: hohe Lightness bei 50, niedrige bei 900, Hue/Saturation der Basisfarbe beibehalten).
2. **`globals.css`**: alle `--color-primary-*`- und `--color-gold-*`-Werte im `@theme inline`-Block auf `var(--gemeinde-primary-*, <bisheriger-hex>)` bzw. `var(--gemeinde-accent-*, <bisheriger-hex>)` umstellen. Die bisherigen Hex-Werte bleiben als Fallback erhalten (Default-Look, falls keine Gemeinde ermittelbar ist, z. B. Root-Domain ohne Subdomain).
3. **Injektion im Root-Layout** (`src/app/layout.tsx`, wird `async`): `getGemeinde()` aufrufen, bei vorhandenem `primary_color`/`accent_color` die Skalen berechnen und als `<style>`-Tag mit den zehn `--gemeinde-primary-*`- und zehn `--gemeinde-accent-*`-Custom-Properties ins `<html>`-Element injizieren. Ohne Gemeinde (kein Slug) keine Injektion, Fallback-Hex greift.
4. Die bisherigen (funktionslosen) `--color-primary`-Inline-Styles in `(app)/layout.tsx` und `(admin)/layout.tsx` werden entfernt (ersetzt durch den zentralen Mechanismus).

## C. Wappen/Logo

- Anzeige ausschließlich im Home-Header ([src/app/(app)/home/page.tsx:84-89](../../../src/app/(app)/home/page.tsx#L84-L89)): Wappen-Bild links neben/über dem Gemeindenamen-Text (`{gemeindeName}`). Ist kein Logo gesetzt, bleibt der heutige reine Text-Header unverändert — kein Pflichtfeld.
- Upload-Pattern analog zu `VereinProfilForm.tsx`: `supabase.storage.from('dorfly-media').upload(...)`, Pfad `gemeinden/{gemeindeId}/logo_{timestamp}.{ext}`.
- **Abweichend von `compressImage.ts`**: Diese Funktion re-encoded verlustbehaftet zu JPEG und entfernt damit Transparenz — für ein Wappen ungeeignet. Stattdessen eine schlanke Validierung ohne Neukodierung: erlaubte Typen `image/png`, `image/svg+xml`, `image/jpeg`; Client-seitiges Größenlimit (2 MB); bei Überschreitung Fehlermeldung statt automatischer Kompression.

## D. Verwaltungsdashboard-UI

Erweiterung von `GemeindeEinstellungen.tsx` um einen neuen Abschnitt „Design“:

- Zwei Farbfelder (Primary, Akzent), jeweils `input type="color"` gekoppelt mit einem Hex-Textfeld, plus Live-Vorschau-Swatch.
- **Kontrast-Check**: reine Hilfsfunktion `src/lib/contrast.ts` (`getContrastRatio(hex1, hex2): number`, WCAG-Relative-Luminanz-Formel). Für Primary und Akzent wird der Kontrast gegen Weiß berechnet; bei < 4.5:1 erscheint ein nicht-blockierender Warnhinweis (`role="alert"`, Text z. B. „Kontrast zu Weiß ist niedrig – heller Text auf dieser Farbe könnte schwer lesbar sein“). Speichern bleibt trotzdem möglich.
- Logo-Upload-UI analog `VereinProfilForm.tsx` (Vorschau-Bild oder Platzhalter mit Gemeinde-Initiale, Datei-Button „Bild auswählen“, Ladezustand).

**API-Erweiterung:**

- `gemeindeAktualisierenSchema` (`src/lib/validations.ts`) um `primary_color`, `accent_color`, `logo_url` ergänzen (Hex-Format-Validierung per Regex `^#[0-9a-fA-F]{6}$` für die Farben, URL-Validierung für `logo_url` analog bestehender Felder).
- `POST /api/gemeinde/aktualisieren` (`src/app/api/gemeinde/aktualisieren/route.ts`) übernimmt die drei neuen Felder ins `update(...)`. Bestehende Berechtigungsprüfung (nur eigene `gemeinde_id`, Rollen `verwaltung`/`super_admin`) bleibt unverändert.

## E. Tests

- Vitest-Unit-Tests für `generateColorScale` (u. a.: 500-Stufe liegt nahe an der Eingabefarbe, Skala ist monoton heller→dunkler von 50→900) und `getContrastRatio` (bekannte Referenzwerte, z. B. Schwarz/Weiß = 21:1).

## Nicht im Scope

- Keine Änderungen an Login-/Start-Seite oder Admin-Dashboard-Header (nur Home-Header zeigt das Logo, siehe Entscheidung im Brainstorming).
- Keine vordefinierte Farbpalette — freie Farbwahl per nativem Color-Picker.
- Kein Blockieren des Speicherns bei niedrigem Kontrast — nur Warnhinweis.
