# Mehrere Autoren und Verwalter pro Verein, Organisation und Gewerbe

**Datum:** 2026-11-02
**Betrifft:** neue Migration `065_mitgliedschaften.sql`, `064_konto_loeschen.sql` (Funktionen
ersetzt in 065), `src/app/api/verein/*`, `src/app/api/gewerbe/*`,
`src/app/api/verwaltung/nutzer/rolle`, `src/lib/profil-anlegen.ts`, Vereins-, Gewerbe- und
Verwaltungs-Dashboard, Feed/Kalender/Freigabe, `/konto-loeschen`, Datenschutzerklärung

## Problem

Ein Verein (`vereine`, Rollen `verein` und `organisation`) und ein Gewerbe
(`organisationen`, Rolle `gewerbe`) gehören genau einem Konto (`profile_id`).

- Es kann nur eine Person für den Verein schreiben.
- Wechselt der Verantwortliche, kann die Verwaltung den Verein nur übertragen. Dabei wird
  die alte Person still zum Bürger herabgestuft, nicht transaktional, ohne Fehlerprüfung.
  Die alten Posts behalten `author_id` und verschwinden aus dem Dashboard des Vereins,
  weil es nach `author_id` filtert.
- Löscht der Verantwortliche sein Konto, löscht `on delete cascade` den Verein samt
  Abonnements und Vereinsposts.
- Der Absendername im Feed kommt aus `profiles.verein_name` des Autors, nicht aus dem
  Verein.

Nebenbei gefundener Fehler: Die Rolle `organisation` landet je nach Weg in verschiedenen
Tabellen. Die Selbstanlage (`/api/verein/profil`) schreibt in `vereine` mit
`typ='organisation'`, das Dashboard liest dort. Rollenzuweisung und Einladung
(`/api/verwaltung/nutzer/rolle`, `profilAnlegen`) schreiben in `organisationen` mit
`typ='organisation'` — diesen Wert kennt `org_type` nicht, der Insert scheitert
ungeprüft.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Tabellen `vereine` / `organisationen` | bleiben getrennt |
| Wie viele Vereine pro Person? | **genau einer** (Verein, Organisation oder Gewerbe) |
| Wer fügt Mitglieder hinzu? | Verwalter des Vereins **und** die Gemeindeverwaltung |
| Mitgliedsrollen | `verwalter` (Profil, Mitglieder, Posts, Löschen) und `autor` (alle Posts des Vereins) |
| Person hat schon eine andere Rolle oder einen anderen Verein | Hinzufügen wird abgelehnt |
| Kontolöschung eines Mitglieds | Verein und seine Posts bleiben, `author_id` wird `null` |
| Verein löschen | Verwalter und Gemeindeverwaltung, Bestätigung durch Eintippen des Namens |
| Rolle `organisation` | lebt einheitlich in `vereine` (`typ='organisation'`) |

## Datenmodell

### Tabelle `mitgliedschaften`

```sql
create table public.mitgliedschaften (
  profile_id       uuid primary key references public.profiles(id) on delete cascade,
  verein_id        uuid references public.vereine(id) on delete cascade,
  organisation_id  uuid references public.organisationen(id) on delete cascade,
  rolle            text not null check (rolle in ('verwalter', 'autor')),
  hinzugefuegt_von uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  check (num_nonnulls(verein_id, organisation_id) = 1)
);
create index on public.mitgliedschaften (verein_id);
create index on public.mitgliedschaften (organisation_id);
```

`profile_id` als Primärschlüssel setzt „eine Person, ein Verein“ in der Datenbank durch.

### Invariante Rolle ↔ Mitgliedschaft

`profiles.role` ist `verein`, `organisation` oder `gewerbe` genau dann, wenn die Person
eine Mitgliedschaft hat. Die Rolle muss zum Ziel passen:

| Ziel | erlaubte Rolle |
|---|---|
| `vereine.typ = 'verein'` | `verein` |
| `vereine.typ = 'organisation'` | `organisation` |
| `organisationen` (Gewerbe) | `gewerbe` |

Rolle und Mitgliedschaft werden nur gemeinsam geändert, über die SQL-Funktionen unten.
Ausnahme: Eine Person mit Vereinsrolle ohne Mitgliedschaft ist erlaubt, solange sie
ihren Verein noch nicht angelegt hat (heutige Selbstanlage).

