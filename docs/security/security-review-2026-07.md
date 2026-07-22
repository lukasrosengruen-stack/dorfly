# Security-Review — Juli 2026

Fokussierter Sicherheits-Review der Dorfly-Anwendung (OWASP Top 10 + Multi-Tenant-Isolation).
Alle unten als **behoben** markierten Punkte sind auf `master` gemergt; die DB-Migrationen
057 und 058 wurden auf Produktion angewendet.

## Threat-Model-Kernannahme

Supabase exponiert PostgREST unter `NEXT_PUBLIC_SUPABASE_URL/rest/v1/`. Jeder eingeloggte
Nutzer kann damit **direkt** auf Tabellen zugreifen — an der Next.js-App und der `withAuth`-
Schicht vorbei. Die einzige serverseitige Schranke auf diesem Weg ist **Row Level Security (RLS)**.
Daraus folgt die zentrale Lehre dieses Reviews:

> Eine `UPDATE`/`INSERT`-Policy mit `using`-Bedingung, aber **ohne `with check`** und mit
> **tabellenweitem GRANT**, erlaubt es, autorisierungs- oder tenant-relevante Spalten
> (`role`, `gemeinde_id`, `author_id`, `status`, …) frei zu überschreiben.

## Behobene Funde

| # | Schwere | Fund | Fix |
|---|---|---|---|
| 1 | 🔴 Kritisch | **`profiles` Selbst-Escalation → Tenant-Übernahme.** `update`-Grant tabellenweit + Policy ohne `with check` → jeder Nutzer konnte `role='super_admin'` / fremde `gemeinde_id` bei sich selbst setzen. | Migration **057**: spaltenweiser `update`-Grant (ohne `role`/`gemeinde_id`/`email`/…), `insert` entzogen, Policy mit `with check` gehärtet. |
| 2 | 🔴 Hoch | **`posts` Moderations-Bypass & gefälschte Warnmeldungen.** Autor konnte `status='published'` (Freigabe umgehen), `channel='warnung'`+`pinned` (falsche offizielle Warnung), `gemeinde_id` (Tenant-Injection), `author_id` (Spoofing) setzen. | Migration **058**: `insert/update/delete` für `authenticated` entzogen (alle Writes laufen über `service_role`). |
| 3 | 🟠 Mittel | **`organisationen`/`vereine` Gemeinde-Wechsel.** Eigentümer konnte `gemeinde_id` ändern und Eintrag in fremde Gemeinde verschieben. | Migration **058**: `update`-Policies mit `with check` (`profile_id` + `gemeinde_id = current_gemeinde_id()` gepinnt). |
| 4 | 🟠 Mittel | **Einladungs-Token nicht E-Mail-gebunden.** Ein geleakter Einladungslink konnte von einem fremden Konto zur Rollenübernahme genutzt werden. | `src/lib/profil-anlegen.ts`: Einlösung prüft `email === einladung.email`. |
| 5 | 🟡 Niedrig | **`x-gemeinde-slug`-Header-Spoofing** auf der Apex-Domain (Defense-in-Depth). | `src/middleware.ts`: eingehenden Header immer `delete`, nur serverseitig aus Host setzen. |
| 6 | 🟢 Hygiene | **Dependency-Advisories** (21). | `twilio` (ungenutzt) entfernt → axios weg; `npm audit fix`; **Next.js 16.2.4 → 16.2.11** (Middleware-Bypass, XSS, SSRF, Cache-Poisoning gepatcht). |

## Geprüft & sauber (keine Findings)

- **`withAuth`** (`src/lib/api.ts`): validiert JWT via `getUser()`, Rolle aus DB, `gemeinde_id`
  autoritativ aus dem Profil (nicht aus Client-Input).
- **Service-Role-Routen**: durchgängig `.eq('gemeinde_id', profile.gemeinde_id)` → kein IDOR;
  `verwaltung/nutzer/rolle` kann `super_admin` nicht vergeben (Enum schließt es aus).
- **`maengel` (044)** und **`fragen` (047)**: bereits korrekt mit `with check` abgesichert.
- **`umfragen`/`umfrage_fragen`/`umfrage_optionen`**: Policy-Bedingung referenziert eigene
  `gemeinde_id` → Tenant-Wechsel nicht möglich.
- **Cron-Routen**: `Authorization: Bearer CRON_SECRET` erforderlich.
- **Registrierung**: Rolle stammt ausschließlich aus validiertem Token, nie aus Client-Metadaten.
- **Rich-Text** (`src/lib/richText.tsx`): React-Rendering + nur `http(s)`-URLs → kein Stored-XSS.
- **Theming-CSS** (`src/lib/buildThemeStyle.ts`): strikte Hex-Validierung → keine CSS-Injection.
- **ICS-Parser** (`src/lib/icsParser.ts`): reiner Text-Parser (kein XML) → kein XXE; SUMMARY nur
  gegen Whitelist gemappt.

## Bewusst offen (kein Handlungsbedarf)

Drei Audit-Einträge (`sharp`/libvips, `postcss`, `serialize-javascript`) sind von Next.js bzw.
`next-pwa` gepinnte Build-Bausteine — kein Laufzeitrisiko der App, kein sauberer Fix-Pfad.
`npm audit fix --force` würde `next`/`next-pwa` breaking herunterstufen und ist daher zu vermeiden.
Diese lösen sich mit künftigen Next.js-Updates automatisch.

## Konvention für neue Migrationen

Beim Anlegen einer Tabelle mit Schreibzugriff für `authenticated`:

1. **Spaltenweise** `grant update (…)` statt tabellenweit — autorisierungs-/tenant-relevante
   Spalten (`role`, `gemeinde_id`, `author_id`, `status`, …) ausschließen.
2. `update`/`insert`-Policies **immer** mit `with check`, nicht nur `using`.
3. Tenant-Bindung über `with check (gemeinde_id = public.current_gemeinde_id())`
   (Muster siehe 044/047/058).
4. Wenn eine Tabelle nur über `service_role`-Routen beschrieben wird: `authenticated` gar kein
   Schreibrecht geben (Muster siehe `posts` in 058).
