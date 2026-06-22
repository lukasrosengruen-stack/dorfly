# Warnmeldungen — Design-Spec

**Datum:** 2026-06-22  
**Status:** Approved

---

## Überblick

Neue Feature-Kachel „Warnmeldungen" auf der Dorfly-Startseite. Warnmeldungen können manuell von der Verwaltung erstellt oder automatisch vom Deutschen Wetterdienst (DWD via Bright Sky API) importiert werden. Bei aktiver Warnung erscheint ein roter Querbanner auf der Startseite.

---

## Datenbankschema

### Posts-Tabelle erweitern

```sql
ALTER TYPE post_channel ADD VALUE 'warnung';

ALTER TABLE public.posts
  ADD COLUMN dwd_id     text,
  ADD COLUMN severity   smallint,     -- 1=Minor 2=Moderate 3=Severe 4=Extreme
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN is_active  boolean NOT NULL DEFAULT true;

-- Verhindert doppeltes Anlegen derselben DWD-Warnung
CREATE UNIQUE INDEX posts_dwd_id_unique ON public.posts(dwd_id)
  WHERE dwd_id IS NOT NULL;
```

`author_id` wird für DWD-Posts nullable gemacht (systemgenerierte Posts haben keinen menschlichen Autor):

```sql
ALTER TABLE public.posts ALTER COLUMN author_id DROP NOT NULL;
```

Im Frontend wird für Posts ohne `author_id` „DWD / Deutscher Wetterdienst" angezeigt.

### Gemeinden-Tabelle erweitern

```sql
ALTER TABLE public.gemeinden
  ADD COLUMN warncell_id text;  -- z.B. 'DE-BW-08135000'
```

### Grants

Keine neuen Grants nötig — bestehende Grants aus `012_explicit_grants.sql` decken die neuen Spalten auf `posts` und `gemeinden` ab.

---

## DWD-Automatisierung

### Route

`GET /api/cron/dwd-warnmeldungen`

Geschützt via `CRON_SECRET` Bearer-Token (identisch zu `/api/cron/abfall-benachrichtigungen`).

### Vercel Cron

```json
{
  "path": "/api/cron/dwd-warnmeldungen",
  "schedule": "*/10 * * * *"
}
```

> **Hinweis**: `*/10 * * * *` erfordert Vercel Pro-Plan. Auf dem Hobby-Plan ist das kürzeste Intervall täglich.

### Ablauf

