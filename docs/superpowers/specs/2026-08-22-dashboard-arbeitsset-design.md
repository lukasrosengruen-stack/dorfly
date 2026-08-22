# Verwaltungs-Dashboard: Arbeitsset statt Vollbestand

## Kontext

Das Verwaltungs-Dashboard (`src/app/(admin)/dashboard/page.tsx`) lädt seine
Listen weitgehend unbegrenzt. Mit dem Alter einer Gemeinde wächst die
Datenmenge pro Seitenaufruf linear mit.

Ist-Zustand, aus dem Code gelesen:

| Abfrage | Limit | Anzeige |
|---|---|---|
| `posts` (published) | `.limit(50)` | alle 50, flache Liste |
| `posts` (pending) | keins | alle |
| `maengel` | keins | alle Zeilen an den Client, dann `.slice(0, 10)` |
| `fragen` | keins | alle Zeilen an den Client, dann `.slice(0, 10)` |
| `warnmeldungen` | keins | alle |
| `umfragen` | keins | alle, plus N+1 (siehe Folgethemen) |

Zwei Punkte sind dabei gravierender als die reine Listenlänge:

1. **Das bestehende `.limit(50)` auf Beiträgen ist eine stille Klippe.**
   Überschreitet eine Gemeinde 50 veröffentlichte Beiträge, sind alle
   älteren im Dashboard nicht mehr erreichbar — nicht bearbeitbar, nicht
   löschbar, ohne jeden Hinweis in der Oberfläche.

2. **Mängel und Fragen laden den kompletten Verlauf über die Leitung**, um
   anschließend zehn Einträge zu rendern. Das Dashboard läuft in einer
   Capacitor-App auf Mobilfunk.

Aus der Anforderungsklärung: Beiträge, die älter als etwa eine Woche sind,
werden praktisch nie mehr angefasst. Es gibt aber Ausnahmen, die verlässlich
funktionieren müssen — eine Veranstaltung absagen, eine veraltete
Telefonnummer korrigieren, etwas aus rechtlichen Gründen entfernen.

## Ziel

Die Verlaufslisten im Verwaltungs-Dashboard zeigen ein begrenztes
**Arbeitsset**, das in der Datenbank begrenzt wird statt im Browser. Alles
Ältere bleibt über eine aufklappbare, serverseitige Suche erreichbar. Die
Deckelung wird in der Oberfläche sichtbar gemacht, statt still zu passieren.

Ausgenommen ist der Freigabe-Stapel (`posts` mit `status = 'pending'`): Er
ist keine Verlaufsliste, sondern eine Aufgabenliste, die vollständig sein
muss und sich durch Bearbeitung selbst leert. Er bleibt ungedeckelt.

## Nicht-Ziele

- **Keine** Änderung an der Umfragen-Liste in diesem Schnitt — weder
  Deckelung noch Auflösen des N+1 (siehe Folgethemen). Beides gehört
  zusammen und würde diesen Schnitt aufblähen.
- **Keine** eigenen Archivseiten oder neuen Routen im `(admin)`-Bereich.
- **Kein** Infinite-Scroll und kein „Mehr laden"-Button. Der seltene Zugriff
  auf Altes läuft über Suche, nicht über Blättern.
- **Keine** Änderung an der Feed-Seite oder anderen Nutzeransichten. Nur das
  Verwaltungs-Dashboard.
- **Keine** Volltextsuche über Beitragsinhalte. `ilike` auf den Titel reicht
  für den beschriebenen Bedarf.

## Design

### 1. Das Muster

Jede Liste bekommt dieselben drei Bausteine:

- **Arbeitsset** — `.limit()` in der Abfrage, `.slice()` im Client entfällt.
- **Zähler** — „10 von 312" in der Section-Überschrift, gespeist aus einer
  `count: 'exact', head: true`-Abfrage über den Gesamtbestand der Liste.
  Macht die Deckelung sichtbar. Das ist **eine** Abfrage je Liste,
  zusätzlich zu den nach Status aufgeschlüsselten Zählungen aus
  Abschnitt 3.
- **Ältere durchsuchen** — aufklappbare Zeile am Fuß der Liste.

### 2. Arbeitsset je Liste

