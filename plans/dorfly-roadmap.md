# Dorfly – Roadmap & Session-Zusammenfassung

> Zuletzt aktualisiert: 2026-04-29

---

## ⚠️ Anweisung für KI-Assistenten

**Diese Datei muss bei jeder Weiterentwicklung des Projekts aktualisiert werden.**

Konkret bedeutet das:
- Am **Ende jeder Session** das Datum ("Zuletzt aktualisiert") aktualisieren
- Neu abgeschlossene Phasen auf ✅ setzen
- Neue/geänderte Dateien in den jeweiligen Phase-Abschnitt eintragen
- Den Abschnitt "Nächste mögliche Schritte" aktualisieren (abgehaktes entfernen, Neues ergänzen)
- Architektur-Änderungen (neue Ordner, neue Konventionen) dokumentieren

**Wo die Datei liegt:** `plans/dorfly-roadmap.md` (relativ zum Projekt-Root `c:/Users/lukas/dorfly`)

---

## Roadmap-Übersicht

| Phase | Was | Status |
|---|---|---|
| Phase 0 | Fundament stabilisieren (Typen, Auth, Validierung, Performance, Toast) | ✅ Abgeschlossen |
| Phase 1 | Multi-Gemeinde-Routing (Subdomain-Proxy, hardcodiertes 'ehningen' entfernen) | ✅ Abgeschlossen |
| Phase 2 | Web professionalisieren (UI-Library, Feature-Struktur, Server Actions) | ✅ Abgeschlossen + deployed |
| Phase 3 | Monorepo (Turborepo + pnpm, shared packages) | ⏭️ Übersprungen – erst sinnvoll wenn Mobile App gestartet wird |
| Phase 4 | Native Apps (Expo React Native, Auth, Feature-Parity, EAS Build) | ⏳ Ausstehend |

---

## Phase 0 – Fundament ✅

- Typsichere Supabase-Clients (`src/types/supabase.ts`, `src/types/database.ts`)
- Zentrale Auth-Schicht (`src/lib/api.ts` → `withAuth()`)
- Zod-Validierung für alle API-Inputs (`src/lib/validations.ts`)
- Toast-Benachrichtigungen via Sonner
- Performance-Optimierungen (React cache, parallele Datenbankabfragen)

---

## Phase 1 – Multi-Gemeinde-Routing ✅

### Neue/geänderte Dateien

| Datei | Was |
|---|---|
| `src/proxy.ts` | Subdomain-Routing: `ehningen.dorfly.de` → `x-gemeinde-slug: ehningen` Header |
| `src/lib/gemeinde.ts` | `getGemeindeSlug()` + `getGemeinde()` mit React `cache()` |
| `src/types/supabase.ts` | `primary_color` und `ratsinformation_url` zu `gemeinden` Row hinzugefügt |
| `api/auth/registrieren/route.ts` | Nutzt `getGemeindeSlug()` statt inline Header-Lesen |
| `(app)/home/page.tsx` | Gemeindename + Ratsinformationslink aus DB |
| `(app)/layout.tsx` | `--color-primary` CSS-Variable aus `gemeinde.primary_color` |
| `.env.local` | `NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG=ehningen` für lokale Entwicklung |
| Supabase DB | Spalten `primary_color` + `ratsinformation_url` in `gemeinden` + Testgemeinde `musterstadt` |

**Ergebnis:** Neue Gemeinde aufschalten = ein SQL INSERT in `gemeinden`, kein Code-Änderung nötig.

---

## Phase 2 – Web professionalisieren ✅

### Neue Dateien

| Datei | Was |
|---|---|
| `src/lib/cn.ts` | `cn()` Hilfsfunktion – clsx + tailwind-merge kombiniert |
| `src/components/ui/Button.tsx` | Dorfly Button (Varianten: primary/secondary/ghost/danger, Größen: sm/md/lg) |
| `src/components/ui/Card.tsx` | Weiße Box mit Shadow, konfigurierbarem Padding |
| `src/components/ui/PageHeader.tsx` | Blauer Header mit Gemeindename (Gold), Titel, Aktions-Slot, Profil-Link |
| `src/components/ui/EmptyState.tsx` | Standardisierte "Noch keine Einträge"-Komponente mit Icon/Titel/Beschreibung |
| `src/components/ui/Badge.tsx` | Status-Labels (success/warning/danger/info/purple/orange) |
| `src/components/ui/index.ts` | Barrel-Export aller UI-Komponenten |
| `src/features/feed/FeedCard.tsx` | Einzelner Newsfeed-Beitrag (ausgelagert aus FeedClient) |
| `src/features/feed/FeedFilter.tsx` | Filter Bottom-Sheet (ausgelagert aus FeedClient) |
| `src/features/feed/index.ts` | Barrel-Export Feed-Feature |
| `src/features/maengel/MangelKarte.tsx` | Einzelner Mangel-Eintrag (ausgelagert aus MaengelClient) |
| `src/features/maengel/MangelMeldenForm.tsx` | Melden-Formular Modal (ausgelagert, nutzt Button-Komponente) |
| `src/features/maengel/index.ts` | Barrel-Export Mängel-Feature |
| `src/app/actions/profil.ts` | Server Action für Profil-Bearbeitung (`updateProfil()`) |

