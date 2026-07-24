# Design: Gastzugang (Guest Access)

**Datum:** 2026-07-24
**Status:** Genehmigt (Design), bereit für Implementierungsplan
**Auslöser:** App-Store-Ablehnung, Guideline 5.1.1(v) — Privacy / Data Collection. Die App verlangt aktuell Registrierung/Login, um nicht-account-basierte Inhalte (Newsfeed, Warnmeldungen) zu sehen. Apple verlangt freien Zugang zu Features, die nicht account-basiert sind.

## Ziel

Nicht eingeloggte Besucher (Gäste) können die nicht-account-basierten Inhalte einer Gemeinde frei ansehen. Account-basierte bzw. interaktive Funktionen (Abstimmen, Abonnieren, Melden, Kommentieren, Mängel melden, Profil) dürfen weiterhin Login verlangen.

### Gast-Umfang (frei zugänglich, lesend)

- Newsfeed (Neuigkeiten)
- Warnmeldungen
- Veranstaltungen
- Abfallkalender (Basis, ohne persönliche Erinnerungen)
- Vereine-Verzeichnis
- Lokale Angebote / Gewerbe-Verzeichnis
- Home (Hub-Seite)

### Weiterhin login-pflichtig

- Umfragen (auch die Umfrage-Karten im Feed werden für Gäste ausgeblendet)
- Mängel melden
- Frag den Bürgermeister
- Gemeinderat
- Profil, Dashboard, Admin
- Alle Interaktionen: Abstimmen, Abonnieren, Melden (Report), Kommentieren

## Einstieg (UX-Entscheidung)

Die Login-Seite bleibt die Landing-Page, bekommt aber einen deutlichen **„Ohne Anmeldung ansehen“**-Button, der in den Feed führt. Zusätzlich sind die Gast-Routen direkt per Deep-Link erreichbar (kein Wall davor).

## Architektur

### Gewählter Ansatz: Gates in-place lockern (Ansatz A)

Kein separates Route-Group-Duplikat, keine anonyme Auth-Session. Ein **Gast ist schlicht „kein Auth-Cookie / kein `user`“**. Die bestehende `(app)`-Route-Group bleibt; wir lockern die Gates und behandeln den Null-User-Fall pro Seite sauber.

Verworfene Alternativen:
- **Ansatz B (separate `(public)`-Route-Group):** starke Isolation, aber dupliziert Layout, Nav und Feed-Implementierung → Drift-Risiko.
- **Ansatz C (anonyme Supabase-Session `signInAnonymously`):** erzeugt echte Auth-Zeilen pro Besucher, verfälscht Analytics/RLS und ist inhaltlich das Gegenteil dessen, was Apple will (es ist weiterhin „sich anmelden“).

### Tenant-Auflösung

Die Gemeinde wird über die Subdomain per `x-gemeinde-slug`-Header und `getGemeinde()` aufgelöst — das funktioniert ohne Auth. Gast-Seiten dürfen den Tenant daher **nicht** mehr aus `profile.gemeinde_id` ziehen (Gäste haben kein Profil), sondern aus `getGemeinde().id`.

Ein abgeleitetes `isGuest = !user` fließt von jeder Server-Page in ihre Client-Komponente.

## Komponenten & Änderungen

### 1. Gatekeeper

- **`src/middleware.ts`:** Neue `GUEST_ROUTES`-Liste (`/home`, `/feed`, `/warnmeldungen`, `/veranstaltungen`, `/abfallkalender`, `/vereine`, `/lokale-angebote`), die den Session-Cookie-Redirect umgeht — analog zur bestehenden `PUBLIC_ROUTES`-Logik, aber mit weiterhin gesetztem `x-gemeinde-slug`-Header (Gäste brauchen den Tenant). Geschützte Routen leiten weiterhin auf `/login`.
- **`src/app/(app)/layout.tsx`:** Das harte `if (!user) redirect('/login')` entfällt. Das Layout rendert auch für Gäste und reicht `isGuest` an `BottomNav` durch. Profil-abhängige Werte (z. B. `role`) werden nur bei vorhandenem `user` geladen.

### 2. Seiten-Anpassungen (Null-User-Audit)

Muster: Tenant über `getGemeinde().id` statt über das Profil; nutzer-bezogene Teil-Queries (Abos, Präferenzen, eigene Stimmen) nur bei vorhandenem `user`.

- **`(app)/feed/page.tsx`** — `profile?.gemeinde_id` → `getGemeinde()`; `gewerbe_abonnements`/`verein_abonnements`/`umfrage_teilnahmen` für Gäste überspringen; **Umfragen für Gäste nicht laden/ausblenden**.
- **`(app)/veranstaltungen/page.tsx`** — Tenant auf `getGemeinde()` umstellen.
- **`(app)/abfallkalender/page.tsx`** — `redirect('/login')` entfernen; `getGemeinde()` nutzen; persönliche `abfallkalender_praeferenzen` überspringen. Feature-Gate (`isFeatureAktiv`) bleibt.
- **`(app)/vereine/page.tsx`** — `redirect('/login')` entfernen; `getGemeinde()` nutzen; `verein_abonnements`-Query überspringen.
- **`(app)/lokale-angebote/page.tsx`** — `redirect('/login')` entfernen; `getGemeinde()` nutzen; `gewerbe_abonnements`-Query überspringen.
- **`(app)/home/page.tsx`** — für Gäste rendern; nur gast-zugängliche Kacheln zeigen + prominente „Registrieren / Anmelden“-Karte; geschützte Kacheln lösen die Login-Wall aus.
- **`(app)/warnmeldungen/page.tsx`** — nutzt bereits `getGemeinde()` und keinen `user`; ggf. nur verifizieren.

