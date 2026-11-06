# SSO für Bürger: Anmeldung mit Apple und mit Google

**Datum:** 2026-11-05
**Betrifft:** neue Migrationen `069`–`070`, `src/app/(auth)/login/*`, neue Route
`src/app/(auth)/registrierung-abschliessen/*`, `src/app/auth/callback/route.ts`,
`src/lib/profil-anlegen.ts`, `src/middleware.ts`, `src/lib/kontoLoeschen.ts`,
`src/app/api/auth/loeschen`,
`src/app/(app)/profil/ProfilClient.tsx`, `capacitor.config.ts`, iOS- und
Android-Projekt, `/konto-loeschen`, Datenschutzerklärung, Store-Angaben

## Status: zurückgestellt am 2026-11-06

Nicht verworfen, vertagt. Entschieden nach einer Aufwand-Nutzen-Abwägung, nicht aus
technischen Gründen.

**Warum vertagt:** Dorfly ist noch nicht live, es gibt also keine Abbruchzahlen bei der
Registrierung, an denen sich der Nutzen messen ließe. Der Gastmodus nimmt der
Registrierung ohnehin einen Teil des Drucks. Der laufende Betriebsaufwand wäre dauerhaft:
Apples Client Secret muss alle sechs Monate manuell erneuert werden, sonst bricht der
Login.

**Voraussetzungen für die Wiederaufnahme:**

1. Launch durch, erste Gemeinde produktiv.
2. Getrennte Entwicklungsumgebung vorhanden.
3. Zahlen zur Registrierung liegen vor und zeigen Abbrüche, die ein Passwort erklären
   könnte.

**Vorher zu klären, in dieser Reihenfolge:**

1. **App-Store-Richtlinie 4.8.** Genügt der bestehende E-Mail-und-Passwort-Login als
   gleichwertige Option, oder verlangt Apple bei vorhandenem Google-Login zusätzlich
   „Sign in with Apple"? Davon hängt alles ab: Wenn ja, zieht der billige Teil (Google im
   Web) den teuren (Apple samt rotierendem Secret, Private Relay, Token-Widerruf)
   zwangsläufig mit. Diese Frage wurde in dieser Arbeit **nicht** geklärt.
2. **BundID zuerst prüfen.** Für eine kommunale Plattform ist BundID der
   sektorangemessene Anbieter. Gemeinden und ihre Datenschutzbeauftragten fragen danach,
   nicht nach Google. Ein Bürger-Login über einen US-Anbieter kann im Vertriebsgespräch
   eine Diskussion auslösen. Möglicherweise ist BundID der bessere erste Schritt und
   dieser Spec damit die falsche Reihenfolge.
3. **Apple-Nonce nativ:** roh oder gehasht, siehe „Verifizierte Anbieter-Details".
4. **Supabase-Verhalten** bei einer E-Mail, die schon als unbestätigtes Passwortkonto
   existiert, siehe „Kontoverknüpfung bei gleicher E-Mail".

**Was aus dieser Arbeit bereits umgesetzt ist** und unabhängig von SSO bestehen bleibt:
die Prüfung des `next`-Parameters im Auth-Callback (`src/lib/sichererPfad.ts`). Siehe
`docs/superpowers/plans/2026-11-05-sso-vorarbeiten.md`, Task 1.

Alles unterhalb dieser Zeile ist der Stand vom 2026-11-06 und beim Wiederaufnehmen gegen
den Code zu prüfen. Besonders die Anbieter-Details veralten.

## Ziel und Abgrenzung

Bürger können sich mit Apple oder mit Google anmelden. E-Mail und Passwort bleiben
gleichwertig erhalten, der Gastmodus bleibt unverändert. Nicht im Umfang: Meta, BundID,
SSO für die Verwaltung, SSO beim Annehmen einer Einladung.

## Ist-Zustand

Belegt durch Codeanalyse am 2026-11-05.

