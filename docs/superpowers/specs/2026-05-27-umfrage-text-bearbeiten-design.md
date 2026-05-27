# Design: Umfrage-Text nachbearbeiten

**Datum:** 2026-05-27  
**Rolle:** Verwaltung, super_admin  
**Scope:** Titel, Beschreibung, Enddatum — keine Fragen

---

## Kontext

Umfragen können nach der Veröffentlichung bisher nicht bearbeitet werden. Die Verwaltung soll Tipp- und Formulierungsfehler im Umfragetext korrigieren und das Enddatum anpassen können, ohne die Fragen zu verändern.

---

## Architektur

Kein neues Backend erforderlich. Alle notwendigen Teile existieren bereits:

- **API:** `POST /api/umfragen/bearbeiten` — nimmt `id`, `titel`, `beschreibung`, `enddatum` (alle optional), prüft `verwaltung`/`super_admin`-Rolle und `gemeinde_id`
- **Validierung:** `umfrageBearbeitenSchema` in `src/lib/validations.ts` — deckt genau die drei Felder ab
- **State in `UmfrageCard`:** `showEditForm`, `isVerwaltung`, `Pencil`-Icon-Import — vorhanden, aber nicht gerendert

---

## Komponenten

### Neu: `src/components/umfrage/UmfrageBearbeiten.tsx`

Kompaktes Modal mit react-hook-form + Zod (`umfrageBearbeitenSchema`).

**Props:**
```ts
interface Props {
  umfrage: { id: string; titel: string; beschreibung: string | null; enddatum: string }
  onClose: () => void
  onUpdate: (updated: Partial<Umfrage>) => void
}
```

**Felder:**
| Feld | Input-Typ | Validierung |
|------|-----------|-------------|
| Titel | text | required, max 200 |
| Beschreibung | textarea | optional, max 1000 |
| Enddatum | datetime-local | required, min = jetzt |

**Submit-Flow:**
1. `POST /api/umfragen/bearbeiten` mit `{ id, titel, beschreibung, enddatum }`
2. Bei Erfolg: `onUpdate()` aufrufen → Karte aktualisiert sich ohne Seiten-Reload
3. Bei Fehler: Fehlermeldung inline im Modal (`role="alert"`)

### Geändert: `src/components/umfrage/UmfrageCard.tsx`

- Pencil-Button im Card-Header rendern wenn `isVerwaltung === true`
- **Achtung:** Der Titel-Bereich ist bereits ein `<button>` (expand/collapse) — der Pencil muss als Geschwister-Element daneben platziert werden, nicht darin (kein nested button)
- `onClick` → `setShowEditForm(true)`
- `showEditForm === true` → `<UmfrageBearbeiten>` einblenden
- `onUpdate`-Callback: lokalen Umfrage-State im Card aktualisieren

---

## Datenfluss

```
[Pencil-Button] → showEditForm=true
     ↓
[UmfrageBearbeiten Modal] (prefilled)
     ↓ submit
POST /api/umfragen/bearbeiten
     ↓ 200 OK
onUpdate(updated) → UmfrageCard zeigt neue Werte
     ↓
showEditForm=false (Modal schließt)
```

---

## Barrierefreiheit

- Modal: `role="dialog"`, `aria-modal="true"`, `useFocusTrap`
- Pencil-Button: `aria-label="Umfrage bearbeiten"`
- Fehlermeldung: `role="alert"`
- Alle Felder mit verknüpftem `<label>`

---

## Was sich nicht ändert

- API-Route `/api/umfragen/bearbeiten` — unverändert
- DB-Schema — unverändert
- `umfrageBearbeitenSchema` — unverändert
- Fragen-Logik — nicht berührt
- Admin-Dashboard — nicht berührt (nur die Bürger-App-Card erhält den Button)

---

## Out of scope

- Fragen bearbeiten
- Fragen hinzufügen/löschen
- Umfrage-Status ändern
- Admin-Dashboard-Integration
