# Share-Link: 404 beheben und Gastzugang anbieten

**Datum:** 2026-09-23
**Betrifft:** `src/app/posts/[id]/page.tsx`, `src/components/ShareButton.tsx`, neue Migration

## Problem

Ein aus Dorfly geteilter Post-Link (WhatsApp, E-Mail, Web Share API) führt beim
Empfänger auf eine 404-Seite. Das betrifft jeden Post und auch den Teilenden
selbst, weil die Seite unabhängig vom Login-Status immer anonym abfragt.

## Ursache

Die Share-Seite baut sich bewusst einen eigenen `anon`-Client, weil der Empfänger
typischerweise nicht eingeloggt ist. Ihre Query joint aber `profiles`:

```
.select('… gemeinde_id, profiles(display_name, verein_name), gemeinden(name)')
```

`anon` hat auf `public.profiles` kein SELECT-Recht. Migration 060 hat den
Gastzugang bewusst so gebaut, dass anonyme Leser Profildaten nur über die
maskierte View `profiles_public` sehen — sonst wären plattformweit E-Mails und
Profilfelder über die anon-API abgreifbar.

PostgREST lehnt daraufhin die **gesamte** Query ab, nicht nur den Join. Gegen die
Produktions-DB verifiziert:

```
Original-Query (mit profiles):    HTTP 401  42501  permission denied for table profiles
Variante mit profiles_public:     HTTP 200  (Daten)
```

Der letzte Schritt macht daraus eine 404: `getPost()` schreibt
`const { data } = await …` und wertet `error` nicht aus. `data` ist `null`,
`if (!post) notFound()` greift — der Rechtefehler tarnt sich als fehlender Post.
Deshalb ist der Bug nie als Fehler aufgefallen.

### Warum es früher funktionierte

| Datum | Ereignis |
|---|---|
| 23.04.2026 | `001_initial_schema` — Projekt angelegt |
| 25.04.2026 | Share-Feature (`ab5acc7`), `profiles(...)`-Join von Beginn an enthalten |
| Juli 2026 | `043` + `057` — profiles-Härtung, laut Kommentar *manuell auf dorfly-production ausgeführt* |
| 24.07.2026 | `060` — Gastzugang mit `profiles_public` |

Das Projekt entstand vor dem Stichtag, ab dem Supabase keine automatischen Grants
auf `public`-Tabellen mehr vergibt. `anon` hatte daher per Default-Grant
tabellenweit SELECT auf `profiles`. Die RLS-Policy lieferte anonym zwar keine
Zeilen, aber **ohne Fehler**: Der Join ergab `profiles: null`, die Seite rendert
durch, der Autorname fiel auf den Gemeindenamen zurück. Das sah plausibel aus und
fiel niemandem auf.

Erst als der Default-Grant entzogen wurde, wurde aus „keine Zeilen" ein hartes
`42501` auf die ganze Query. Der Entzug steht in keiner Migration und passierte
mit hoher Wahrscheinlichkeit bei der manuellen profiles-Härtung im Juli.

### Warum die Seite beim Umbau übersehen wurde

Commit `b46af92` hat das Frontend systematisch auf `profiles_public` umgestellt —
Feed, Gemeinderat und Veranstaltungen nutzen es heute. Die Share-Seite blieb als
einzige auf `profiles`.

Der Grund ist strukturell: Sie steht in `PUBLIC_ROUTES` der Middleware, nicht in
`GUEST_ROUTE_PREFIXES` in `src/lib/guestRoutes.ts`. Der Gastzugang-Umbau arbeitete
die Gast-Routen ab; die Share-Seite ist formal keine Gast-Route, sondern eine
öffentliche Teilen-Seite. Sie fiel durch das Raster zwischen zwei Listen.