**Kein Auth-Trigger.** Es gibt keinen Trigger auf `auth.users`, kein `handle_new_user`.
Die Profilanlage passiert ausschließlich in `profilAnlegen()`
(`src/lib/profil-anlegen.ts`), aufgerufen aus `/auth/callback`, `/api/setup-profil` und
`/api/auth/registrieren`. Die Funktion ist idempotent (sie kehrt zurück, wenn das Profil
existiert). Es gibt damit keine Datenbanklogik, die Registrierungsmetadaten erwartet und
bei SSO ins Leere liefe.

**Gemeindezuordnung ist bereits serverseitig.** `src/middleware.ts` löscht einen vom
Client mitgeschickten `x-gemeinde-slug` und setzt ihn neu aus dem Host.
`profilAnlegen` nimmt entweder `einladung.gemeinde_id` (Token) oder den Slug aus diesem
Header. Eine Mandanten-ID aus dem Client wird nirgends übernommen.

**Cookies über Subdomains.** Browser-Client, Server-Client und Middleware setzen in
Produktion durchgängig Domain `.dorfly.de`. Der PKCE-Verifier liegt damit auf allen
Subdomains und übersteht den Anbieter-Roundtrip. Es ist kein Zusatzaufwand nötig.

**Rechtstexte heute.** Zwei unvorbelegte Checkboxen in `RegisterForm.tsx`, geprüft mit
react-hook-form und Zod, Zeitstempel und `TERMS_VERSION` gehen über
`signUp options.data` in `user_metadata` und von dort in `profiles.terms_accepted_at`,
`terms_version`, `age_confirmed_at`.

**Native.** Die App lädt `https://dorfly.de/start` remote über `server.url`,
`allowNavigation: ['*.dorfly.de']`. Keine Deep Links: Das AndroidManifest hat nur den
LAUNCHER-Intent-Filter, `App.entitlements` nur `aps-environment`. Keine OAuth-Plugins.
Weil `server.url` remote lädt, erreichen Web-Änderungen die veröffentlichten Apps sofort.

**OneSignal.** `OneSignal.login(profile.id)` passiert nur in `ProfilClient.tsx` beim
Aktivieren von Push, nicht beim Anmelden, also unabhängig vom Anmeldeweg.
`PushNotificationInit.tsx` ist toter Code und nirgends gerendert.

### Zwei Befunde, die den Auftrag korrigieren

1. **Open Redirect in `/auth/callback`.** `new URL(next, targetOrigin)` ohne Prüfung.
   Bei `next=https://evil.example` gewinnt die absolute URL, der Nutzer wird samt frisch
   gesetzter Session-Cookies dorthin geleitet. Die Login-Seite validiert `next` mit
   `/^\/(?!\/)/`, der Callback nicht. Unabhängig von SSO, wird hier mitbehoben, weil SSO
   genau diesen Pfad nutzt.
2. **`signOut()` in `ProfilClient.tsx` ruft `oneSignalAbmelden()` nicht auf**, anders als
   der Löschpfad. Auf einem geteilten Gerät behält OneSignal die `external_id` des
   Vorgängers.

