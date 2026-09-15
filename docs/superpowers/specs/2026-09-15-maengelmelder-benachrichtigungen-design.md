# Benachrichtigungen im Mängelmelder — Design

**Datum:** 2026-09-15

## Ziel

Wer einen Mangel meldet, erfährt ohne eigenes Nachsehen, wenn sich etwas tut:
eine E-Mail und — sofern aktiviert — eine Push-Nachricht, sobald die Verwaltung
den Status ändert oder eine Nachricht hinterlässt.

Vorbild ist die bestehende Benachrichtigung im Gemeinderats-Feature
(`src/app/api/gemeinderat/frage/route.ts`, `.../antwort/route.ts`).

## Ausgangslage

- `maengel` ist über RLS privat: nur der Melder und die Verwaltung der eigenen
  Gemeinde sehen einen Eintrag (`supabase/migrations/044_maengel_rls.sql`).
- Statuswechsel und Nachricht an den Bürger laufen über **eine** Route:
  `POST /api/maengel/status` schreibt `status` und `nachricht_an_buerger` im
  selben Update. Die Route liest den Vorher-Zustand heute nicht und kennt den
  Melder nicht.
- Für gezielte Push an einen Nutzer existiert ein Muster:
  `include_aliases: { external_id: [userId] }`, dupliziert im Abfall-Cron
  (`src/app/api/cron/abfall-benachrichtigungen/route.ts`) und in
  `src/app/api/notifications/test/route.ts`.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Inhalt der E-Mail | Mangel-Titel und neuer Status im Klartext, **nicht** der Nachrichtentext der Verwaltung. Mängel sind vertraulich, E-Mail ist kein vertraulicher Kanal. |
| Opt-out | Keines. E-Mail geht immer raus, Push nur an Nutzer mit aktiviertem Push. Wie beim Gemeinderat: wer meldet, erwartet eine Rückmeldung. |
| Auslöser | Nur bei echter Änderung von Status oder Nachricht. Wiederholtes Speichern desselben Zustands löst nichts aus. |
| Status- und Nachrichtenänderung gleichzeitig | **Eine** kombinierte Benachrichtigung, nicht zwei. |

## Architektur

### 1. Entscheidungslogik — `src/lib/mangelBenachrichtigung.ts`

Reine Funktion, ohne Netzwerk und ohne Supabase:

```ts
mangelBenachrichtigung(vorher, nachher) → null | { statusGeaendert: boolean; nachrichtGeaendert: boolean }
```

- `null` bedeutet: nichts senden.
- Status gilt als geändert, wenn sich der Wert tatsächlich unterscheidet.
  `status` ist nullable — ein Wechsel von `null` auf einen Wert zählt als Änderung.
- Nachricht gilt als geändert, wenn sich der getrimmte Text unterscheidet **und**
  der neue Text nicht leer ist. Eine gelöschte Nachricht löst nichts aus.

Testbar ohne Infrastruktur, analog zu `src/lib/umfrageErgebnisse.ts`.

### 2. Push-Helfer — `src/lib/push.ts`

`sendePushAnNutzer({ userId, titel, nachricht, pfad, gemeindeSlug })` bündelt den
OneSignal-Aufruf an eine einzelne `external_id`. Neu angelegt und hier genutzt;
die bestehenden Aufrufer bleiben unverändert (kein ungefragtes Refactoring).

Wer Push nicht aktiviert hat, besitzt kein Abo unter dieser `external_id` —
OneSignal verwirft die Nachricht still. Kein zusätzlicher Schalter nötig.

### 3. E-Mail — `src/lib/email.ts`

`sendeMangelUpdateEmail({ to, gemeindeName, gemeindeSlug, titel, status, statusGeaendert, nachrichtGeaendert })`
auf Basis des vorhandenen `benachrichtigungsHtml`. Link auf
`https://<slug>.<root>/maengel`. Enthält den Hinweis, dass die Nachricht der
Verwaltung nur in der App steht.

### 4. Route — `src/app/api/maengel/status/route.ts`

1. Mangel vor dem Update laden (`titel, status, nachricht_an_buerger, melder_id, gemeinde_id`),
   auf die eigene Gemeinde eingeschränkt. Nicht gefunden → 404.
2. Update wie bisher.
3. `mangelBenachrichtigung(vorher, nachher)` auswerten; bei `null` nichts tun.
4. `benachrichtigeMelder()` verschickt E-Mail und Push in `try/catch` mit
   `console.error`. Die Änderung ist zu diesem Zeitpunkt gespeichert — ein
   Zustellproblem darf der Verwaltung keinen Fehler anzeigen.

Empfängeradresse kommt aus `auth.users` über `service.auth.admin.getUserById(melder_id)`,
nicht aus `profiles.email` — die kann abweichen oder leer sein.

## Tests

`src/lib/mangelBenachrichtigung.test.ts` (Vitest):

- kein Wechsel → `null`
- nur Status geändert
- nur Nachricht geändert
- beides geändert → eine Benachrichtigung mit beiden Flags
- identische Nachricht erneut gespeichert → `null`
- Nachricht gelöscht → `null`
- `status` vorher `null` → zählt als Änderung

## Nicht Teil dieser Arbeit

- Keine Migration: es kommen weder Spalten noch Tabellen dazu.
- Kein Präferenz-UI im Profil.
- Keine Benachrichtigung an die Verwaltung bei neuer Meldung.

---

## Nachtrag: „Frag den Bürgermeister“

Dieselben Entscheidungen gelten für die Bürgerfragen (`fragen`): kein Opt-out,
nur bei echter Änderung, Antworttext der Verwaltung nicht in der Mail.

**Unterschiede zum Mängelmelder:**

- `frageUpdateSchema.antwort` ist `nonEmpty`, der Status wird immer auf
  `beantwortet` gesetzt. Es gibt also weder einen Status-ohne-Antwort- noch
  einen Löschfall — die Entscheidungslogik reduziert sich auf „hat sich die
  Antwort inhaltlich geändert?“
- Statt eines Titels gibt es nur den Fragetext. Er steht **gekürzt** in Mail
  und Push, damit der Fragesteller seine Frage wiedererkennt. Das ist seine
  eigene Eingabe, nicht die Antwort der Verwaltung.
- Eine nachträglich überarbeitete Antwort wird als Korrektur formuliert
  („Ergänzte Antwort“) statt als erste Antwort.

**Bausteine:** `src/lib/frageBenachrichtigung.ts` (`frageAntwortIstNeu`,
`kuerzeFrage`, beide getestet), `sendeBuergerfrageAntwortEmail` in
`src/lib/email.ts`, Versand in `src/app/api/fragen/update/route.ts`.
Der Push-Helfer `sendePushAnNutzer` wird mitbenutzt.