Bei Mängeln, Fragen und Warnmeldungen ist nicht das Alter das Kriterium,
sondern der Status: Ein offener Mangel von vor drei Monaten ist weiterhin
offene Arbeit und darf nicht aus der Liste fallen. Ein reines
`order + limit` würde ihn verschwinden lassen.

| Liste | Arbeitsset | Zusätzlich, unabhängig vom Alter |
|---|---|---|
| Beiträge | 20 neueste nach `published_at` | kommende Veranstaltungen |
| Mängel | 10 neueste nach `created_at` | alles mit `status <> 'erledigt'` |
| Fragen | 10 neueste nach `created_at` | alles mit `status = 'offen'` |
| Warnmeldungen | 10 neueste nach `created_at` | alles mit `is_active = true` |
| Beiträge (pending) | unverändert alle | — (Freigabe-Stapel ist per Natur kurz und muss vollständig sein) |

Umsetzung der Statusausnahmen: je Liste eine zweite, ebenfalls begrenzte
Abfrage (`.limit(50)`) auf den offenen Status, parallel im bestehenden
`Promise.all`. Die beiden Ergebnismengen werden über die `id` zusammengeführt
und nach Datum sortiert. Das Zusammenführen ist reine Logik und wird als
Funktion in `src/lib/dashboardArbeitsset.ts` ausgelagert und getestet.

**Geplante Beiträge brauchen keine Sonderbehandlung.** `published_at` wird
beim Freigeben auf `publish_at` gesetzt
(`src/app/api/posts/freigeben/route.ts`), geplante Beiträge sortieren durch
`order('published_at', desc)` also von selbst nach oben.

**Kommende Veranstaltungen brauchen sie doch:** Eine vor Wochen angelegte
Veranstaltung von morgen liegt nicht unter den 20 neuesten.

Ein Termin steckt dabei in zwei Quellen — `posts.veranstaltung_datum` und
zusätzlich beliebig viele Zeilen in `post_termine` (siehe
`src/features/feed/FeedCard.tsx`, das beide zu einer Liste vereint). Eine
mehrtägige Veranstaltung, deren erster Termin vergangen ist, deren zweiter
aber noch bevorsteht, gilt weiterhin als kommend.

Dafür wird das bereits etablierte Muster aus
`src/app/(app)/veranstaltungen/page.tsx` übernommen: eine Abfrage auf
`posts.veranstaltung_datum >= heute`, eine zweite auf `post_termine` mit
`posts!inner`-Join und `datum >= heute`, beide Ergebnisse zusammengeführt.
Anders als dort werden die Zusatztermine hier **nicht** zu eigenen
Listeneinträgen aufgefächert — im Dashboard soll jeder Beitrag genau einmal
erscheinen. Das Entdoppeln über die `id` übernimmt dieselbe Merge-Funktion
in `src/lib/dashboardArbeitsset.ts`.

### 3. KPI-Zählungen umstellen — Voraussetzung, nicht Zusatz

Die KPI-Kacheln werden heute aus den unbegrenzten Arrays berechnet
(`page.tsx`, derzeit Zeilen 166–169):

```ts
const offeneMaengel = maengel.filter(m => m.status === 'offen').length
const inBearbeitung = maengel.filter(m => m.status === 'in_bearbeitung').length
const erledigteMaengel = maengel.filter(m => m.status === 'erledigt').length
const offeneFragen = fragen.filter(f => f.status === 'offen').length
```

Sobald die zugrunde liegenden Abfragen ein `.limit()` bekommen, zeigen diese
Kacheln stillschweigend falsche Zahlen — „7 offene Mängel", obwohl es 40
sind. Falsche Zahlen sind schlimmer als lange Listen, weil sie nicht als
Fehler auffallen.

Die vier Werte werden deshalb im selben Schritt durch
`count: 'exact', head: true`-Abfragen ersetzt (drei für `maengel` nach
Status, eine für `fragen`). Diese Abfragen übertragen keine Zeilen und
laufen parallel im bestehenden `Promise.all`.

Gleiches gilt für die Zähler in den Section-Überschriften
(`offeneMaengel`/`inBearbeitung`/`erledigteMaengel` werden an
`MaengelSection` durchgereicht) und für `aktiveWarnungenAnzahl`.

### 4. Komponente `AeltereSuche`

Neu: `src/components/dashboard/AeltereSuche.tsx` (Client Component).