### Weitere Schemaänderungen

- `vereine.profile_id` und `organisationen.profile_id`: `drop not null`, `UNIQUE` und
  Cascade entfernen, FK auf `on delete set null`. Der Code liest die Spalten nicht mehr.
  Entfernt werden sie in einer späteren Migration.
- `posts.author_id`: `drop not null`, FK `on delete set null`.
- `einladungen`: neue Spalte `mitglied_rolle text check (mitglied_rolle in ('verwalter','autor'))`.
- `rollen_log.aktion`: Check um `mitglied_hinzugefuegt`, `mitglied_entfernt`,
  `mitglied_rolle_geaendert`, `verein_geloescht` erweitern.
- Backfill: jede bestehende `vereine.profile_id` und `organisationen.profile_id` wird
  `verwalter`. Bestandsdaten, bei denen eine Person mehreren Zielen zugeordnet ist,
  bricht die Migration mit Fehlermeldung ab (vorher per Abfrage prüfen).

### SQL-Funktionen (security definer, nur `service_role`)

Alle laufen in einer Transaktion und schreiben `rollen_log`. Wer handelt, wird als
Parameter `p_ausgefuehrt_von` übergeben; die Berechtigungsprüfung (Verwalter dieses
Vereins oder Verwaltung derselben Gemeinde) macht die Funktion selbst, damit sie nicht
von jeder Route einzeln abhängt.

| Funktion | Wirkung |
|---|---|
| `mitglied_hinzufuegen(p_profile_id, p_verein_id, p_organisation_id, p_rolle, p_ausgefuehrt_von)` | prüft: Ziel-Person ist `buerger`, in derselben Gemeinde, ohne Mitgliedschaft (sonst Fehler `P0001` mit fester Meldung). Legt Mitgliedschaft an, setzt Rolle passend zum Ziel. |
| `mitglied_entfernen(p_profile_id, p_ausgefuehrt_von)` | entfernt Mitgliedschaft, setzt Rolle `buerger`. Sperre „letzter Verwalter“, außer die Verwaltung handelt. Selbst austreten ist erlaubt. |
| `mitglied_rolle_aendern(p_profile_id, p_rolle, p_ausgefuehrt_von)` | ändert `verwalter`/`autor`. Sperre „letzter Verwalter“ wie oben. |
| `verein_loeschen(p_verein_id, p_ausgefuehrt_von)` / `organisation_loeschen(…)` | siehe „Verein löschen“ |
| `verein_dateipfade(p_verein_id)` / `organisation_dateipfade(…)` | Storage-Pfade des Vereins (nur lesend) |

`konto_loeschen` und `konto_dateipfade` werden in 065 neu definiert (siehe unten).

### RLS und Grants

- `mitgliedschaften`: RLS an. `authenticated` darf lesen, wenn die Zeile zum eigenen
  Verein/Gewerbe gehört oder die Person Verwaltung derselben Gemeinde ist. Schreiben nur
  `service_role`. Explizite GRANTs nach Projekt-Template.
- `vereine` / `organisationen`: Insert- und Update-Policies für `authenticated`
  entfallen, `insert, update, delete` wird für `authenticated` entzogen. Alle Schreibwege
  laufen über API-Routen mit Service-Client. Lesen bleibt unverändert.

## Abläufe

### Hinzufügen per E-Mail

Route `POST /api/mitglieder` (Verwalter und Verwaltung).

1. Ziel bestimmen: Für Verwalter aus der eigenen Mitgliedschaft (nie aus dem Request).
   Die Verwaltung übergibt `verein_id` oder `organisation_id`, die Route prüft die Gemeinde.
2. Profil mit dieser E-Mail in der Gemeinde suchen.
   - **Gefunden:** `mitglied_hinzufuegen`. Bei Erfolg Mail „Sie wurden als Autor/Verwalter
     für X hinzugefügt“ (bestehende `sendeRollenzuweisungEmail`). Bei anderer Rolle oder
     bestehender Mitgliedschaft: 409 mit „Diese Person ist bereits einem Verein
     zugeordnet oder hat eine andere Rolle.“
   - **Nicht gefunden:** Einladung mit `verein_id`/`org_id`, passender `rolle` und
     `mitglied_rolle`. Beim Registrieren ruft `profilAnlegen` `mitglied_hinzufuegen` auf.

