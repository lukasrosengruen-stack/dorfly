# SSO-Vorarbeiten

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Stand 2026-11-06:** SSO ist zurückgestellt, siehe Status-Abschnitt der Spec. Task 1
> ist umgesetzt und bleibt unabhängig davon bestehen, es war eine echte Lücke. Task 2 ist
> offen und hängt nicht an SSO, er kann jederzeit einzeln gemacht werden.

**Goal:** Zwei Dinge sauber haben, bevor Apple und Google dazukommen.

**Architecture:** Beide sind von SSO unabhängig und für sich auslieferbar. Task 1 liegt
auf dem Pfad, den SSO benutzt, und ist erledigt. Task 2 liegt daneben und ist offen.

**Tech Stack:** Next.js 16, TypeScript, Vitest (Umgebung `node`, keine Komponententests).

**Spec:** `docs/superpowers/specs/2026-11-05-sso-buerger-design.md`
**Branch:** `sso-vorarbeiten`

---

## Task 1: `next`-Parameter sicher prüfen — ERLEDIGT 2026-11-05

Der Rücksprung von Apple und Google landet auf `/auth/callback`. Die Route baute das Ziel
mit `new URL(next, targetOrigin)` ohne jede Prüfung. Bei einem absoluten `next` gewann die
absolute Adresse, und der Nutzer landete samt frisch gesetzter Session-Cookies auf einer
fremden Domain. Die Login-Seite prüfte schon, der Callback nicht.

**Files:**
- Created: `src/lib/sichererPfad.ts`
- Created: `src/lib/sichererPfad.test.ts`
- Modified: `src/app/auth/callback/route.ts`
- Modified: `src/app/(auth)/login/page.tsx`

- [x] Test geschrieben, Fehlschlag bestätigt (Modul fehlt)
- [x] `sichererPfad()` implementiert: dekodiert zuerst, lässt dann nur Pfade mit genau
      einem führenden Schrägstrich durch, schließt `//` und `/\` aus
- [x] Test grün, 5 Tests
- [x] Im Callback eingebaut
- [x] Auf der Login-Seite eingebaut, dabei zwei duplizierte Inline-Prüfungen ersetzt
- [x] `npm run test`: 375 Tests in 37 Dateien grün
- [x] `npm run build`: erfolgreich
- [x] Lint: zwei Fehler in `login/page.tsx`, gegen `master` geprüft und dort identisch
      vorhanden, also vorbestehend
- [ ] Commit (noch offen, Arbeitsstand liegt uncommittet auf dem Branch)

**Stolperstelle fürs Protokoll:** Beim Schreiben der Dateien per Heredoc ging ein
Backslash verloren. In `sichererPfad.ts` gab das sofort einen Parse-Fehler. Im Test wurde
aus `'/\\evil.example'` still `'/evil.example'`, also ein gültiger interner Pfad: Der
Test wäre grün gewesen und hätte das Falsche geprüft. Aufgefallen nur, weil der Test vor
der Implementierung laufen musste und die Ausgabe gelesen wurde. Lehre: Dateien mit
Escape-Sequenzen nicht per Shell-Heredoc schreiben.

---

## Task 2: OneSignal-Logout beim Abmelden — OFFEN

**Files:**
- Create: `src/lib/abmelden.ts`
- Test: `src/lib/abmelden.test.ts`
- Modify: `src/app/(app)/profil/ProfilClient.tsx` (Zeilen 81-84)
- Modify: `src/app/admin/dashboard/AdminDashboardClient.tsx` (Zeilen 23-26)
- Delete: `src/components/PushNotificationInit.tsx`

Der Löschpfad in `/profil/datenschutz-daten/konto-loeschen` ruft `oneSignalAbmelden()`,
der Abmeldeknopf im Profil nicht. Auf einem geteilten Gerät trägt OneSignal weiter die
`external_id` des Vorgängers, und Push geht an die falsche Person. Unabhängig von SSO,
aufgefallen beim Prüfen des Logout-Pfads für SSO.

`PushNotificationInit.tsx` ist dabei aufgefallen: nirgends gerendert, toter Code. Der
echte OneSignal-Login passiert in `ProfilClient.tsx` beim Aktivieren von Push.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/lib/abmelden.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { abmelden } from './abmelden'

describe('abmelden', () => {
  it('meldet erst bei OneSignal ab, dann bei Supabase', async () => {
    const reihenfolge: string[] = []
    await abmelden({
      oneSignalAbmelden: async () => { reihenfolge.push('onesignal') },
      signOut: async () => { reihenfolge.push('supabase') },
    })
    expect(reihenfolge).toEqual(['onesignal', 'supabase'])
  })

  it('meldet bei Supabase auch ab, wenn OneSignal scheitert', async () => {
    const signOut = vi.fn(async () => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await abmelden({
      oneSignalAbmelden: async () => { throw new Error('SDK nicht geladen') },
      signOut,
    })
    expect(signOut).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/abmelden.test.ts`
Expected: FAIL, `Cannot find module './abmelden'`

- [ ] **Step 3: Minimale Implementierung**

`src/lib/abmelden.ts` (mit der Write- oder Edit-Funktion anlegen, nicht per Heredoc,
siehe Stolperstelle in Task 1):

