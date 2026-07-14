# Abfallkalender: Sammlungstermine von Vereinen/Organisationen

## Ausgangslage

- Der Abfallkalender (`abfalltermine`, Migration [007_abfallkalender.sql](../../../supabase/migrations/007_abfallkalender.sql)) wird ausschließlich per ICS-Import befüllt ([src/app/api/abfallkalender/import/route.ts](../../../src/app/api/abfallkalender/import/route.ts)): jeder Reimport löscht **alle** `abfalltermine`-Zeilen der Gemeinde und fügt sie neu ein. `typ` ist ein fester App-Enum (`AbfallTypSchluessel` in [src/lib/icsParser.ts](../../../src/lib/icsParser.ts)) für wiederkehrende Haushalts-Abfuhrarten (Restmüll, Biomüll, Papier, Wertstoffe) — ein anderes Konzept als einmalige, von Vereinen organisierte Sammlungen (Altpapier-, Altkleider-, Altglas-, Schrottsammlung).
- Beiträge (`posts`) unterstützen bereits die Kategorien `nachricht`/`veranstaltung`/`bekanntmachung` (`tag`-Spalte, reiner `text`, App-seitig validiert) sowie einen kompletten Vereins-Flow: [src/features/verein/VereinPostForm.tsx](../../../src/features/verein/VereinPostForm.tsx) → `POST /api/verein/post` → `status: 'pending'` → Freigabe durch die Verwaltung über [src/app/api/posts/freigeben/route.ts](../../../src/app/api/posts/freigeben/route.ts) (einziger Freigabe-Endpunkt, setzt `status` auf `published`/`rejected`).
- `posts` hat bereits eine öffentliche Lesepolicy (`create policy "Posts lesen" on posts for select using (true)`, [001_initial_schema.sql:136](../../../supabase/migrations/001_initial_schema.sql#L136)) plus explizite Grants für `anon`/`authenticated` ([012_explicit_grants.sql](../../../supabase/migrations/012_explicit_grants.sql)) — dieselbe Sichtbarkeit wie `abfalltermine`.

## Kernentscheidung: Keine Synchronisation, direkte Abfrage

Ursprünglich war eine denormalisierte Tabelle `abfallkalender_sammlungen` mit Sync-Code an mehreren Schreibpunkten (Erstellung, Freigabe, Ablehnung, Löschung) geplant. Da `posts` bereits dieselbe öffentliche Sichtbarkeit hat wie `abfalltermine`, entfällt das: Bürger-Kalender und Cron-Job fragen **direkt gegen `posts`** ab (`WHERE tag = 'sammlung' AND status = 'published'`). Löschen, Ablehnen oder (falls später möglich) Bearbeiten eines Sammlungs-Beitrags wirkt sich damit automatisch aus — es gibt keine Kopie, die aus dem Takt geraten kann.

## A. Datenmodell

Neue Migration `051_posts_sammlung_felder.sql`:

```sql
alter table public.posts
  add column if not exists sammlung_art text,
  add column if not exists sammlung_datum date,
  add column if not exists sammlung_organisator text;

alter table public.posts
  add constraint posts_sammlung_felder_check check (
    tag <> 'sammlung'
    or (
      sammlung_art in ('altpapier', 'altkleider', 'altglas', 'schrott')
      and sammlung_datum is not null
      and sammlung_organisator is not null
      and length(trim(sammlung_organisator)) > 0
    )
  );

-- Für Kalender-Abfrage (Bürger-Kalender + Cron) und Cron-Job
create index if not exists idx_posts_sammlung
  on public.posts (gemeinde_id, sammlung_datum)
  where tag = 'sammlung' and status = 'published';
```

Keine neuen Objekte über `posts` hinaus, daher keine zusätzlichen GRANTs nötig — bestehende Grants auf `public.posts` (`012_explicit_grants.sql`, `030_posts_service_role_grants.sql`) decken die drei neuen Spalten ab.

## B. Verwaltungs-Flow (Admin-Dashboard)

[PostErstellenButton.tsx](../../../src/components/dashboard/PostErstellenButton.tsx): neue Kategorie **„Sammlung“** neben Nachricht/Veranstaltung/Bekanntmachung (Zeile 13, `TAGS`-Array). Bei Auswahl erscheinen drei zusätzliche Pflichtfelder:

- **Sammlungsart** (Dropdown, fest: Altpapiersammlung / Altkleidersammlung / Altglassammlung / Schrottsammlung)
- **Datum**
- **Organisation/Verein** (Freitext — der Verein muss keinen eigenen Dorfly-Account haben)

Absenden bleibt wie bisher ein direkter `supabase.from('posts').insert(...)` aus dem Browser (kein neuer API-Endpunkt), Status weiterhin sofort `published`. Client-seitige Pflichtfeld-Prüfung (`required`) reicht als erste Hürde; der DB-CHECK-Constraint aus Abschnitt A verhindert unvollständige Datensätze zuverlässig, auch ohne volle react-hook-form/zod-Migration dieser Komponente (kein Umbau der bestehenden `useState`-Form, um den Scope nicht unnötig auszuweiten).

## C. Vereins-Flow

[VereinPostForm.tsx](../../../src/features/verein/VereinPostForm.tsx): Kategorie „Sammlung“ wird zusätzlich freigeschaltet (nur für Vereine — [GewerbePostForm.tsx](../../../src/features/gewerbe/GewerbePostForm.tsx) bleibt unverändert bei Nachricht/Bekanntmachung). Gleiche drei Zusatzfelder; **Organisation/Verein** wird mit dem eigenen `vereine.verein_name` vorbefüllt, bleibt aber editierbar (z. B. falls eine Untergruppe wie „Jugendfeuerwehr Musterdorf“ sammelt). Zod-Schema für `POST /api/verein/post` ([src/lib/validations.ts:266-288](../../../src/lib/validations.ts#L266-L288)) wird um die drei Felder ergänzt (`sammlung_art` als `z.enum(...)`, `sammlung_datum` als Datums-String, `sammlung_organisator` als nicht-leerer String), jeweils `.optional()` und nur bei `tag === 'sammlung'` per `.refine(...)` verpflichtend.

Beitrag geht wie bisher als `pending` in die bestehende Freigabe-Oberfläche — keine neue Admin-UI nötig. Freigabe/Ablehnung läuft unverändert über `POST /api/posts/freigeben`.

## D. Bürger-Kalender: Anzeige & Filter

- Serverseitige Datenladung für [AbfallkalenderClient.tsx](../../../src/app/(app)/abfallkalender/AbfallkalenderClient.tsx) lädt zusätzlich zu `abfalltermine` alle `posts` mit `gemeinde_id`, `tag = 'sammlung'`, `status = 'published'`, `sammlung_datum` im gewählten Zeitraum (Spalten: `id`, `sammlung_art`, `sammlung_datum`, `sammlung_organisator`).
- Neue `SAMMLUNG_ART_CONFIG` (analog `ABFALL_TYP_CONFIG` in `icsParser.ts`): Icon/Farbe/Label je Art. Anzeige im gruppierten Tagesblock mit Zusatzzeile „organisiert von {sammlung_organisator}“.
- Neue Filter-Chips für die vier Sammlungsarten, gleiches Pill-Muster wie die bestehenden Typ-Filter — Filterung ausschließlich nach Art (nicht nach Organisator, wie besprochen).

## E. Benachrichtigungen (Cron)

[src/app/api/cron/abfall-benachrichtigungen/route.ts](../../../src/app/api/cron/abfall-benachrichtigungen/route.ts) wird erweitert:

- `abfallkalender_praeferenzen.ausgewaehlte_typen` bekommt vier neue mögliche Werte (`sammlung_altpapier`, `sammlung_altkleider`, `sammlung_altglas`, `sammlung_schrott`). Bestehende Einstellungs-UI (Präferenzen-Route/Komponente) bekommt vier zusätzliche Checkboxen neben den heutigen Abfuhr-Typen.
- Der Cron lädt zusätzlich `posts` mit `sammlung_datum = morgen`, `status = 'published'`, `tag = 'sammlung'` (nutzt den neuen Index aus Abschnitt A), gleicht das gegen `ausgewaehlte_typen` ab wie bei den bestehenden Abfuhr-Typen.
- Push-/E-Mail-Text für Sammlungen unterscheidet sich vom Abfuhr-Text (kein „Tonne bereitstellen“) und nennt den Organisator, z. B. „Morgen findet die Altpapiersammlung (organisiert von TSV Musterdorf) statt.“

## F. Feed-Darstellung

Keine Änderung nötig: Der Feed ([src/features/feed/FeedCard.tsx](../../../src/features/feed/FeedCard.tsx)) filtert nicht nach `tag` und zeigt jeden Post unabhängig von der Kategorie an. Ein unbekannter Tag-Wert wie `sammlung` fällt in der Badge-Anzeige automatisch auf `TAG_META.nachricht` zurück (Zeile 54) — Sammlungs-Beiträge erscheinen im Feed also automatisch mit „Nachricht“-Badge, ohne Codeänderung.

## Nicht im Scope

- Keine Uhrzeit-/Ort-Felder für Sammlungen (nur Datum)
- Keine Filterung nach Verein/Organisator im Bürger-Kalender (nur nach Art)
- Sammlungsarten fest im Code (4 Werte), nicht pro Gemeinde konfigurierbar
- Gewerbe kann keine Sammlungs-Beiträge erstellen
- Kein eigenes Feed-Badge/Layout für Sammlungen (läuft als „Nachricht“ mit)
- Keine Bearbeitung von `sammlung_art`/`sammlung_datum`/`sammlung_organisator` nach Erstellung über die generische `POST /api/posts/update`-Route (dort werden aktuell auch `veranstaltung_datum`/`veranstaltung_ort` nicht unterstützt — konsistent mit bestehendem Verhalten); Korrektur erfolgt durch Löschen + Neuanlage