### Entfernen, Rolle ändern, Verlassen

`DELETE /api/mitglieder` (`profile_id`, bei sich selbst = verlassen) und
`PATCH /api/mitglieder` (`profile_id`, `rolle`). Der Entfernte bekommt die bestehende
Mail über den Rollenentzug. Offene Einladungen zurückziehen über dieselbe Route
(`einladung_id`), nur für Einladungen dieses Vereins.

### Wechsel des Verwalters

Kein eigener Vorgang:

- **Übergabe:** Verwalter fügt Nachfolgerin als `verwalter` hinzu, entfernt sich dann
  selbst oder wird `autor`. Die Sperre verhindert, dass der Verein vorher verwalterlos wird.
- **Verwalter nicht erreichbar:** Die Verwaltung fügt die neue Person hinzu und entfernt
  die alte.
- **Verwalter löscht Konto:** Mitgliedschaft fällt weg. Gibt es keinen Verwalter mehr,
  zeigt die Verwaltung „Kein Verwalter“ an und kann einen Autor hochstufen oder eine neue
  Person hinzufügen.

### Bestehende Wege

- `/api/verwaltung/nutzer/rolle`: Transferzweig (`verein_id`/`org_id`) entfällt, ebenso
  die Felder im Schema. Neuanlage mit `organisation_name` legt Verein bzw. Gewerbe an und
  ruft `mitglied_hinzufuegen` mit `verwalter` (für `organisation` in `vereine`,
  `typ='organisation'`). Wird ein Mitglied auf `buerger` gesetzt, läuft
  `mitglied_entfernen` (Verwaltungsrecht, ohne Sperre). Ein Mitglied direkt auf eine
  andere Rolle zu setzen, wird abgelehnt: erst entfernen.
- `profilAnlegen`: neuer Name → Verein/Gewerbe anlegen und `verwalter`. Mit
  `verein_id`/`org_id` → `mitglied_hinzufuegen` mit `mitglied_rolle` (Default `autor`).
- `/api/verein/profil` POST (Selbstanlage): nur ohne bestehende Mitgliedschaft; legt Verein
  an und die Person als `verwalter`. PATCH nur für `verwalter`. Gleiches gilt für
  `/api/gewerbe/profil` und `/api/gewerbe/betrieb`.
- `/api/verein/post`, `/api/gewerbe/post`: jedes Mitglied darf Posts mit der `org_id`
  seines Vereins anlegen, bearbeiten, löschen. Prüfung über `org_id` statt `author_id`.
- Neue Hilfsfunktion `meineMitgliedschaft(client, profileId)` in
  `src/lib/mitgliedschaft.ts` liefert `{ rolle, verein_id, organisation_id } | null` und
  ersetzt die verstreuten `.eq('profile_id', …)`.

### Verein löschen

`DELETE /api/mitglieder/verein` (Verwalter: eigener Verein; Verwaltung: mit ID).

1. Dateipfade über `verein_dateipfade` holen (Logo, Ordner `vereine/<id>/` bzw.
   `gewerbe/<id>/`, Bilder aller Posts mit dieser `org_id`) und **vor** der
   Datenbanklöschung aus dem Storage entfernen. Bei Fehler abbrechen, der Verein bleibt.
2. `verein_loeschen` in einer Transaktion: Posts mit `org_id` löschen (kein FK seit 033;
   `post_termine` per Cascade), alle Mitglieder auf `buerger`, offene Einladungen zu
   diesem Verein widerrufen, `rollen_log` je Person, Verein löschen (Abonnements und
   Mitgliedschaften per Cascade).
3. Allen anderen Mitgliedern die Mail über den Rollenentzug schicken, mit dem Zusatz
   „Der Verein wurde gelöscht.“

Ablauf und Fehlerbehandlung folgen `src/lib/kontoLoeschen.ts`.

### Kontolöschung

`konto_loeschen` neu:

- Vereine und Gewerbe werden **nicht** mehr gelöscht. Die Mitgliedschaft fällt per
  Cascade weg.
- Posts mit `org_id` (Kanäle `verein`, `gewerbe`) bleiben, `author_id` wird `null`.
  Übrige eigene Posts werden wie bisher gelöscht.
