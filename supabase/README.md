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

`seed.sql` enthält erfundene Testdaten: die Gemeinde `testdorf`, je einen Nutzer pro Rolle, Beiträge in allen Status, einen Mangel und eine Frage an den Bürgermeister.

- Lokal läuft es automatisch mit `db start` und `db reset`.
- In die Entwicklung: `supabase db query --remote=vjvnhvwdwxvofwsjcytr --yes -f supabase/seed.sql`
- **Niemals gegen die Produktion**, auch nicht mit `db push --include-seed`. Das Skript bricht ab, sobald es eine andere Gemeinde als `testdorf` findet.
- Die Testnutzer haben kein Passwort. Anmeldung per Magic Link, oder ein Passwort im Dashboard setzen.

## Was zu beachten ist

- **`supabase db pull` nicht gegen die Produktion ausführen.** Der Befehl trägt das Ergebnis in die Migrationshistorie der Zieldatenbank ein.
- **`supabase/migrations_archive/`** enthält die Migrationen vor der Baseline. Sie werden nicht mehr ausgeführt. Die PGlite-Tests lesen vorerst einzelne Dateien daraus.
- **`supabase/backups/`** enthält lokale Dumps und ist von Git ausgeschlossen.
- **Auth-Einstellungen** stehen in `config.toml`, Secrets dort nur als `env(...)`. Sie werden nicht durch Migrationen übertragen.