**Korrigiert am 2026-11-06.** Hier stand ein dritter Befund: die Namenspflicht bei Fragen
sei nicht vorhanden. Das war falsch und beruhte darauf, dass ich nur die ersten 120 Zeilen
von `BuergermeisterClient.tsx` gelesen hatte. Der Hinweis mit Link ins Profil und der
gesperrte Senden-Knopf stehen in beiden Bereichen, `GemeinderatClient.tsx:412` und
`BuergermeisterClient.tsx:136`. Über die Oberfläche ist der Fall abgedeckt. Offen bleibt
allein, dass die Prüfung clientseitig ist und sich durch einen direkten Aufruf von
PostgREST mit eigenem Token umgehen lässt. Das erlebt kein Nutzer, und SSO braucht es
nicht. Siehe „Nicht im Umfang".

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Testumgebung | **ein Supabase-Projekt**, Test auf `musterbach.dorfly.de` und `ehningen.dorfly.de`, Buttons hinter `NEXT_PUBLIC_SSO_AKTIV` |
| Native Anmeldung | **`signInWithIdToken`** mit nativen Plugins, nicht Systembrowser plus Deep Link |
| Rechtstexte bei SSO | **eigene Abschlussseite** nach dem Anbieter, kein Consent-Cookie vor der Weiterleitung |
| Einladungen per SSO | **nein in Phase 1**, SSO-Buttons bei `?token=` ausgeblendet |
| Rolle bei SSO | immer `buerger`, ohne Ausnahme |
| Provider-Daten | Scope nur `email`, **kein** Name, **kein** Profilbild |
| Anrede in neuen Texten | **personenneutral**, Du-Form im Bestand bleibt unverändert |
| Apple-Revoke schlägt fehl | **Löschung abbrechen**, `invalid_grant` zählt als Erfolg |
| Apple-Refresh-Token | eigene Tabelle, nur `service_role`, **AES-GCM anwendungsseitig verschlüsselt** |
| Verwaiste Auth-Zeilen | **Cron löscht** profillose Konten nach 24 Stunden |
| Namenspflicht | **nicht in dieser Arbeit**, über die Oberfläche bereits abgedeckt |
| Ausrollen | Umgebungsvariable `NEXT_PUBLIC_SSO_AKTIV`, kein Gemeinde-Feature-Flag |

## Abläufe

### Web und PWA

1. Nutzer ist auf `gemeinde.dorfly.de/login`. Die SSO-Buttons erscheinen nur hier, nicht
   auf der Apex-Domain (dort ist `slug === null`) und nicht bei `?token=`.
2. `signInWithOAuth({ provider, options: { redirectTo: `${origin}/auth/callback`, scopes: 'email' } })`.
   Weil `redirectTo` die aktuelle Subdomain ist, landet der Rücksprung automatisch auf der
   richtigen Subdomain. State und PKCE verwaltet GoTrue.
3. `/auth/callback` tauscht den Code wie bisher. **Neu:** `next` wird vor dem Redirect auf
   interne Pfade geprüft, identisch zur Login-Seite.
4. Existiert kein Profil, wird **nicht** angelegt, sondern auf
   `/registrierung-abschliessen` weitergeleitet.

Supabase-Allowlist: genau `https://*.dorfly.de/auth/callback` plus lokale Varianten. Kein
offeneres Muster, kein freier Pfad.

### Native, Capacitor

Die App ist die WebView, die `dorfly.de` lädt. Ein Plugin-Aufruf passiert im selben
JS-Kontext wie der Supabase-Browser-Client, deshalb landet die Session direkt in den
WebView-Cookies. **Es gibt kein Session-Übergabeproblem.**

1. Nonce erzeugen, SHA-256 an den Anbieter, Rohwert an Supabase.
2. Apple über `@capacitor-community/apple-sign-in` (nativer Dialog, `ASAuthorizationController`),
   Google über ein Capacitor-Google-Plugin mit eigener iOS- und Android-Client-ID.
3. `supabase.auth.signInWithIdToken({ provider, token, nonce })`.
4. Weiter wie im Web: kein Profil, also `/registrierung-abschliessen`.

Verworfen: Systembrowser (`ASWebAuthenticationSession`, Chrome Custom Tab) plus Deep
Link. Es bräuchte Associated Domains, App Links mit `assetlinks.json` pro Host, wobei
Wildcard-Hosts unter Android nicht automatisch verifizierbar sind, einen
`appUrlOpen`-Listener und den Code-Austausch nach dem Rücksprung. Deutlich mehr bewegliche
Teile für dasselbe Ergebnis. Bleibt als Rückfallebene dokumentiert, falls sich das
Google-Plugin als unzuverlässig erweist.