Ein Smoketest über alle anon-Zugriffe bestätigt, dass der Gastzugang sonst intakt
ist: `posts`, `gemeinden`, `post_termine`, `vereine`, `organisationen`,
`abfalltermine`, `profiles_public` sind erreichbar; `umfragen`, `maengel`,
`fragen` und `profiles` bewusst gesperrt.

## Designentscheidung: Gast nicht ausschließen

Die Share-Seite soll weiterhin zur Registrierung motivieren. Seit der Einführung
des Gastzugangs ist es aber falsch, Registrierung als **einzigen** Weg anzubieten.

Die Seite zeigt ohnehin den vollständigen Post — ein harter Gate schützt also
nichts, sondern bewirkt nur, dass ein gerade geweckter Interessent am Seitenende
gegen eine Wand läuft. Mit einem sichtbaren Gast-Weg entsteht stattdessen eine
zweite Chance: Wer in den Feed weitergeht und dort weitere relevante Inhalte aus
seiner Gemeinde findet, registriert sich später eher als jemand, der beim ersten
Kontakt abspringt. Der Absprung ist endgültig, der Gastbesuch nicht.

**Gewählt:** Registrieren bleibt primärer CTA, der Gast-Weg steht sichtbar
darunter als sekundäre Option.

Verworfen:

- **Beide gleichwertig** — schwächt die Registrierungs-Absicht. Die
  Gleichwertigkeit aus App-Store 5.1.1(v) betrifft den App-Flow und ist über den
  Login-Screen erfüllt; die Share-Seite ist ein Werbe-Kontext davor.
- **Link führt direkt in die App-Shell** — verliert die schnelle, auth-freie
  OG-Landing und den gezielten Registrierungs-Moment, bei spürbarem Aufwand
  (App-Shell, Gemeinde-Kontext, Route in `GUEST_ROUTE_PREFIXES`).

## Umsetzung

### 1. Query auf `profiles_public` umstellen

In `getPost()` das projektübliche Alias-Muster verwenden, das Feed und
Veranstaltungen bereits nutzen:

```
profiles:profiles_public!posts_author_id_fkey(display_name, verein_name)
```

Das Alias `profiles:` erhält den Feldnamen im Ergebnis, sodass der Zugriff auf
`post.profiles` unverändert bleibt. Behebt den 404.

Die Select-Spalten dabei als Konstante nach `src/lib/publicPostQuery.ts` ziehen,
damit sie ohne Next.js-Laufzeit testbar sind (siehe Tests).

Hinweis: `profiles_public` filtert `role <> 'buerger'`. Bei einem Bürger-Post
bliebe der Autor leer und fiele auf den Gemeindenamen zurück — praktisch
irrelevant, da Migration 058 Bürgern das Posten entzieht.

### 2. Fehler nicht mehr verschlucken

`error` auswerten und trennen:

- `PGRST116` (keine Zeile) → `notFound()`
- jeder andere Fehler → werfen, damit er als 500 im Log erscheint

Ohne diesen Schritt versteckt sich der nächste Rechtefehler genauso lautlos. Das
gilt für `getPost()` und damit auch für `generateMetadata`.

### 3. Gemeinde-Kontext lesen

`getGemeindeSlug()` aus `src/lib/gemeinde.ts` verwenden — reine Header-Lesung
ohne Datenbankzugriff und damit anon-tauglich. Die Middleware setzt
`x-gemeinde-slug`, bevor sie den `isPublic`-Zweig nimmt, der Header liegt auf
`/posts/...` also an.

### 4. CTA-Block

Die Zielentscheidung als reine Funktion auslagern (z. B. `shareCtaZiele(slug)` in
`src/lib/shareCta.ts`), damit sie ohne React testbar ist:

| Slug | Primär | Sekundär |
|---|---|---|
| vorhanden | → `/login` | `Ohne Anmeldung ansehen` → `/feed` |
| `null` (Apex-Domain) | → `/homepage` | entfällt |