```ts
/**
 * Abmelden in der richtigen Reihenfolge: erst OneSignal, dann Supabase.
 *
 * Der Löschpfad in /profil/datenschutz-daten/konto-loeschen ruft
 * oneSignalAbmelden() bereits, der Abmeldeknopf im Profil bisher nicht. Auf
 * einem geteilten Gerät trug OneSignal dadurch weiter die external_id des
 * Vorgängers, und Push-Nachrichten gingen an die falsche Person.
 *
 * Ein Fehler bei OneSignal darf die Abmeldung nie verhindern: Die Session
 * loszuwerden ist das Wichtigere. oneSignalAbmelden() wirft von sich aus nicht,
 * der try bleibt trotzdem, damit das hier unabhängig von dieser Zusage gilt.
 */
export async function abmelden(deps: {
  oneSignalAbmelden: () => Promise<void>
  signOut: () => Promise<unknown>
}): Promise<void> {
  try {
    await deps.oneSignalAbmelden()
  } catch (e) {
    console.error('[Abmelden] OneSignal-Logout fehlgeschlagen', e)
  }
  await deps.signOut()
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/lib/abmelden.test.ts`
Expected: PASS, 2 Tests

- [ ] **Step 5: In beiden Abmeldeknöpfen verwenden**

In `src/app/(app)/profil/ProfilClient.tsx` die Imports ergänzen:

```ts
import { abmelden } from '@/lib/abmelden'
import { oneSignalAbmelden } from '@/lib/oneSignalAbmelden'
```

und `signOut()` ersetzen:

```ts
  async function signOut() {
    await abmelden({ oneSignalAbmelden, signOut: () => supabase.auth.signOut() })
    router.push('/login')
  }
```

In `src/app/admin/dashboard/AdminDashboardClient.tsx` genauso. Super-Admins haben Push in
der Regel nicht aktiviert, aber der Weg soll an einer Stelle liegen und nicht an zwei.

- [ ] **Step 6: Toten Code entfernen**

Run: `grep -rn "PushNotificationInit" src/`
Expected: nur die Datei selbst

```bash
git rm src/components/PushNotificationInit.tsx
```

- [ ] **Step 7: Suite, Lint und Build**

Run: `npm run test`
Expected: PASS (die Suite braucht rund 3 Minuten, die PGlite-Tests starten echtes Postgres)

Run: `npx eslint src/lib/abmelden.ts src/lib/abmelden.test.ts "src/app/(app)/profil/ProfilClient.tsx" src/app/admin/dashboard/AdminDashboardClient.tsx`
Expected: keine neuen Fehler. Das Projekt hat 47 vorbestehende Lint-Fehler, deshalb nur
die geänderten Dateien prüfen und bei einem Treffer gegen `master` vergleichen.

Run: `npm run build`
Expected: erfolgreich

- [ ] **Step 8: Commit**

```bash
git add src/lib/abmelden.ts src/lib/abmelden.test.ts "src/app/(app)/profil/ProfilClient.tsx" src/app/admin/dashboard/AdminDashboardClient.tsx
git commit -m "$(cat <<'EOF'
fix: beim Abmelden auch von OneSignal abmelden

Der Loeschpfad rief oneSignalAbmelden(), der Abmeldeknopf nicht. Auf einem
geteilten Geraet trug OneSignal weiter die external_id des Vorgaengers, und
Push ging an die falsche Person. Der Ablauf liegt jetzt in abmelden() und
wird von Profil und Admin-Dashboard gemeinsam genutzt.

Entfernt ausserdem PushNotificationInit.tsx: nirgends gerendert, toter Code.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Gestrichen: Namenspflicht bei Fragen serverseitig

Hier stand ein dritter Task. **Er beruhte auf einem falschen Befund von mir und ist am
2026-11-06 gestrichen.**

Behauptet hatte ich, Bürgermeisterfragen hätten keine Namensprüfung, auch nicht im UI.
Falsch. Der Hinweis mit Link ins Profil steht in `BuergermeisterClient.tsx:136`, der
Senden-Knopf ist in Zeile 181 gesperrt, genauso wie im Gemeinderat
(`GemeinderatClient.tsx:412` und `:430`). Der Fehler entstand, weil ich beim ersten
Durchgang nur die ersten 120 Zeilen der Datei gelesen und den Rest nicht geprüft habe.

Was wirklich offen bleibt: Die Prüfung ist clientseitig. Wer die Oberfläche umgeht und
PostgREST direkt mit seinem eigenen Token anspricht, kann eine Frage ohne Namen anlegen.
Das erlebt kein Nutzer, und SSO braucht es nicht. Ob es gehärtet wird, ist eine
Produktentscheidung, keine technische Notwendigkeit.

Falls es später gewollt ist: `hat_anzeigenamen()` als Security-Definer-Funktion mit
`set row_security = off` nach dem Muster von Migration 043, eingebaut in die `with check`
der Policy „Fragen stellen" aus 047, plus dieselbe Prüfung in
`/api/gemeinderat/frage/route.ts`, weil diese Route mit `service_role` schreibt und damit
an RLS vorbeiläuft.

---

## Nicht in diesem Plan

**Migration für die Tabelle `einladungen`.** Manuell im Dashboard angelegt, ohne
Migration. Ihre Definition lässt sich nicht erraten, sie müsste aus dem laufenden Projekt
gelesen werden (`information_schema.columns`, `pg_indexes`, `pg_constraint`). Gegen genau
dieses Projekt arbeiten wir ohnehin, der Nutzen wäre allein Dokumentation.

Alles SSO-Eigene: Buttons, Anbieter-Login, Abschlussseite, Apple-Löschung, native Apps.
