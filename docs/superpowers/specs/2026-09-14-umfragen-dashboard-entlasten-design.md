# Umfragen im Verwaltungs-Dashboard entlasten

## Kontext

Das Verwaltungs-Dashboard (`src/app/(admin)/dashboard/page.tsx`) lädt bei jedem
Aufruf **alle** Umfragen der Gemeinde samt allen Fragen und allen
Antwortoptionen:

```ts
supabase.from('umfragen')
  .select('*, umfrage_fragen(*, umfrage_optionen(*))')
  .eq('gemeinde_id', gemeindeId!)
  .order('created_at', { ascending: false })
```

Danach läuft pro Umfrage ein eigener Block mit **zwei** RPC-Aufrufen:

```ts
const umfragenMitErgebnissen = await Promise.all(
  umfragen.map(async (umfrage) => {
    const [ergebnisResult, teilnehmerResult] = await Promise.all([
      (supabase.rpc as any)('umfrage_ergebnisse', { p_umfrage_id: umfrage.id }),
      (supabase.rpc as any)('umfrage_teilnehmer_anzahl', { p_umfrage_id: umfrage.id }),
    ])
    // ... Auswertung
  })
)
```

Bei 200 Umfragen sind das 400 Datenbankaufrufe pro Seitenaufruf, zusätzlich zur
unbegrenzten Listenabfrage. Das wächst linear mit dem Alter der Gemeinde, denn
Umfragen werden nicht gelöscht.

Der entscheidende Punkt: **Die teure Hälfte davon wird fast nie angezeigt.**
`UmfragenSection` rendert die Ergebnisse nur, wenn eine Umfrage sowohl beendet
als auch aufgeklappt ist (`{abgelaufen && isOpen && ...}`). Bei laufenden
Umfragen steht stattdessen „Ergebnisse erst nach Abschluss sichtbar". Der Server
rechnet also bei jedem Aufruf die Ergebnisse aller Umfragen aus — auch der
laufenden, wo sie bewusst nicht gezeigt werden dürfen — und verwirft praktisch
alles davon.

Die Teilnehmerzahl dagegen steht in jeder Zeile und wird wirklich gebraucht —
nur eben einzeln pro Umfrage abgefragt statt einmal für alle.

## Ziel

Der Dashboard-Aufruf kommt für Umfragen mit zwei Datenbankabfragen aus statt mit
mehreren hundert, und überträgt nur noch die Daten, die die Liste tatsächlich
anzeigt. Ergebnisse werden erst geladen, wenn jemand sie aufklappt.

## Nicht-Ziele

- **Keine** Änderung an den bestehenden Funktionen `umfrage_ergebnisse` und
  `umfrage_teilnehmer_anzahl`. Sie bleiben wie sie sind; es kommt eine dritte
  hinzu.
- **Keine** Änderung an der Darstellung der Ergebnisse. Balken, Prozente und
  Durchschnitte sehen aus wie bisher — nur der Zeitpunkt des Ladens ändert sich.
- **Keine** Änderung an der Umfrage-Erstellung oder -Bearbeitung.
- **Kein** Caching über den Seitenaufruf hinaus. Einmal geladene Ergebnisse
  bleiben nur so lange im Speicher, wie die Seite offen ist.

## Design

### 1. Ergebnisse erst beim Aufklappen laden

Neue Route `src/app/api/verwaltung/umfrage-ergebnisse/route.ts` (`GET`),
abgesichert über `withAuth` mit `roles: ['verwaltung', 'super_admin']` — dasselbe
Muster wie `src/app/api/verwaltung/suche/route.ts`.

- Parameter: `umfrageId` (UUID), validiert über ein Zod-Schema in
  `src/lib/validations.ts`.
- Die Route holt die Fragen und Optionen **dieser einen** Umfrage, ruft
  `umfrage_ergebnisse` auf und liefert die fertig ausgewerteten `FrageErgebnis`-
  Objekte zurück.
- Zusätzliche Absicherung: Die Umfrage muss zur Gemeinde des Profils gehören.
  Die RPC prüft das über `current_gemeinde_id()` bereits selbst, aber die Route
  soll sich nicht darauf verlassen.

`UmfragenSection` lädt beim Aufklappen nach, hält die Ergebnisse je Umfrage-ID im
Komponenten-Zustand und zeigt Lade-, Leer- und Fehlerzustand. Ein zweites
Aufklappen derselben Umfrage löst keine neue Anfrage aus.

### 2. Auswertungslogik herausziehen und testen

Die Umrechnung roher Antwortzeilen in `FrageErgebnis` — Prozente, Rundung,
Durchschnitt bei Bewertungen, Ja/Nein-Zählung — steckt heute als rund 50 Zeilen
mitten in `page.tsx` und ist ungetestet. Sie wandert nach
`src/lib/umfrageErgebnisse.ts` als reine Funktion:

```ts
export function berechneErgebnisse(
  fragen: UmfrageFrage[],
  antworten: ErgebnisZeile[],
): FrageErgebnis[]
```

Das ist die einzige Stelle im Dashboard mit echter Rechenlogik. Sie gehört unter
Test, unabhängig davon, wo sie aufgerufen wird.

### 3. Teilnehmerzahlen in einer Abfrage

Neue Migration `supabase/migrations/062_umfrage_teilnehmer_anzahlen.sql`, exakt
nach dem Muster von `049_umfrage_ergebnisse_rpc.sql`:

```sql
create or replace function public.umfrage_teilnehmer_anzahlen()
returns table (umfrage_id uuid, anzahl bigint)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select t.umfrage_id, count(*)
  from public.umfrage_teilnahmen t
  join public.umfragen u on u.id = t.umfrage_id
  where u.gemeinde_id = public.current_gemeinde_id()
    and public.is_verwaltung()
  group by t.umfrage_id
$$;

grant execute on function public.umfrage_teilnehmer_anzahlen() to authenticated;
```

Kein Parameter: Die Gemeinde kommt wie bei den bestehenden Funktionen aus der
Session über `current_gemeinde_id()`, nicht aus dem Aufruf. `page.tsx` ruft sie
einmal auf und baut daraus eine Map von Umfrage-ID auf Anzahl.

### 4. Liste deckeln

Arbeitsset: **die 3 neuesten Umfragen plus alle laufenden** (Enddatum in der
Zukunft). Laufende Umfragen sind das, was Aufmerksamkeit braucht; alles andere
ist Archiv.

Konkret zwei Abfragen: die 3 neuesten nach `created_at`, und alle laufenden
(`enddatum >= jetzt`) mit `.limit(50)` als Obergrenze — dieselbe Deckelung wie
bei den offenen Mängeln und Fragen. Zusammengeführt wird mit der bestehenden
`mergeArbeitsset`-Funktion aus `src/lib/dashboardArbeitsset.ts`.

Dazu ein Zähler „N von M" und, falls die 50er-Grenze bei den laufenden greift,
ein Hinweis auf die verborgenen — dasselbe Muster wie bei Mängeln und Fragen.
Dass eine Gemeinde mehr als 50 gleichzeitig laufende Umfragen hat, ist
unwahrscheinlich; die Grenze existiert, damit die Liste in keinem Fall
unbegrenzt wächst.

Die Spaltenliste schrumpft dabei erheblich: `umfrage_fragen(*, umfrage_optionen(*))`
entfällt, weil die Fragen und Optionen jetzt erst beim Aufklappen über die Route
kommen. Die Liste braucht nur noch Titel, Enddatum und ID.

### 5. Suche für Umfragen

Deckeln ohne Suchzugriff würde die stille Klippe wiederholen, die bei den
Beiträgen gerade beseitigt wurde: Ältere Umfragen wären nicht mehr erreichbar.
Bei drei sichtbaren Einträgen fällt eine beendete Umfrage besonders schnell aus
der Liste.

`SUCH_TYPEN` in `src/lib/dashboardSuche.ts` bekommt deshalb `umfragen` als
fünften Wert, und `src/app/api/verwaltung/suche/route.ts` einen entsprechenden
Zweig (`ilike` auf `titel`, Filter auf `gemeinde_id`, Sortierung nach
`created_at`). `UmfragenSection` bindet `AeltereSuche` ein wie die anderen
Sections.

### 6. Reihenfolge beim Ausrollen

Migrationen werden in diesem Projekt von Hand im Supabase-SQL-Editor eingespielt.
Daraus folgt eine verbindliche Reihenfolge:

1. Migration `062` im SQL-Editor ausführen
2. Prüfen, dass die Funktion existiert
3. Erst dann den Code deployen

Als Sicherheitsnetz fängt `page.tsx` einen Fehler beim Aufruf von
`umfrage_teilnehmer_anzahlen` ab und zeigt die Liste ohne Teilnehmerzahlen, statt
die gesamte Dashboard-Seite scheitern zu lassen. Das ist ausdrücklich **kein**
Ersatz für die richtige Reihenfolge, sondern schützt nur davor, dass ein
Versehen die ganze Seite lahmlegt.

### 7. Tests

Passend zum Projektmuster (reine Logik in `src/lib` mit Vitest, keine Route- oder
Komponententests):

- `src/lib/umfrageErgebnisse.test.ts` — `berechneErgebnisse`: Ja/Nein-Zählung,
  Bewertung mit Durchschnitt, Einzel- und Mehrfachauswahl, Umfrage ganz ohne
  Antworten (Division durch null), Optionen ohne Stimmen, Sortierung der
  Optionen nach `reihenfolge`.
- Der bestehende `src/lib/validations.dashboardSuche.test.ts` wird um den
  neuen Typ `umfragen` erweitert; der Test, der `'umfragen'` bisher als
  **ungültigen** Typ prüft, muss dabei auf einen anderen ungültigen Wert
  umgestellt werden.
- `src/lib/dashboardSuche.test.ts` prüft `SUCH_TYPEN` auf exakten Inhalt und
  muss um den fünften Wert ergänzt werden.

## Erwartetes Ergebnis

| | vorher | nachher |
|---|---|---|
| Datenbankaufrufe für Umfragen | 1 + 2 × Anzahl Umfragen | 2 |
| Übertragene Umfragen | alle | 3 + laufende |
| Übertragene Fragen/Optionen | alle, immer | nur beim Aufklappen, nur die eine |

Bei 200 Umfragen: von rund 400 Aufrufen auf zwei.

## Folgethemen

- Rund 60 Stellen mit `text-gray-400` im Dashboard verfehlen den Kontrastwert
  aus der Checkliste in `CLAUDE.md`. Bewusst zurückgestellt, weil das Dashboard
  nicht der öffentlich sichtbare Teil ist.
