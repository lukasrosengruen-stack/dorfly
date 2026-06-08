# Design Spec: Social Media Links für Gemeinderäte

**Datum:** 2026-06-08  
**Status:** Genehmigt

## Ziel

Gemeinderäte können in ihrem Profil-Dashboard Benutzernamen für X, Facebook, Instagram und TikTok eintragen. In der öffentlichen Gemeinderat-Übersicht erscheinen die entsprechenden Icons neben dem Namen — nur wenn ein Username gesetzt ist. Klicken öffnet das Social-Media-Profil in einem neuen Tab (Universal Links auf Mobile öffnen die jeweilige App).

---

## 1. Datenbank

**Migration:** `035_profiles_social_links.sql`

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS social_x         text,
  ADD COLUMN IF NOT EXISTS social_facebook  text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_tiktok    text;
```

- Alle vier Spalten sind nullable `text` ohne Default-Wert.
- `NULL` = nicht eingetragen; leere Strings sind verboten (API normalisiert).
- Keine neuen GRANTs nötig — bestehende `profiles`-Grants greifen.
- Analog zu `fraktion`, `kontakt_email`, `ueber_mich` (Migration 026).

**URL-Konstruktion** (ausschließlich im Frontend):

| Plattform | URL-Pattern |
|-----------|-------------|
| X | `https://x.com/{username}` |
| Facebook | `https://facebook.com/{username}` |
| Instagram | `https://instagram.com/{username}` |
| TikTok | `https://tiktok.com/@{username}` |

---

## 2. API

**Route:** `PATCH /api/profil/gemeinderat` (bestehend, erweitert)

Vier neue optionale Felder im Zod-Schema:

```ts
social_x:         z.string().max(50).nullable().optional()
social_facebook:  z.string().max(100).nullable().optional()
social_instagram: z.string().max(50).nullable().optional()
social_tiktok:    z.string().max(100).nullable().optional()
```

**Normalisierung** (per `transform`):
- Leerer String → `null`
- Führendes `@` wird entfernt (`@lukas_rosen` → `lukas_rosen`)
- Whitespace wird getrimmt

Kein neuer Endpoint. Die vier Felder werden zusammen mit den bestehenden Profil-Feldern in einem einzigen Supabase-Update geschrieben.

---

## 3. Dashboard (Eingabe)

**Datei:** `src/components/dashboard/GemeinderatDashboard.tsx` — Profil-Tab

Vier neue Eingabefelder unterhalb der bestehenden Felder (Fraktion, Kontakt-Email, Über mich). Jedes Feld hat ein Plattform-Icon links und `placeholder="@username"`.

```
Social Media
[X-Icon]         X / Twitter   [@lukas_rosen     ]
[Facebook-Icon]  Facebook      [@lukas.rosen     ]
[Instagram-Icon] Instagram     [@lukas_rosen     ]
[TikTok-Icon]    TikTok        [@lukas_rosen     ]
```

- Felder sind optional — leer lassen = kein Icon in der öffentlichen Übersicht.
- Formular-Submit entfernt `@`-Präfix und normalisiert leere Strings zu `null`.
- Icons: SVG-Inline aus Brand-Guidelines (keine neue Paketabhängigkeit), falls `lucide-react` die Plattform-Icons nicht vollständig abdeckt.

---

## 4. Öffentliche Übersicht (Anzeige)

**Datei:** `src/app/(app)/gemeinderat/GemeinderatClient.tsx` — Räte & Fragen-Tab

Icons erscheinen **neben dem Namen** (gleiche Zeile), links vom Chat-Icon:

```
[P] Petra Hoffmann  [X] [IG] [TT]              [💬]
    Freie Wähler · Musterbach
```

**Implementierungsdetails:**

- Jedes Icon nur gerendert wenn der jeweilige Username nicht `null`/leer.
- Icons sind `<a href="..." target="_blank" rel="noopener noreferrer">`.
- `aria-label="X-Profil von {name}"` auf jedem Link (WCAG 2.2 AA).
- Icon-Größe: ~18px, Farbe: dezent grau, Hover: plattformfarbig oder einheitlich dunkelgrau.
- Universal Links (iOS) / App Links (Android): Standard `https://`-URLs öffnen automatisch die App, falls installiert.

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/migrations/035_profiles_social_links.sql` | Neu — 4 Spalten auf `profiles` |
| `src/types/database.ts` | `social_x`, `social_facebook`, `social_instagram`, `social_tiktok` zu `Profile`-Typ ergänzen |
| `src/lib/validations.ts` | Profil-Schema um 4 Social-Felder erweitern |
| `src/app/api/profil/gemeinderat/route.ts` | Normalisierung + Persistenz der 4 Felder |
| `src/components/dashboard/GemeinderatDashboard.tsx` | Profil-Tab: 4 Eingabefelder |
| `src/app/(app)/gemeinderat/GemeinderatClient.tsx` | Icons neben Namen rendern |

---

## Nicht im Scope

- Admin-seitige Bearbeitung der Social-Links (nur Gemeinderat selbst im eigenen Dashboard).
- Weitere Plattformen (LinkedIn, YouTube etc.) — jederzeit durch neue Migration ergänzbar.
- Follower-Zahlen oder Embed-Previews.