### Abschlussseite `/registrierung-abschliessen`

Erreichbar nur mit Session **ohne** Profil. Formular mit react-hook-form und Zod:

- Vorname und Nachname, Pflicht. Löst zugleich das Apple-Namensproblem, denn Apple
  liefert den Namen nur bei der allerersten Autorisierung oder nie.
- Checkbox Alter, unvorbelegt, Label wörtlich wie heute: „Ich bin mindestens 16 Jahre alt."
- Checkbox Rechtstexte, unvorbelegt, Label wörtlich wie heute.
- Schaltfläche „Abbrechen und abmelden" ruft `signOut()` und führt zurück zu `/login`.

`POST /api/auth/sso-abschluss` prüft Session, validiert mit Zod und ruft `profilAnlegen`
mit `rolle = 'buerger'`, `gemeinde_id` **ausschließlich** aus `x-gemeinde-slug`. Niemals
aus dem Request-Body. Zeitstempel und `TERMS_VERSION` entstehen serverseitig.

Warum nicht Consent vor der Weiterleitung zum Anbieter: Der Nachweis wäre an ein Cookie
gebunden statt an den authentifizierten Nutzer, und der Name müsste trotzdem separat
erfragt werden.

**Offen benannt:** Zwischen Rücksprung und Abschluss existiert eine `auth.users`-Zeile
ohne Profil. Diese Person kann die App nicht benutzen, `withAuth` gibt ohne Profil 401
und das Layout leitet um. Ein Abbruch hinterlässt also keinen nutzbaren Zugang, aber eine
leere Auth-Zeile, die die E-Mail-Adresse belegt. Dagegen der Cron unten.

### Gate für Session ohne Profil

`src/middleware.ts` und `(app)/layout.tsx` leiten eine Session ohne Profil auf
`/registrierung-abschliessen`. Die Seite selbst und `/login` sind davon ausgenommen,
sonst entsteht eine Schleife. Ohne dieses Gate sähe ein SSO-Nutzer nach Abbruch eine
kaputte App statt eines klaren Zustands.

### Kontoverknüpfung bei gleicher E-Mail

GoTrue verknüpft eine neue OAuth-Identität mit einem bestehenden Konto, wenn die E-Mail
übereinstimmt und bestätigt ist. **Das exakte Verhalten bei unbestätigter E-Mail wird im
Projekt empirisch geprüft und hier nachgetragen, bevor SSO freigeschaltet wird.**

Zielbild: Verknüpfung nur bei bestätigter Anbieter-E-Mail und bestätigtem Bestandskonto.
Sonst keine automatische Verknüpfung, sondern der Hinweis, sich zuerst mit Passwort
anzumelden und den Anbieter danach im Profil über `linkIdentity` zu verknüpfen. Eine
Kontoübernahme über eine unbestätigte Adresse ist damit ausgeschlossen.

Apples Weiterleitungsadressen (`@privaterelay.appleid.com`) kollidieren mit keinem
Bestandskonto, dort findet keine Verknüpfung statt. Das ist korrekt und gewollt.

### Abmelden

`signOut()` in `ProfilClient.tsx` ruft künftig zuerst `oneSignalAbmelden()`, dann
`supabase.auth.signOut()`. Gleiches Verhalten für alle Anmeldewege.

### Kontolöschung mit Apple

Apple verlangt beim Löschen einen Aufruf von `https://appleid.apple.com/auth/revoke`.
Supabase speichert `provider_refresh_token` nicht dauerhaft, er kommt genau einmal nach
der Anmeldung zurück. Deshalb eigene Ablage.

Neue Reihenfolge in `loescheKonto()`:

1. **Apple-Token widerrufen**, falls eine Apple-Identität existiert. Client Secret als
   JWT aus dem `.p8`-Key, `client_id` je nach Herkunft Services ID (Web) oder Bundle ID
   (native), deshalb wird sie mitgespeichert. Zwei Versuche. `invalid_grant` zählt als
   Erfolg, der Token war dann schon ungültig. Jeder andere Fehler bricht ab, das Konto
   besteht weiter, die Person kann es erneut versuchen. Das entspricht dem bestehenden
   Alles-oder-nichts aus Migration 064.