```tsx
<AeltereSuche typ="beitraege" label="Ältere Beiträge durchsuchen">
  {(treffer) => /* Section rendert ihre Zeilen selbst */}
</AeltereSuche>
```

- Standardmäßig eingeklappt, nur eine Zeile mit Lupe und Text.
- Aufgeklappt: Suchfeld, Entprellung 300 ms, Suche ab 2 Zeichen.
- Zustände: Ruhe, Laden, Treffer, keine Treffer, Fehler.
- Die Trefferdarstellung liefert die jeweilige Section per `children`-
  Funktion, damit Beiträge, Mängel, Fragen und Warnmeldungen ihre gewohnten
  Zeilen behalten und die Komponente nichts über sie wissen muss.

Barrierefreiheit (gemäß Checkliste in `CLAUDE.md`):

- Auslöser ist ein `<button>` mit `aria-expanded`.
- Suchfeld mit verknüpftem `<label>`, kein `placeholder` als Ersatz.
- Fehlermeldung mit `role="alert"`.
- Trefferzahl in einer `aria-live="polite"`-Region, damit
  Screenreader-Nutzer das Ergebnis mitbekommen.
- Fokus wandert beim Aufklappen ins Suchfeld.

### 5. Such-API

Neu: `src/app/api/verwaltung/suche/route.ts` (`GET`). Der Ordner
`src/app/api/verwaltung/` existiert bereits.

- Parameter: `typ` (`beitraege` | `maengel` | `fragen` | `warnmeldungen`),
  `q` (2–100 Zeichen).
- Validierung über ein Zod-Schema in `src/lib/dashboardSuche.ts`.
- `ilike` auf das jeweilige Titelfeld, `order` absteigend nach Datum,
  `.limit(20)`.
- Antwort: `{ treffer: [...], mehrVorhanden: boolean }`.

### 6. Sicherheit

Die Route liest **keine** Mandanten- oder Rolleninformation aus dem Request.
`gemeinde_id` und `role` werden serverseitig aus der Session abgeleitet —
dieselbe Regel, die die Middleware für `x-gemeinde-slug` durchsetzt
(`src/middleware.ts`).

- Rollenprüfung wie in `src/app/(admin)/layout.tsx`: nur `verwaltung` und
  `super_admin` dürfen `maengel`, `fragen` und `warnmeldungen` durchsuchen.
- Jede Abfrage wird zusätzlich auf `gemeinde_id` des Profils eingeschränkt.
- Ein Vereins- oder Gewerbe-Account darf über diesen Weg keine
  Gemeindedaten finden.

### 7. Tests

Passend zum bestehenden Muster (reine Logik in `src/lib` mit Vitest, keine
Komponententests im Projekt):

- `src/lib/dashboardSuche.test.ts` — Zod-Schema: `typ`-Whitelist, `q` unter
  2 und über 100 Zeichen, Trimmen, unbekannter `typ`.
- `src/lib/dashboardArbeitsset.test.ts` — Zusammenführen von Arbeitsset und
  Statusausnahmen: keine Duplikate bei überlappenden `id`s, Sortierung nach
  Datum, offener Altfall bleibt enthalten, leere Eingaben.

## Geklärte Randfragen

- **Warnmeldungen** sind `posts` mit `channel = 'warnung'` und nutzen
  dieselbe Spalte `titel` wie alle anderen Beiträge. Die Suche kann sie
  deshalb wie Beiträge behandeln, nur mit zusätzlichem `channel`-Filter.
- **Mehrtägige Veranstaltungen** müssen `post_termine` mit auswerten, siehe
  Abschnitt 2. `veranstaltung_datum` allein genügt nicht.

## Folgethemen

- **Umfragen-N+1** (`page.tsx`, derzeit Zeilen 174–182): zwei RPCs pro
  Umfrage in `Promise.all(umfragen.map(...))`. Bei 200 Umfragen sind das
  400 Roundtrips pro Seitenaufruf. Diese Stelle kippt früher um als jede
  Listenlänge und sollte als Nächstes angegangen werden.
- Beiträge im Freigabe-Stapel (`pending`) bleiben ungedeckelt. Sollte sich
  zeigen, dass Stapel auflaufen, wäre dort dasselbe Muster anzuwenden.