1. Alle Gemeinden mit `warncell_id IS NOT NULL` laden
2. Pro Gemeinde: `GET https://api.brightsky.dev/alerts?warn_cell_id={warncell_id}`
3. Filtern: nur Alerts mit `severity >= 2`
4. **Neue Warnungen** (`dwd_id` noch nicht in `posts`):
   - Post anlegen: `channel='warnung'`, `author_id=NULL`, `pinned=true`, `is_active=true`
   - `titel`: `"Unwetterwarnung: {event}"` (event = DWD-Eventname, z.B. „Starkregen")
   - `inhalt`: DWD-Beschreibung + Gültigkeitszeitraum
   - Push-Notification senden (direkt via OneSignal REST API, Filter nach `gemeinde_slug`)
5. **Bestehende Warnungen** (`dwd_id` bereits in `posts`): keine Aktion
6. **Entwarnungen**: Posts mit `channel='warnung'`, `dwd_id IS NOT NULL`, `is_active=true`, deren `dwd_id` nicht mehr in der DWD-Antwort steht → `is_active=false`

### Push-Notification-Payload

```json
{
  "app_id": "...",
  "filters": [{ "field": "tag", "key": "gemeinde_slug", "relation": "=", "value": "{slug}" }],
  "headings": { "de": "Unwetterwarnung", "en": "Unwetterwarnung" },
  "contents": { "de": "{titel}", "en": "{titel}" },
  "url": "{APP_URL}/warnmeldungen"
}
```

---

## Verwaltungs-UI

### Zugriffsschutz

Nur Rolle `verwaltung`. `super_admin` hat keinen Zugriff auf diesen Bereich.

### Übersichtsseite `/admin/dashboard/warnmeldungen`

- Tabelle aller Posts mit `channel='warnung'`
- Aktive Warnungen oben, inaktive darunter
- Spalten: Titel, Quelle (Manuell / DWD), Schweregrad, Erstellt am, Status
- Manuelle Warnungen (`dwd_id IS NULL`): „Deaktivieren"-Button → ruft `POST /api/warnmeldungen/deaktivieren` auf (service_role), setzt `is_active=false`
- DWD-Warnungen (`dwd_id IS NOT NULL`): schreibgeschützt, nur Anzeige

> **Hinweis RLS**: Die bestehende Update-Policy auf `posts` prüft `author_id = auth.uid()`. Da Verwaltungs-User auch fremde manuelle Warnungen deaktivieren können müssen, erfolgt die Deaktivierung über eine eigene API-Route mit service_role-Client (umgeht RLS). Zugriffsschutz dieser Route: nur Rolle `verwaltung`.
- Button „+ Neue Warnmeldung"

### Formular `/admin/dashboard/warnmeldungen/neu`

Felder:
- **Titel** (text, required)
- **Beschreibung** (textarea, required)
- **Schweregrad** (select): Hinweis (1) / Warnung (2) / Starke Warnung (3) / Extreme Warnung (4)
- **Push-Benachrichtigung senden** (checkbox, Standard: aktiviert)

Beim Absenden:
1. Post anlegen: `channel='warnung'`, `author_id=eingeloggter User`, `is_active=true`, `dwd_id=NULL`
2. Wenn Push-Checkbox aktiviert: `POST /api/notifications/send` aufrufen

Formular-Pattern: `react-hook-form` + `zod` + `@hookform/resolvers` (wie alle anderen Formulare im Projekt).

---

## Frontend

### Startseite `/home`

**1. Normale Kachel** (immer sichtbar, im bestehenden 2-Spalten-Grid):

```typescript
{ href: '/warnmeldungen', label: 'Warnmeldungen', icon: ShieldAlert, ... }
```

- Ruhezustand: neutrales Grau (`color: '#475569'`, `bg: 'rgba(71,85,105,0.1)'`)
- Aktive Warnung: Rot (`color: '#dc2626'`, `bg: 'rgba(220,38,38,0.1)'`) + roter Badge
- Feature-Gate: keine (Kachel immer sichtbar, auch ohne `warncell_id`)

**2. Querbanner** (nur bei aktiver Warnung, oberhalb des Grids):

Identisches Layout wie der bestehende Dashboard-Banner, aber in Rot. Zeigt Titel der aktuellsten aktiven Warnung. Links zu `/warnmeldungen`.

```tsx
{activeWarnung && (
  <Link href="/warnmeldungen"
    className="bg-red-600 text-white rounded-[18px] p-[15px_14px] flex items-center gap-3 ...">
    <ShieldAlert ... />
    <div>
      <p className="font-bold text-[13px]">{activeWarnung.titel}</p>
      <p className="text-[11px] opacity-80">Aktive Warnung · Details ansehen</p>
    </div>
    <ChevronRight ... />
  </Link>
)}
```

Die Warndaten werden serverseitig beim Laden der Startseite abgerufen (Server Component).

### Warnmeldungen-Seite `/warnmeldungen`

- Nur Posts mit `channel='warnung'` und `is_active=true`
- Sortierung: neueste zuerst
- Pro Eintrag: Schweregrad-Badge (farbig), Titel, Beschreibung, Zeitstempel, Quelle (Manuell / DWD)
- Keine Archiv-Ansicht inaktiver Warnungen

---

## Dateistruktur (neu)

```
supabase/migrations/
  040_warnmeldungen.sql            -- posts + gemeinden Erweiterungen

src/app/
  (app)/warnmeldungen/
    page.tsx                       -- Öffentliche Warnmeldungen-Liste
  (admin)/dashboard/warnmeldungen/
    page.tsx                       -- Admin-Übersicht
    neu/
      page.tsx                     -- Neues-Warnmeldung-Formular
  api/cron/dwd-warnmeldungen/
    route.ts                       -- DWD-Polling-Cron
  api/warnmeldungen/deaktivieren/
    route.ts                       -- Manuelle Deaktivierung (service_role, nur verwaltung)
```

---

## Offene Punkte / Nicht in Scope

- Archiv vergangener (inaktiver) Warnungen — bewusst weggelassen, hält es einfach
- Push-Benachrichtigung bei Entwarnung — nicht spezifiziert, nicht implementiert
- Mehrsprachigkeit der DWD-Inhalte — DWD liefert Deutsch, wird direkt verwendet