2. OneSignal, Storage, `konto_loeschen()` wie bisher.

## Datenmodell

### Reihenfolge der Migrationen

`069` und `070` können gemeinsam laufen, beide sind rein additiv: eine neue Tabelle und
eine erweiterte Funktion. Keine der beiden ändert bestehendes Verhalten, keine berührt
eine bestehende Policy.

### Tabelle `einladungen`, nicht in dieser Arbeit

Die Tabelle wurde manuell im Dashboard angelegt und hat keine Migration. Eine
nachgezogene Migration lässt sich nicht erraten, Spalten, Defaults, Constraints und
Indizes müssten aus dem laufenden Projekt gelesen werden. Weil die Arbeit gegen genau
dieses Projekt läuft, fehlt ihr hier jeder Nutzen, sie wäre allein Dokumentation. Das
Vorgehen für später steht in `docs/superpowers/plans/2026-11-05-sso-vorarbeiten.md`
unter „Nicht in diesem Plan".

### Migration `069_apple_identity_tokens.sql`

```
create table public.apple_identity_tokens (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  client_id       text not null,
  refresh_token   text not null,   -- AES-GCM, Schlüssel aus APPLE_TOKEN_ENC_KEY
  created_at      timestamptz not null default now()
);
alter table public.apple_identity_tokens enable row level security;
-- bewusst keine Policy für anon und authenticated: nur der Server fasst das an
grant select, insert, update, delete on public.apple_identity_tokens to service_role;
```

Kein `grant` an `anon` oder `authenticated`, keine Policy, kein Lesepfad über PostgREST.

### Migration `070_konto_loeschen_apple.sql`

`konto_loeschen()` in der Fassung aus 065 wird um
`delete from public.apple_identity_tokens where user_id = p_user_id;` vor dem Löschen von
`auth.users` ergänzt. Der Cascade würde das ohnehin erledigen, explizit ist es lesbarer
und überlebt eine spätere Änderung des Fremdschlüssels. `search_path = ''` bleibt.

### Cron für verwaiste Konten

`/api/cron/verwaiste-konten` löscht über `service_role` Auth-Nutzer ohne Profil, die älter
als 24 Stunden sind. Eintrag in `vercel.json` analog den bestehenden Cron-Routen.

## Oberfläche

Reihenfolge auf `/login`: E-Mail und Passwort bleiben oben, darunter eine Trennlinie mit
„oder", darunter Apple, darunter Google, beide volle Breite und gleiche Gewichtung.

Gestaltungsvorgaben: Apple schwarz, weiß oder Outline mit dem offiziellen Logo und der
Beschriftung „Mit Apple anmelden", ohne eigene Formulierung. Google mit dem offiziellen
G-Mark, Beschriftung „Mit Google anmelden", keine Umfärbung, hell- und dunkelvariante
nach Vorgabe. Logos als lokale SVG, nicht von Anbieter-CDN.

### Barrierefreiheit

- Echte `<button>`, kein `div onClick`. Sichtbarer Fokusring.
- Logo im Button `aria-hidden="true"`, weil die Beschriftung sichtbar daneben steht.
- `aria-busy` während der Anmeldung, Beschriftung wechselt nicht den Wortlaut.
- Fehler in `role="alert"`. Abbruch im Anbieter-Dialog ist **kein** Fehler: zurück zum
  Formular, neutrale Statuszeile, kein rotes Alert.
- Abschlussseite mit `export const metadata` und aussagekräftigem Titel, verknüpfte
  `<label>` für alle Felder, Fehlertexte über `aria-describedby`.
- Texte ohne Gendern, ohne Gedankenstriche, personenneutral.