### Geänderte Dateien

| Datei | Was |
|---|---|
| `(app)/feed/FeedClient.tsx` | 325 → 130 Zeilen – nutzt FeedCard + FeedFilter + PageHeader |
| `(app)/maengel/MaengelClient.tsx` | 244 → 75 Zeilen – nutzt MangelKarte + MangelMeldenForm + EmptyState |
| `(app)/umfragen/UmfragenClient.tsx` | PageHeader + EmptyState ersetzt Inline-Code; `gemeindeName` als Prop |
| `(app)/umfragen/page.tsx` | `getGemeinde()` hinzugefügt, `gemeindeName` weitergegeben |
| `(app)/marktplatz/page.tsx` | `getGemeinde()` statt hardcodiertem "Ehningen" |
| `(app)/profil/ProfilClient.tsx` | `save()` ruft Server Action auf statt Supabase-Client direkt |

---

## Architektur-Prinzipien (Stand Phase 2)

### Import-Konventionen
```typescript
// UI-Komponenten
import { Button, Card, PageHeader, EmptyState, Badge } from '@/components/ui'

// Feature-Komponenten
import { FeedCard, FeedFilter } from '@/features/feed'
import { MangelKarte, MangelMeldenForm } from '@/features/maengel'

// cn() Hilfsfunktion
import { cn } from '@/lib/cn'
```

### Ordnerstruktur
```
src/
  app/                    ← Next.js App Router (Seiten + API-Routes)
    (app)/                ← Bürger-App (Login erforderlich)
    (admin)/              ← Admin-Dashboard
    (auth)/               ← Login/Registrierung
    actions/              ← Server Actions (nur Web, kein Native)
    api/                  ← API-Routes (auch für zukünftige Native App)
  components/
    ui/                   ← Dorfly Design System (Button, Card, etc.)
    layout/               ← BottomNav, SidebarNav
    umfrage/              ← UmfrageCard, UmfrageErstellen
    dashboard/            ← Dashboard-spezifische Komponenten
  features/
    feed/                 ← FeedCard, FeedFilter
    maengel/              ← MangelKarte, MangelMeldenForm
  lib/                    ← Hilfsfunktionen (cn, api, gemeinde, validations)
  types/                  ← TypeScript-Typen (supabase, database, umfrage)
```

### Design-System-Regel
- **Design ändern** → nur `src/components/ui/` anpassen → wirkt automatisch überall
- **Neues Feature** → Ordner unter `src/features/<feature-name>/` anlegen
- **API für Web + Native** → `src/app/api/` (API-Route, kein Server Action)
- **API nur für Web** → `src/app/actions/` (Server Action)

---

## Build-Befehle (Windows PowerShell)

```powershell
# Dev-Server starten
$env:Path += ";C:\Program Files\nodejs"; & "C:\Program Files\nodejs\npm.cmd" run dev

# TypeScript-Check (ohne Build)
"C:\Program Files\nodejs\node.exe" node_modules\typescript\bin\tsc --noEmit

# Build
$env:Path += ";C:\Program Files\nodejs"; & "C:\Program Files\nodejs\npm.cmd" run build

# Git Push (Deployment via Vercel)
git add .; git commit -m "..."; git push
```

---

## Lokales Multi-Tenant-Testing

```
http://localhost:3000/home              → Ehningen (via NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG)
http://musterstadt.localhost:3000/home  → Musterstadt (nach hosts-Eintrag)
```

hosts-Eintrag: `127.0.0.1 musterstadt.localhost`

---

## Nächste mögliche Schritte

### Option A – Marktplatz implementieren
- Neue Datenbank-Tabelle `marktplatz_inserate`
- Bürger können Angebote/Gesuche einstellen (Titel, Kategorie, Beschreibung, Foto, Preis)
- Feature isoliert unter `src/features/marktplatz/`

### Option B – PWA testen
- `next-pwa` ist bereits im Projekt (`package.json`)
- App ist theoretisch schon als PWA installierbar
- Prüfen ob PWA ausreicht bevor native App gebaut wird
- Auf `dorfly.de` aufrufen → Browser → "Zum Startbildschirm hinzufügen"

### Option C – Native App (Phase 3+4)
- Erst Phase 3 (Monorepo) aufsetzen: `apps/web`, `apps/mobile`, `packages/types`
- Dann Phase 4: Expo React Native App mit Auth + Feature-Parity
- Hinweis: Alle API-Routes sind bereits kompatibel (kein fetch-Umbau nötig)

### Option D – Neue Gemeinde aufschalten
- SQL INSERT in `gemeinden`-Tabelle in Supabase
- Subdomain bei Domain-Provider einrichten
- In Vercel: Domain `<slug>.dorfly.de` hinzufügen
