# Supabase bei Dorfly

Schemaänderungen laufen ausschließlich über Migrationen in diesem Ordner. **Im Dashboard werden keine Tabellen, Spalten, Policies, Funktionen oder Rechte mehr von Hand geändert.** Eine Änderung, die nur im Dashboard passiert, fehlt in jeder anderen Umgebung und im Repo.

## Projekte

| Umgebung | Projekt-Ref | Zweck |
|---|---|---|
| Entwicklung (`dorfly-dev`) | `vjvnhvwdwxvofwsjcytr` | Testen. Das Repo ist hierauf verknüpft. |
| Produktion (`Dorfly-production`) | `hzptnylfdfibijkgtfhf` | Echte Daten. Nur mit expliziter Ref ansprechen. |

Die CLI läuft über `npx --yes supabase@3.0.0` (unten kurz `supabase`). Die Befehle arbeiten ohne `--remote` gegen die **lokale** Datenbank. `--remote` ohne Wert meint das verknüpfte Projekt, also die Entwicklung.

## Ablauf für eine Schemaänderung

1. **Migration anlegen:** `supabase migration new kurzer_name`
2. **SQL schreiben.** Jede Migration enthält explizite `GRANT`s für alle Rollen, die zugreifen (`anon`, `authenticated`, `service_role`). Automatische Rechte gibt es nicht.
3. **Lokal prüfen:** `supabase db start` legt eine frische Datenbank mit allen Migrationen und dem Seed an, `supabase db reset` setzt sie neu auf.
4. **Gegen die Entwicklung testen:**
   ```bash
   supabase db push --remote=vjvnhvwdwxvofwsjcytr --dry-run
   supabase db push --remote=vjvnhvwdwxvofwsjcytr --yes
   ```
5. **Typen aktualisieren:** `npm run db:types:dev`
6. **Gegen die Produktion pushen,** erst wenn die Änderung in der Entwicklung funktioniert. Der Dry-Run muss genau die neue Migration zeigen:
   ```bash
   supabase db push --remote=hzptnylfdfibijkgtfhf --dry-run
   supabase db push --remote=hzptnylfdfibijkgtfhf --yes
   supabase migration list --remote=hzptnylfdfibijkgtfhf
   ```

Eine bereits gepushte Migration wird nie nachträglich geändert. Korrekturen kommen als neue Migration.

## Seeds

`seed.sql` enthält erfundene Testdaten für die Gemeinden `testdorf` und `musterhausen`: je ein Login pro Rolle, 40 Einwohner, 8 Gemeinderäte in drei Fraktionen, 3 Vereine und eine Organisation, 3 Gewerbe, Beiträge, Mängel und Fragen in allen Status, eine Umfrage und Abfalltermine. Der Seed ist wiederholbar.

- Lokal läuft es automatisch mit `db start` und `db reset`.
- In die Entwicklung: `npm run db:seed:dev`. Das Skript liest `SEED_TESTPASSWORT` und `SEED_PLUS_ADRESSE` aus der Shell oder aus `.env.seed.local` (von Git ignoriert). Ein anderes Ziel lässt sich nicht angeben.
- **Niemals gegen die Produktion**, auch nicht mit `db push --include-seed`. Der Seed bricht vor dem ersten Schreiben ab, sobald er eine andere Gemeinde als `testdorf` oder `musterhausen` findet.
- Lokal per `db reset` haben die Testnutzer kein Passwort. Lokal mit Passwort: `npm run db:seed:dev -- --lokal`.

## Was zu beachten ist

- **`supabase db pull` nicht gegen die Produktion ausführen.** Der Befehl trägt das Ergebnis in die Migrationshistorie der Zieldatenbank ein.
- **`supabase/migrations_archive/`** enthält die Migrationen vor der Baseline. Sie werden nicht mehr ausgeführt. Die PGlite-Tests lesen vorerst einzelne Dateien daraus.
- **`supabase/backups/`** enthält lokale Dumps und ist von Git ausgeschlossen.
- **Auth-Einstellungen** stehen in `config.toml`, Secrets dort nur als `env(...)`. Sie werden nicht durch Migrationen übertragen.
- **Auth-Mails von `dorfly-dev`** gehen über einen eigenen Resend-Schlüssel (`env(RESEND_API_KEY_PREVIEW)` im Block `[remotes.dorfly-dev.auth.email.smtp]`). Vor einem `config push --remote=vjvnhvwdwxvofwsjcytr` muss diese Variable in der Shell gesetzt sein. Die Produktion nutzt weiter `env(RESEND_API_KEY)`.
- **Mail und Push in Testumgebungen:** Auf Previews und mit `dorfly-dev` verschickt die App Mails nur an `lukas.rosengruen+…@dorfly.de` und pusht nie (`src/lib/mailVersand.ts`, `src/lib/pushKonfig.ts`). Auth-Mails von Supabase laufen daran vorbei; deshalb enthält `dorfly-dev` nur erfundene Adressen.
- **Preview-Adressen** (`*-dorfly-ug.vercel.app`) stehen nur im Block `[remotes.dorfly-dev]`. Dieser gilt allein für `dorfly-dev`. Die Produktion hat mit `[remotes.production]` einen eigenen Block, der ihren Live-Stand festhält (kein `localhost`, SMS-Bestätigung aktiv). Vor jedem `config push` mit `supabase config diff --remote=<ref>` prüfen.