## Sicherheit

- `next` im Callback auf interne Pfade prüfen. Behebt den bestehenden Open Redirect.
- Redirect-Allowlist exakt, Site URL exakt. Keine Wildcard im Pfad.
- State und PKCE im Web durch GoTrue. Native Nonce selbst erzeugt, gehasht an den
  Anbieter, roh an Supabase.
- Cookies bleiben `SameSite=Lax` auf `.dorfly.de`. Der OAuth-Rücksprung ist eine
  Top-Level-Navigation per GET, Lax genügt. Kein `SameSite=None`.
- Secrets nur in Vercel-Umgebungsvariablen und im Supabase-Dashboard. Im Client-Bundle
  steht nur `NEXT_PUBLIC_SSO_AKTIV` und die nativen Client-IDs, die nicht geheim sind.
- Apples Web-Client-Secret ist ein JWT mit **maximal 6 Monaten** Gültigkeit und wird von
  Supabase nicht rotiert. Ein Skript `scripts/apple-client-secret.mjs` erzeugt es, die
  Anleitung nennt den Erneuerungstermin.

## Datensparsamkeit

Scope bei Google nur `email`, bei Apple nur `email`. Ohne `profile` beziehungsweise
`name` senden die Anbieter Name und Bild gar nicht. Zusätzlich ignoriert `profilAnlegen`
bei SSO jedes Provider-Feld und nimmt Namen nur aus dem eigenen Formular. Kein Avatar,
keine weiteren Profildaten.

Was GoTrue in `auth.identities.identity_data` und `raw_user_meta_data` ablegt, können wir
nicht verhindern. Der wirksame Hebel ist der Scope. Diese Felder liegen im `auth`-Schema
und sind über PostgREST nicht lesbar.

## Tests

### Automatisiert, Vitest

- Nonce-Erzeugung und SHA-256-Hash
- Apple Client Secret JWT: Header, Claims, Ablauf nicht über 6 Monate
- Apple-Revoke: Erfolg, `invalid_grant` als Erfolg, Netzwerkfehler als Abbruch
- `next`-Validierung im Callback, inklusive `https://evil.example` und `//evil.example`
- Zod-Schema der Abschlussseite, beide Checkboxen Pflicht, Name Pflicht
- `loescheKonto` mit und ohne Apple-Identität, mit Fake-`fetch`
- `profilAnlegen` bei SSO: Provider-Name wird nicht übernommen
- Sichtbarkeit der SSO-Buttons: nicht auf Apex, nicht bei `?token=`

### Automatisiert, PGlite

- Grants auf `apple_identity_tokens`: `anon` und `authenticated` kommen nicht heran
- `konto_loeschen()` mit Zeile in `apple_identity_tokens`

### Manuell auf `musterbach.dorfly.de` und `ehningen.dorfly.de`

Musterbach ist die Testkommune, Ehningen die zweite Subdomain für die
Mandantentrennung. Dort entsteht nur ein Testkonto, das nach dem Test wieder gelöscht
wird. Bestehende Daten werden nicht angefasst.

Neuregistrierung und erneuter Login mit Apple und mit Google, Musterbach gegen Ehningen
inklusive Mandantentrennung, bestehendes Passwortkonto mit gleicher
E-Mail, Apple-Weiterleitungsadresse auch beim Mailversand über Resend, Abbruch im
Anbieter-Dialog, Abmelden und Anmelden mit OneSignal, Kontolöschung inklusive
Apple-Revoke, bestehender E-Mail-und-Passwort-Login als Regression, Einladung für
bestehende Rollen.

### Nicht testbar in dieser Umgebung

iOS- und Android-Gerätetests (Windows, kein macOS, kein Xcode, keine Geräte), echte
Anmeldung bei Apple und Google, Store-Builds. Wird im Schlussbericht namentlich
aufgeführt.

## Verifizierte Anbieter-Details (2026-11-06)