### 3. Datenbank-Migration (`060_gastzugang_anon_grants.sql`)

Mehrere Tabellen haben RLS-Policies, die auf `to authenticated` beschränkt sind — anon bekommt selbst mit Grant nichts. Die Migration ergänzt **anon-SELECT-Grant + anon-lesbare RLS** für:

| Objekt | Aktion |
|---|---|
| `vereine` | anon-lesbare SELECT-Policy (aktuell `to authenticated`) + `grant select to anon` |
| `verein_kategorien` | anon-lesbare SELECT-Policy + `grant select to anon` |
| `organisationen` | anon-lesbare SELECT-Policy + `grant select to anon` |
| `abfalltermine` | anon-lesbare SELECT-Policy + `grant select to anon` |
| `abfallkalender_einstellungen` | anon-lesbare SELECT-Policy + `grant select to anon` |
| `post_termine` | nur `grant select to anon` (Policy ist bereits `using (true)` ohne Rollen-Beschränkung) |
| `profiles_public` (View) | `grant select to anon` (Sicherheitsmodell der View bei Implementierung verifizieren) |

Bereits anon-lesbar (keine Änderung nötig): `posts`, `gemeinden`, `gewerbe_branchen`.

**Wichtig:** Alle Grants bleiben strikt lesend (nur SELECT). Keine insert/update/delete-Grants für anon. Bestehende Schreib-Härtungen bleiben unberührt.

### 4. Login-Wall (`src/components/LoginWall.tsx`)

Wiederverwendbare Client-Komponente als Bottom-Sheet-Modal. A11y nach CLAUDE.md-Vorgaben:
- `role="dialog"`, `aria-modal="true"`
- `useFocusTrap` aus `src/hooks/useFocusTrap.ts`
- Fokus-Restore beim Schließen

Client-Komponenten erhalten `isGuest`. Geschützte Aktionen rufen `requireLogin()` auf:
- Für Gäste: öffnet die Wall („Registriere dich, um mitzumachen“) mit **Anmelden** / **Registrieren**, verlinkt auf `/login?next=<aktuelle URL>`.
- Für Eingeloggte: keine Änderung, Aktion läuft normal.

Betroffene Interaktionen: Abstimmen (Umfragen im Feld tauchen für Gäste ohnehin nicht auf), Abonnieren (Verein/Gewerbe), Melden/Report, Kommentieren, „Mängel melden“.

### 5. Navigation

`BottomNav` bekommt `isGuest`:
- Geschützte Ziele (Mängel, Frag BM) werden für Gäste zu Login-Wall-Auslösern statt toten Links.
- Persistente **„Anmelden“**-Aktion: Header-Button auf Gast-Seiten + Login-Karte auf Home.

## Fehlerbehandlung

- Gast ruft geschützte Route direkt auf (z. B. `/umfragen`) → Middleware-Redirect auf `/login` (bestehendes Verhalten).
- Gast löst geschützte Interaktion aus → Login-Wall (kein harter Redirect mitten in der Aktion).
- Kein Tenant auflösbar (Apex-Domain, `slug === null`) → bestehendes Verhalten (Redirect auf `/homepage`).
- Query-Fehler bei fehlenden anon-Grants → würde 42501 werfen; deshalb ist die DB-Migration Teil dieses Designs und wird vor/mit den Seitenänderungen ausgeliefert.

## Tests

- **Middleware:** Gast-Routen ohne Cookie erreichbar; geschützte Routen ohne Cookie → Redirect `/login`; `x-gemeinde-slug` wird für Gast-Routen gesetzt.
- **Feed (Gast):** rendert mit Null-User, ohne Umfrage-Karten, ohne Abo-/Teilnahme-Queries.
- **Gast-Seiten:** veranstaltungen / abfallkalender / vereine / lokale-angebote rendern über `getGemeinde()` ohne Session.
- **LoginWall:** öffnet bei geschützter Aktion, fängt Fokus, stellt Fokus wieder her, Links tragen `next`-Parameter.
- **DB:** anon kann die neu freigegebenen Tabellen lesen, aber nicht schreiben.
- **Manuell:** `ehningen.localhost:3000/feed` mit gelöschten Cookies laden; Durchklick durch alle Gast-Seiten; geschützte Aktion → Wall; „Anmelden“ → `/login?next=…`.

## Offene Punkte / bewusste Entscheidungen

- Umfrage-Karten werden für Gäste **ausgeblendet** (konsistent mit Umfragen = login-pflichtig). Alternative (verworfen für v1): read-only als Conversion-Köder anzeigen.
- `/home` ist gast-zugänglich als Hub; geschützte Kacheln hinter der Login-Wall.
- DB bleibt für anon strikt lesend.