Der Primärtext lautet in beiden Fällen `Dorfly für {Gemeinde} holen`. Der
Gemeindename stammt aus `post.gemeinden.name` und liegt damit unabhängig vom Slug
vor; nur das **Ziel** hängt vom Slug ab. `shareCtaZiele(slug)` entscheidet
ausschließlich über Ziele und Sichtbarkeit des sekundären CTA, nicht über Texte.

Der Slug-Fall ist notwendig, weil `/feed` ohne Gemeinde-Kontext von der
Middleware nach `/homepage` umgeleitet wird — ein sekundärer CTA ins Leere wäre
schlechter als keiner.

Der Primärtext benennt den Nutzen statt der Handlung; „Jetzt registrieren" ist
eine Aufforderung ohne Gegenleistung, was besonders schadet, wenn direkt darunter
eine reibungsärmere Alternative steht.

**Barrierefreiheit** (Checkliste aus CLAUDE.md):

- Beide CTAs sind `<Link>`, keine `div onClick`
- Das `Eye`-Icon steht neben sichtbarem Text → `aria-hidden="true"`, wie im
  Login-Screen
- Sekundärer CTA weiß umrandet mit weißem Text auf `bg-primary-500` — Kontrast
  deutlich über 4.5:1
- Die Route hat über `generateMetadata` bereits einen aussagekräftigen Titel

### 5. Veralteten Fallback korrigieren

`src/components/ShareButton.tsx:18` nutzt als SSR-Fallback noch
`https://dorfly.vercel.app`, während die Root-Domain `dorfly.de` ist. Beim echten
Klick greift `window.location.origin`, es entsteht also kein Fehlverhalten — der
Wert ist aber veraltet und gehört auf `NEXT_PUBLIC_APP_URL` umgestellt.

### 6. Drift zwischen Migrations und Produktion schließen

Der entzogene anon-Grant auf `profiles` existiert nur in der Produktions-DB, in
keiner Migration. Wer die Migrations frisch aufsetzt (Staging, lokal, neue
Gemeinde), bekommt einen anderen Rechtezustand als Produktion und könnte den Bug
dort nicht reproduzieren.

Neue Migration, die den Ist-Zustand explizit festschreibt:

```sql
revoke select on public.profiles from anon;
```

Mit demselben „manuell nachgetragen"-Kommentarstil wie 043. Das ist der
eigentliche Hebel gegen die nächste Runde dieses Fehlers: Der Query-Fix behebt
einen Fall, die festgeschriebenen Rechte verhindern, dass eine künftige manuelle
Härtung wieder unbemerkt eine öffentliche Seite abräumt.

## Tests

Bestehende Teststruktur ist Vitest mit reinen Unit-Tests unter `src/lib/`.

1. **Regressionstest Query** — Die Select-Konstante der öffentlichen Post-Query
   nach `src/lib/publicPostQuery.ts` ziehen und festhalten, dass sie keine für
   `anon` gesperrte Relation anspricht (kein `profiles(`, sondern
   `profiles_public`). Schlägt gegen den heutigen Stand fehl.
2. **CTA-Ziele** — `shareCtaZiele(slug)` für beide Fälle: mit Slug zwei Ziele
   (`/login`, `/feed`), ohne Slug nur `/homepage` und kein sekundäres Ziel.

Verifikation nach der Umsetzung: `npm run test`, `npm run build`, und den
geteilten Link real im Inkognito-Fenster öffnen — inklusive WhatsApp-Vorschau,
die heute wegen desselben Fehlers auf den Titel „Dorfly" zurückfällt.

## Nicht in diesem Scope

Die Share-Seite gleicht `gemeinde_id` nicht gegen den Host ab: Ein Post ist
derzeit unter jeder Gemeinde-Subdomain abrufbar. Da der Slug nach Schritt 3
ohnehin vorliegt, wäre der Abgleich billig — er ändert aber Verhalten (Posts
fremder Gemeinden würden 404) und ist eine eigene Produktentscheidung. Bewusst
separat gehalten.