- `konto_dateipfade` erfasst keine Vereins-/Gewerbelogos, keine Ordner `vereine/<id>/`
  und `gewerbe/<id>/` und keine Bilder erhaltener Vereinsposts mehr.
- `/konto-loeschen` und Datenschutzerklärung (Ziffer 7) entsprechend anpassen.

## Oberfläche

### Bereich „Team“ (Vereins- und Gewerbe-Dashboard)

Gemeinsame Komponente `src/components/dashboard/MitgliederSection.tsx`, eingebunden im
Vereins-Dashboard (`(admin)/dashboard`) und in `/gewerbe/dashboard`.

- Liste der Mitglieder (Name, E-Mail, Rolle) und offenen Einladungen.
- **Verwalter:** Formular „Person hinzufügen“ (E-Mail, Rolle; react-hook-form + zod),
  bei jedem Mitglied „Rolle ändern“ und „Entfernen“, bei Einladungen „Zurückziehen“.
- **Autoren:** Liste nur lesend.
- **Alle:** „Verein verlassen“; für den letzten Verwalter deaktiviert mit Erklärung
  „Lege zuerst eine andere Person als Verwalter fest.“
- Entfernen und Verlassen mit Bestätigung direkt am Button.
- **Gefahrenbereich (nur Verwalter):** „Verein löschen“. Zeigt Anzahl Beiträge,
  Abonnenten und Mitglieder. Aktiv erst, wenn der Vereinsname exakt eingetippt ist
  (Feld mit Label).

### Beiträge im Dashboard

Liste aller Posts des Vereins (nach `org_id`) mit Zeile „von Vorname N.“ bzw. „von
ehemaligem Mitglied“.

### Bereich „Vereine & Gewerbe“ (Verwaltungs-Dashboard)

- Liste aller Vereine, Organisationen und Gewerbe der Gemeinde mit Typ, Mitgliederzahl,
  Hinweis „Kein Verwalter“ (diese oben).
- Akkordeon (`aria-expanded`) mit `MitgliederSection` im Verwaltungsmodus: alle Rechte,
  ohne Sperre „letzter Verwalter“, inklusive „Verein löschen“.
- `EinladungenSection` bleibt für neue Vereine.

### Absender

Feed, Kalender, Freigabeliste und Share-Seite zeigen den Namen aus
`vereine.verein_name` bzw. `organisationen.name` über `posts.org_id`.
`profiles.verein_name` wird nicht mehr geschrieben.

### Barrierefreiheit

Alle Felder mit Label, Fehler mit `role="alert"`, Icon-Buttons mit `aria-label`,
Akkordeon mit `aria-expanded`, Kontrast nach Hintergrund (siehe CLAUDE.md).

## Tests

- **Datenbank (PGlite, Muster `src/lib/kontoLoeschen.db.test.ts`)**, neue Datei
  `src/lib/mitgliedschaften.db.test.ts`:
  - Backfill übernimmt bestehende Eigentümer als `verwalter`.
  - Zweite Mitgliedschaft derselben Person scheitert (Verein und Gewerbe gemischt).
  - Hinzufügen einer Person mit Rolle ≠ `buerger` oder aus anderer Gemeinde scheitert.
  - Rolle passt nach Hinzufügen zum Ziel (`verein`/`organisation`/`gewerbe`).
  - Letzter Verwalter: Entfernen und Herabstufen durch Verwalter scheitert, durch
    Verwaltung gelingt.
  - Fremder Verwalter kann nicht in anderem Verein handeln.
  - `verein_loeschen`: Posts, Abos, Mitgliedschaften weg; alle Mitglieder `buerger`;
    Einladungen widerrufen; Fehler mittendrin lässt alles unverändert.
- **`kontoLoeschen.db.test.ts` anpassen:** Verein und Vereinsposts bleiben,
  `author_id` null, Mitgliedschaft weg; Dateipfade ohne Vereinsdateien.
- **Unit-Tests** für `meineMitgliedschaft` und die Route `/api/mitglieder`
  (Berechtigung, Fehlermeldungen).

## Nicht im Umfang

- Mehrere Vereine pro Person.
- Öffentliche Anzeige der Mitglieder auf der Vereinsseite.
- Entfernen der Spalten `vereine.profile_id`, `organisationen.profile_id`,
  `profiles.verein_name` (eigene Folgemigration).
- Zusammenlegen von `vereine` und `organisationen`.