Nachgeprüft an den Primärquellen, weil der Plan sonst auf Vermutungen stünde.

**Supabase-Allowlist, Glob-Regeln.** Trennzeichen sind `.` und `/`. `*` matcht eine Folge
ohne Trennzeichen, also **kein** Punkt und **kein** Schrägstrich. `**` matcht auch
Trennzeichen. Damit trifft `https://*.dorfly.de/auth/callback` genau eine Subdomain-Ebene
und genau diesen Pfad. Mehrstufige Subdomains und zusätzliche Pfadsegmente fallen durch.
Das ist enger als gedacht und genau richtig. `**` wird hier nicht verwendet. Die Site URL
bleibt exakt, das empfiehlt Supabase ausdrücklich.

**Apples Client-ID-Feld, wichtige Reihenfolge.** Es gibt im Supabase-Dashboard **ein**
Feld „Client IDs", kommagetrennt. Wenn Web und native nebeneinander laufen, muss die
**Services ID zuerst** stehen. Steht eine native App ID vorn, lehnt Apple die
Web-Anmeldung ab. Für Dorfly also `<Services ID>,de.dorfly.app` in dieser Reihenfolge.
Auf iOS nimmt das Plugin die Bundle ID automatisch, eine `clientId` wird dort nicht
übergeben.

**Apples Revoke-Endpunkt.** `POST https://appleid.apple.com/auth/revoke`,
`application/x-www-form-urlencoded`, Felder `client_id`, `client_secret`, `token`,
`token_type_hint`. Widerrufen wird ein Refresh- oder Access-Token, **nicht** das Identity
Token. `client_id` muss der Client sein, für den das Token ausgegeben wurde, sonst
`invalid_client`. Das bestätigt, dass die Client-ID neben dem Token gespeichert werden
muss. **Wichtige Einschränkung:** Es gibt Berichte, dass der Endpunkt auch bei ungültigen
Eingaben 200 liefert. Ein 200 ist damit kein Beweis, dass genau dieses Token widerrufen
wurde. Der Löschablauf behandelt 200 weiterhin als Erfolg, protokolliert aber die
Antwort, und die Prüfung am Gerät ist der einzige echte Nachweis.

**Apple-Client-Secret.** Apple verlangt alle 6 Monate ein neues. Supabase nennt die
genaue Ablaufzeit des JWT nicht und rotiert nichts. Ein Erinnerungstermin ist Pflicht.

**Noch offen, nicht geraten:** Beim nativen Apple-Login nimmt das Plugin eine `nonce`
entgegen, die Dokumentation sagt aber nicht, ob roh oder als SHA-256-Hash. Für Google ist
belegt: Hash an das SDK, Rohwert an `signInWithIdToken`. Für Apple ist dasselbe plausibel,
aber unbelegt. Das wird im nativen Plan als erster Gerätetest verifiziert, bevor der Ablauf
festgeschrieben wird.

**Zusätzliche Fallstricke aus der Praxis**, einzuplanen für den nativen Plan: Das
Google-SDK auf iOS kann ein zwischengespeichertes Token ohne die aktuelle Nonce liefern,
das Supabase dann ablehnt. Und unterschiedliche iOS- und Web-Client-IDs zwischen Google
Cloud und Supabase führen zu Audience-Fehlern.

## Nicht im Umfang

Namenspflicht bei Fragen serverseitig erzwingen: Die Oberfläche deckt den Fall in beiden
Bereichen ab, offen bleibt nur das Umgehen der Oberfläche über einen direkten
PostgREST-Aufruf. Kein Nutzerproblem, für SSO nicht nötig.

Meta und BundID. SSO für Verwaltung und Gemeinderat. Einladungen per SSO. Umstellung des
Login-Bildschirms auf die Sie-Form, angeboten als separater Commit. Rechtstexte selbst
schreiben: dafür wird nur eine sachliche Beschreibung der Datenflüsse geliefert.
