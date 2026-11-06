# Anmeldung mit Google im Web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **ZURÜCKGESTELLT am 2026-11-06, nicht angefangen.** Kein Task dieses Plans ist
> umgesetzt. Gründe und Voraussetzungen für die Wiederaufnahme stehen im Status-Abschnitt
> der Spec. Vor dem ersten Task ist die Frage zur App-Store-Richtlinie 4.8 zu klären: Sie
> entscheidet, ob Google im Web für sich stehen kann oder Apple zwangsläufig mitzieht.

**Goal:** Bürger können sich auf einer Gemeinde-Subdomain mit Google anmelden. E-Mail und
Passwort bleiben unverändert. Apple und die nativen Apps kommen danach.

**Architecture:** Der Anbieter-Rücksprung läuft über den bestehenden `/auth/callback`.
Entscheidend ist, dass dort **kein Profil ohne Zustimmungsnachweis** entsteht: Bei der
Registrierung mit E-Mail steckt der Nachweis in `user_metadata`, bei SSO gibt es ihn noch
nicht. Fehlt er, führt der Weg auf eine Abschlussseite, die Namen und die beiden
Häkchen abfragt. Erst der Server legt danach das Profil an, mit Rolle `buerger` und der
Gemeinde aus dem `x-gemeinde-slug`-Header, den die Middleware aus dem Host setzt.

Die Entscheidung im Callback liegt als reine Funktion in `src/lib/callbackWeg.ts`, damit
sie testbar ist. Die Route selbst bleibt dünn.

**Tech Stack:** Next.js 16, TypeScript, Supabase (`signInWithOAuth`, PKCE), react-hook-form
plus Zod, Vitest (Umgebung `node`, keine Komponententests).

**Spec:** `docs/superpowers/specs/2026-11-05-sso-buerger-design.md`
**Branch:** `sso-vorarbeiten` (enthält bereits `sichererPfad`), oder ein neuer Branch auf
dessen Stand.

---

## Dateistruktur

| Datei | Zuständigkeit |
|---|---|
| `src/lib/callbackWeg.ts` (neu) | Entscheidet im Callback: weiter, Profil anlegen, oder Abschluss nötig |
| `src/lib/callbackWeg.test.ts` (neu) | Tests dazu |
| `src/app/auth/callback/route.ts` | nutzt die Entscheidung, leitet ohne Nachweis auf die Abschlussseite |
| `src/app/(auth)/registrierung-abschliessen/schema.ts` (neu) | Zod-Schema, Namen Pflicht, beide Häkchen Pflicht |
| `src/app/(auth)/registrierung-abschliessen/schema.test.ts` (neu) | Tests dazu |
| `src/app/(auth)/registrierung-abschliessen/page.tsx` (neu) | Server Component, prüft Session und Profil |
| `src/app/(auth)/registrierung-abschliessen/AbschlussForm.tsx` (neu) | Formular, react-hook-form plus Zod |
| `src/app/api/auth/sso-abschluss/route.ts` (neu) | Legt das Profil an, Zeitstempel und Rolle serverseitig |
| `src/app/api/auth/sso-abschluss/route.test.ts` (neu) | Route-Test mit `supabaseFake` |
| `src/lib/ssoSichtbar.ts` (neu) | Wann die SSO-Knöpfe erscheinen |
| `src/lib/ssoSichtbar.test.ts` (neu) | Tests dazu |
| `src/components/auth/GoogleButton.tsx` (neu) | Knopf nach Googles Gestaltungsvorgaben |
| `src/app/(auth)/login/page.tsx` | bindet den Knopf ein |
| `src/app/(app)/layout.tsx` | Gate: Session ohne Profil geht zur Abschlussseite |

**Hinweis für alle Tasks:** Dateien mit Escape-Sequenzen nicht per Shell-Heredoc anlegen.
In den Vorarbeiten ging dabei ein Backslash verloren und ein Test prüfte still das Falsche.
Write oder Edit benutzen.

---

## Task 1: Entscheidung im Callback

**Files:**
- Create: `src/lib/callbackWeg.ts`
- Test: `src/lib/callbackWeg.test.ts`

Ohne diese Weiche würde SSO ein Profil anlegen, bei dem `terms_accepted_at` und
`age_confirmed_at` `null` bleiben. Damit wäre die Zustimmung zu Nutzungsbedingungen und
Datenschutz umgangen.

Die Reihenfolge der Prüfungen ist wichtig: **zuerst** ob ein Profil existiert. Sonst
landet jemand, der sich zum zweiten Mal mit Google anmeldet, bei jeder Anmeldung wieder
auf der Abschlussseite, denn sein `user_metadata` enthält nie einen Nachweis.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/lib/callbackWeg.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { callbackWeg } from './callbackWeg'

describe('callbackWeg', () => {
  it('lässt jemanden mit Profil einfach weiter', () => {
    expect(callbackWeg({ hatProfil: true, termsAcceptedAt: undefined })).toBe('weiter')
    expect(callbackWeg({ hatProfil: true, termsAcceptedAt: '2026-11-06T10:00:00Z' })).toBe('weiter')
  })

  it('legt das Profil an, wenn der Nachweis aus der Registrierung vorliegt', () => {
    expect(callbackWeg({ hatProfil: false, termsAcceptedAt: '2026-11-06T10:00:00Z' }))
      .toBe('profil-anlegen')
  })

  it('verlangt den Abschluss, wenn kein Nachweis vorliegt', () => {
    expect(callbackWeg({ hatProfil: false, termsAcceptedAt: undefined })).toBe('abschluss-noetig')
    expect(callbackWeg({ hatProfil: false, termsAcceptedAt: null })).toBe('abschluss-noetig')
    expect(callbackWeg({ hatProfil: false, termsAcceptedAt: '' })).toBe('abschluss-noetig')
  })

  it('traut keinem Nachweis, der kein Zeitstempel ist', () => {
    expect(callbackWeg({ hatProfil: false, termsAcceptedAt: true })).toBe('abschluss-noetig')
    expect(callbackWeg({ hatProfil: false, termsAcceptedAt: 1 })).toBe('abschluss-noetig')
    expect(callbackWeg({ hatProfil: false, termsAcceptedAt: {} })).toBe('abschluss-noetig')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/callbackWeg.test.ts`
Expected: FAIL, `Cannot find module './callbackWeg'`

- [ ] **Step 3: Minimale Implementierung**

`src/lib/callbackWeg.ts`:

```ts
/**
 * Was im Auth-Callback mit einem gerade angemeldeten Nutzer passiert.
 *
 * Bei der Registrierung mit E-Mail und Passwort liegt der Nachweis der
 * Zustimmung in user_metadata (RegisterForm schreibt terms_accepted_at,
 * terms_version und age_confirmed_at über signUp options.data). Bei einer
 * Anmeldung über Google oder Apple gibt es diesen Nachweis nicht: Der Anbieter
 * kennt unsere Nutzungsbedingungen nicht. Ohne Nachweis darf kein Profil
 * entstehen, sonst wäre die Zustimmung umgangen.
 *
 * Erst auf ein bestehendes Profil prüfen, dann auf den Nachweis. Sonst landet
 * jemand bei jeder weiteren SSO-Anmeldung wieder auf der Abschlussseite, denn
 * sein user_metadata bleibt für immer ohne Zustimmungsfelder.
 *
 * termsAcceptedAt kommt aus user_metadata und ist damit vom Client beschreibbar.
 * Deshalb wird nur ein nicht-leerer String akzeptiert, und der Zeitstempel, der
 * später in der Datenbank landet, entsteht serverseitig neu.
 */
export type CallbackWeg = 'weiter' | 'profil-anlegen' | 'abschluss-noetig'

export function callbackWeg(opts: {
  hatProfil: boolean
  termsAcceptedAt: unknown
}): CallbackWeg {
  if (opts.hatProfil) return 'weiter'
  const nachweis = typeof opts.termsAcceptedAt === 'string' && opts.termsAcceptedAt.length > 0
  return nachweis ? 'profil-anlegen' : 'abschluss-noetig'
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/lib/callbackWeg.test.ts`
Expected: PASS, 4 Tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/callbackWeg.ts src/lib/callbackWeg.test.ts
git commit -m "$(cat <<'EOF'
feat: Weiche im Auth-Callback fuer Anmeldungen ohne Zustimmungsnachweis

Bei SSO liefert der Anbieter keinen Nachweis der Zustimmung zu
Nutzungsbedingungen und Datenschutz. Ohne Weiche entstuende ein Profil mit
leerem terms_accepted_at. callbackWeg() entscheidet: weiter, Profil anlegen,
oder Abschluss noetig.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Callback auf die Weiche umbauen

**Files:**
- Modify: `src/app/auth/callback/route.ts`

Heute ruft der Callback bedingungslos `profilAnlegen` mit den Metadaten und fragt danach
den Gemeinde-Slug ab. Neu kommt davor die Profilprüfung und die Weiche. Die
Cookie-Behandlung muss auch auf dem neuen frühen Rückweg greifen, sonst geht die gerade
erzeugte Session verloren.

- [ ] **Step 1: Import und Cookie-Helfer ergänzen**

Import oben:

```ts
import { callbackWeg } from '@/lib/callbackWeg'
```

Innerhalb von `GET`, nach dem Anlegen von `pendingCookies`, einen Helfer einführen, damit
beide Rückwege die Cookies setzen:

```ts
  // Die beim Code-Tausch entstandenen Session-Cookies müssen auf JEDEN Rückweg,
  // auch auf den frühen zur Abschlussseite. Ohne sie wäre die Session weg und
  // die Abschlussseite würde sofort wieder zum Login schicken.
  const cookieDomain = hostname.endsWith(ROOT_DOMAIN) ? `.${ROOT_DOMAIN}` : undefined
  function mitSessionCookies(antwort: NextResponse): NextResponse {
    pendingCookies.forEach(({ name, value, options }) =>
      antwort.cookies.set(name, value, {
        ...(options as Parameters<typeof antwort.cookies.set>[2]),
        domain: cookieDomain,
      }),
    )
    return antwort
  }
```

Die bisherige Zuweisung von `cookieDomain` weiter unten und die dortige
`pendingCookies.forEach`-Schleife entfallen dafür, die Antwort geht künftig durch
`mitSessionCookies`.

- [ ] **Step 2: Profilprüfung und Weiche einbauen**

Im `if (user) { ... }`-Block, direkt nach `const meta = user.user_metadata ?? {}`:

```ts
    // Eigenes Profil lesen ist über die bestehende Self-Select-Policy erlaubt,
    // dieselbe Abfrage macht die Login-Seite.
    const { data: vorhandenesProfil } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    const weg = callbackWeg({
      hatProfil: !!vorhandenesProfil,
      termsAcceptedAt: meta.terms_accepted_at,
    })

    if (weg === 'abschluss-noetig') {
      return mitSessionCookies(
        NextResponse.redirect(new URL('/registrierung-abschliessen', origin)),
      )
    }
```

Der bestehende `profilAnlegen`-Aufruf samt Fallback-Block wird in
`if (weg === 'profil-anlegen') { ... }` eingeschlossen. Der Rest, also Slug abfragen und
auf `next` weiterleiten, bleibt unverändert und läuft für `weiter` und
`profil-anlegen` gleich.

- [ ] **Step 3: Prüfen, dass nichts kaputt ist**

Run: `npm run test`
Expected: PASS, die 375 Tests von vorher bleiben grün

Run: `npm run build`
Expected: erfolgreich

Der bestehende Weg mit E-Mail und Passwort muss danach unverändert funktionieren. Das ist
der Regressionstest aus der Spec und wird in Task 6 manuell geprüft.

- [ ] **Step 4: Commit**

```bash
git add "src/app/auth/callback/route.ts"
git commit -m "$(cat <<'EOF'
feat: Auth-Callback leitet ohne Zustimmungsnachweis auf die Abschlussseite

Bisher legte der Callback bedingungslos ein Profil an. Bei SSO waere dabei
ein Profil ohne terms_accepted_at entstanden. Jetzt entscheidet
callbackWeg(), und die Session-Cookies gehen auch auf dem frueheren Rueckweg
mit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Schema der Abschlussseite

**Files:**
- Create: `src/app/(auth)/registrierung-abschliessen/schema.ts`
- Test: `src/app/(auth)/registrierung-abschliessen/schema.test.ts`

Namen sind Pflicht. Das löst zugleich zwei Dinge: Apple liefert den Namen nur bei der
allerersten Autorisierung oder nie, und für Fragen an Bürgermeister und Gemeinderat
braucht das Profil einen Anzeigenamen.

Texte personenneutral, kein Gendern, keine Gedankenstriche. Die beiden Häkchen-Labels
werden in Task 4 wörtlich aus `RegisterForm.tsx` übernommen, dort sind sie schon neutral.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/app/(auth)/registrierung-abschliessen/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ssoAbschlussSchema } from './schema'

const GUELTIG = {
  vorname: 'Anna',
  nachname: 'Beispiel',
  ageConfirmed: true,
  termsAccepted: true,
}

function fehler(eingabe: unknown): string[] {
  const r = ssoAbschlussSchema.safeParse(eingabe)
  return r.success ? [] : r.error.issues.map(i => i.path.join('.'))
}

describe('ssoAbschlussSchema', () => {
  it('nimmt vollständige Angaben an', () => {
    const r = ssoAbschlussSchema.safeParse(GUELTIG)
    expect(r.success).toBe(true)
  })

  it('verlangt beide Namen', () => {
    expect(fehler({ ...GUELTIG, vorname: '' })).toContain('vorname')
    expect(fehler({ ...GUELTIG, nachname: '' })).toContain('nachname')
    expect(fehler({ ...GUELTIG, vorname: '   ' })).toContain('vorname')
  })

  it('verlangt beide Häkchen', () => {
    expect(fehler({ ...GUELTIG, ageConfirmed: false })).toContain('ageConfirmed')
    expect(fehler({ ...GUELTIG, termsAccepted: false })).toContain('termsAccepted')
  })

  it('schneidet Leerzeichen an den Namen ab', () => {
    const r = ssoAbschlussSchema.safeParse({ ...GUELTIG, vorname: '  Anna  ' })
    expect(r.success && r.data.vorname).toBe('Anna')
  })

  it('begrenzt die Länge der Namen', () => {
    expect(fehler({ ...GUELTIG, vorname: 'a'.repeat(81) })).toContain('vorname')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run "src/app/(auth)/registrierung-abschliessen/schema.test.ts"`
Expected: FAIL, `Cannot find module './schema'`

- [ ] **Step 3: Minimale Implementierung**

`src/app/(auth)/registrierung-abschliessen/schema.ts`:

```ts
import { z } from 'zod'

/**
 * Abschluss einer Anmeldung über einen externen Anbieter.
 *
 * Namen sind Pflicht, anders als bei der Registrierung mit E-Mail: Apple
 * liefert den Namen nur bei der allerersten Autorisierung oder gar nicht, und
 * Fragen an Bürgermeister und Gemeinderat brauchen einen Anzeigenamen.
 *
 * Die Häkchen folgen dem Muster aus login/schema.ts: unvorbelegt, einzeln
 * geprüft, mit eigener Meldung. Zeitstempel und Version der Nutzungsbedingungen
 * stehen hier bewusst NICHT im Schema, die entstehen serverseitig in
 * /api/auth/sso-abschluss.
 */
export const ssoAbschlussSchema = z.object({
  vorname: z.string().trim().min(1, 'Bitte Vornamen angeben').max(80, 'Vorname ist zu lang'),
  nachname: z.string().trim().min(1, 'Bitte Nachnamen angeben').max(80, 'Nachname ist zu lang'),
  ageConfirmed: z.boolean().refine(v => v === true, {
    message: 'Bitte die Altersangabe bestätigen.',
  }),
  termsAccepted: z.boolean().refine(v => v === true, {
    message: 'Bitte die Nutzungsbedingungen akzeptieren und die Datenschutzerklärung zur Kenntnis nehmen.',
  }),
})

export type SsoAbschlussValues = z.infer<typeof ssoAbschlussSchema>
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run "src/app/(auth)/registrierung-abschliessen/schema.test.ts"`
Expected: PASS, 5 Tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/registrierung-abschliessen/schema.ts" "src/app/(auth)/registrierung-abschliessen/schema.test.ts"
git commit -m "$(cat <<'EOF'
feat: Schema fuer den Registrierungsabschluss nach SSO

Namen sind Pflicht, beide Haekchen sind Pflicht und unvorbelegt. Zeitstempel
und Version der Nutzungsbedingungen stehen bewusst nicht im Schema, sie
entstehen serverseitig.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: API-Route und Abschlussseite

**Files:**
- Create: `src/app/api/auth/sso-abschluss/route.ts`
- Create: `src/app/api/auth/sso-abschluss/route.test.ts`
- Create: `src/app/(auth)/registrierung-abschliessen/page.tsx`
- Create: `src/app/(auth)/registrierung-abschliessen/AbschlussForm.tsx`

`withAuth` ist hier nicht benutzbar: Es gibt 401 zurück, wenn kein Profil existiert, und
genau das ist hier der Normalfall. Also Session selbst prüfen.

Entscheidend für die Mandantentrennung: Die Route übergibt **keine** Gemeinde und
**keinen** Einladungstoken an `profilAnlegen`. Die Gemeinde kommt dort aus
`getGemeindeSlug()`, also aus dem Header, den die Middleware aus dem Host setzt und den
sie vorher gegen Fälschung löscht. Die Rolle bleibt der Standardwert `buerger`.

- [ ] **Step 1: Den fehlschlagenden Route-Test schreiben**

`src/app/api/auth/sso-abschluss/route.test.ts`:

```ts
/**
 * Route-Test für /api/auth/sso-abschluss.
 *
 * Geprüft wird, WAS die Route an profilAnlegen übergibt: Zeitstempel und
 * Version serverseitig, keine Gemeinde und kein Token aus dem Request, Rolle
 * nicht setzbar. Die Regeln in profilAnlegen selbst testen die PGlite-Tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { TERMS_VERSION } from '@/lib/constants'

const ANNA = '11111111-1111-4111-8111-111111111111'

let sitzung: string | null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: sitzung ? { id: sitzung, email: 'anna@example.de' } : null },
      }),
    },
  }),
}))

const profilAnlegen = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('@/lib/profil-anlegen', () => ({ profilAnlegen }))

const route = await import('./route')

const GUELTIG = {
  vorname: 'Anna',
  nachname: 'Beispiel',
  ageConfirmed: true,
  termsAccepted: true,
}

function anfrage(body: unknown) {
  return new NextRequest('http://localhost/api/auth/sso-abschluss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  sitzung = ANNA
  profilAnlegen.mockClear()
  profilAnlegen.mockImplementation(async () => undefined)
})

describe('POST /api/auth/sso-abschluss', () => {
  it('ohne Anmeldung 401 und ohne Profilanlage', async () => {
    sitzung = null
    const res = await route.POST(anfrage(GUELTIG))
    expect(res.status).toBe(401)
    expect(profilAnlegen).not.toHaveBeenCalled()
  })

  it('legt das Profil mit serverseitigen Zeitstempeln an', async () => {
    const res = await route.POST(anfrage(GUELTIG))
    expect(res.status).toBe(200)
    const [userId, daten] = profilAnlegen.mock.calls[0]
    expect(userId).toBe(ANNA)
    expect(daten.vorname).toBe('Anna')
    expect(daten.nachname).toBe('Beispiel')
    expect(daten.termsVersion).toBe(TERMS_VERSION)
    expect(daten.termsAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(daten.ageConfirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('übernimmt niemals Gemeinde, Rolle oder Token aus dem Request', async () => {
    await route.POST(anfrage({
      ...GUELTIG,
      gemeindeId: '99999999-9999-4999-8999-999999999999',
      role: 'verwaltung',
      token: 'geklauter-einladungstoken',
    }))
    const [, daten] = profilAnlegen.mock.calls[0]
    expect(daten.token).toBeUndefined()
    expect(daten).not.toHaveProperty('gemeindeId')
    expect(daten).not.toHaveProperty('role')
  })

  it('weist unvollständige Angaben ab, ohne etwas anzulegen', async () => {
    const res = await route.POST(anfrage({ ...GUELTIG, termsAccepted: false }))
    expect(res.status).toBe(400)
    expect(profilAnlegen).not.toHaveBeenCalled()
  })

  it('meldet einen Fehler bei der Profilanlage als 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    profilAnlegen.mockImplementation(async () => { throw new Error('Kein Gemeinde-Slug vorhanden') })
    const res = await route.POST(anfrage(GUELTIG))
    expect(res.status).toBe(500)
    expect((await res.json()).error).not.toMatch(/Gemeinde-Slug/)
  })
})
```

Letzter Test mit Absicht: Die interne Fehlermeldung darf nicht nach außen gehen.

Der Statuscode 400 ist geprüft: `validate` in `src/lib/validations.ts:36-42` antwortet bei
Schemafehlern mit `{ error: 'Ungültige Eingabe', details: [...] }` und Status 400.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/app/api/auth/sso-abschluss/route.test.ts`
Expected: FAIL, `Cannot find module './route'`

- [ ] **Step 3: Die Route schreiben**

`src/app/api/auth/sso-abschluss/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { profilAnlegen } from '@/lib/profil-anlegen'
import { validate } from '@/lib/validations'
import { TERMS_VERSION } from '@/lib/constants'
import { ssoAbschlussSchema } from '@/app/(auth)/registrierung-abschliessen/schema'

/**
 * Schließt eine Anmeldung über einen externen Anbieter ab und legt das Profil an.
 *
 * withAuth ist hier nicht benutzbar: Es antwortet mit 401, wenn kein Profil
 * existiert, und genau das ist hier der Normalfall.
 *
 * SICHERHEIT: An profilAnlegen gehen bewusst nur Namen und der
 * Zustimmungsnachweis. Keine Gemeinde, keine Rolle, kein Einladungstoken. Die
 * Gemeinde ermittelt profilAnlegen über getGemeindeSlug(), also aus dem
 * x-gemeinde-slug-Header, den die Middleware aus dem Host ableitet und vorher
 * gegen Fälschung löscht. Die Rolle bleibt der Standardwert buerger, SSO kann
 * also keine Rolle vergeben oder erweitern.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }

  // Kaputter Body soll 400 geben, nicht 500: request.json() wirft bei
  // ungültigem JSON, und ein unbehandelter Wurf wäre ein Serverfehler.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  const v = validate(ssoAbschlussSchema, body)
  if (!v.success) return v.error

  // Zeitpunkt und Version entstehen hier, nicht im Client: Ein Nachweis, den
  // der Browser mitschickt, wäre keiner.
  const jetzt = new Date().toISOString()

  try {
    await profilAnlegen(user.id, {
      email: user.email ?? undefined,
      vorname: v.data.vorname,
      nachname: v.data.nachname,
      termsAcceptedAt: jetzt,
      termsVersion: TERMS_VERSION,
      ageConfirmedAt: jetzt,
    })
  } catch (e) {
    const fehler = e instanceof Error ? e.message : 'Unbekannter Fehler'
    console.error('[sso-abschluss] profilAnlegen fehlgeschlagen', { userId: user.id, fehler })
    return NextResponse.json(
      { error: 'Das Konto konnte nicht angelegt werden. Bitte erneut versuchen.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/app/api/auth/sso-abschluss/route.test.ts`
Expected: PASS, 5 Tests

- [ ] **Step 5: Die Seite schreiben**

`src/app/(auth)/registrierung-abschliessen/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AbschlussForm from './AbschlussForm'

export const metadata: Metadata = { title: 'Registrierung abschließen – Dorfly' }

// Die Session steckt im Cookie, ohne das hier würde Next die Seite statisch
// ausliefern und die Weiterleitungen nie greifen.
export const dynamic = 'force-dynamic'

export default async function RegistrierungAbschliessenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Ohne Session gibt es nichts abzuschließen.
  if (!user) redirect('/login')

  // Mit Profil ist der Abschluss erledigt. Ohne diese Prüfung könnte ein
  // Lesezeichen auf diese Seite eine fertige Registrierung wiederholen.
  const { data: profil } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (profil) redirect('/home')

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Registrierung abschließen</h1>
        <p className="text-gray-600 text-sm leading-relaxed mb-6">
          Die Anmeldung hat funktioniert. Es fehlen noch der Name und die Zustimmung,
          dann ist das Konto fertig.
        </p>
        <AbschlussForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Das Formular schreiben**

`src/app/(auth)/registrierung-abschliessen/AbschlussForm.tsx`. Aufbau und
Barrierefreiheit genau wie in `src/app/(auth)/login/RegisterForm.tsx`: sichtbare
`<label>`, `aria-invalid`, `aria-describedby`, Fehlertexte mit `role="alert"`. Die beiden
Häkchen-Labels sind wörtlich aus `RegisterForm.tsx` übernommen und unvorbelegt.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ssoAbschlussSchema, type SsoAbschlussValues } from './schema'

export default function AbschlussForm() {
  const router = useRouter()
  const supabase = createClient()
  const [submitError, setSubmitError] = useState('')

  const form = useForm<SsoAbschlussValues>({
    resolver: zodResolver(ssoAbschlussSchema),
    defaultValues: { vorname: '', nachname: '', ageConfirmed: false, termsAccepted: false },
  })

  async function onSubmit(values: SsoAbschlussValues) {
    setSubmitError('')
    const res = await fetch('/api/auth/sso-abschluss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setSubmitError(body.error ?? 'Es hat nicht funktioniert. Bitte erneut versuchen.')
      return
    }
    router.push('/home')
    router.refresh()
  }

  // Abbrechen muss die Session wirklich beenden. Sonst bleibt ein angemeldetes
  // Konto ohne Profil zurück, das die App nicht benutzen kann.
  async function abbrechen() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="abschluss-vorname" className="block text-sm font-medium text-gray-700 mb-1">
            Vorname
          </label>
          <input
            id="abschluss-vorname"
            type="text"
            autoComplete="given-name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-invalid={!!form.formState.errors.vorname}
            aria-describedby={form.formState.errors.vorname ? 'abschluss-vorname-error' : undefined}
            {...form.register('vorname')}
          />
          {form.formState.errors.vorname && (
            <p role="alert" id="abschluss-vorname-error" className="text-red-600 text-xs mt-1">
              {form.formState.errors.vorname.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="abschluss-nachname" className="block text-sm font-medium text-gray-700 mb-1">
            Nachname
          </label>
          <input
            id="abschluss-nachname"
            type="text"
            autoComplete="family-name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-invalid={!!form.formState.errors.nachname}
            aria-describedby={form.formState.errors.nachname ? 'abschluss-nachname-error' : undefined}
            {...form.register('nachname')}
          />
          {form.formState.errors.nachname && (
            <p role="alert" id="abschluss-nachname-error" className="text-red-600 text-xs mt-1">
              {form.formState.errors.nachname.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="abschluss-age-confirmed"
            type="checkbox"
            className="w-4 h-4 shrink-0 mt-0.5 text-primary-500 rounded focus:ring-primary-500"
            aria-invalid={!!form.formState.errors.ageConfirmed}
            aria-describedby={form.formState.errors.ageConfirmed ? 'abschluss-age-error' : undefined}
            {...form.register('ageConfirmed')}
          />
          <label htmlFor="abschluss-age-confirmed" className="text-sm text-gray-700">
            Ich bin mindestens 16 Jahre alt.
          </label>
        </div>
        {form.formState.errors.ageConfirmed && (
          <p role="alert" id="abschluss-age-error" className="text-red-600 text-xs mt-1">
            {form.formState.errors.ageConfirmed.message}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="abschluss-terms-accepted"
            type="checkbox"
            className="w-4 h-4 shrink-0 mt-0.5 text-primary-500 rounded focus:ring-primary-500"
            aria-invalid={!!form.formState.errors.termsAccepted}
            aria-describedby={form.formState.errors.termsAccepted ? 'abschluss-terms-error' : undefined}
            {...form.register('termsAccepted')}
          />
          <label htmlFor="abschluss-terms-accepted" className="text-sm text-gray-700">
            Ich akzeptiere die{' '}
            <a href="/nutzungsbedingungen" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              Nutzungsbedingungen
            </a>{' '}
            und habe die{' '}
            <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
              Datenschutzerklärung
            </a>{' '}
            zur Kenntnis genommen.
          </label>
        </div>
        {form.formState.errors.termsAccepted && (
          <p role="alert" id="abschluss-terms-error" className="text-red-600 text-xs mt-1">
            {form.formState.errors.termsAccepted.message}
          </p>
        )}
      </div>

      {submitError && <p role="alert" className="text-red-600 text-sm">{submitError}</p>}

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        aria-busy={form.formState.isSubmitting}
        className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-150 ease-out active:scale-[0.97]"
      >
        {form.formState.isSubmitting
          ? <Loader2 className="animate-spin w-5 h-5" aria-hidden="true" />
          : <ArrowRight className="w-5 h-5" aria-hidden="true" />}
        Konto fertigstellen
      </button>

      <button
        type="button"
        onClick={abbrechen}
        className="w-full text-center text-sm text-gray-600 hover:text-primary-600 transition-colors pt-1"
      >
        Abbrechen und abmelden
      </button>
    </form>
  )
}
```

- [ ] **Step 7: Suite, Lint und Build**

Run: `npm run test`
Expected: PASS

Run: `npx eslint src/app/api/auth/sso-abschluss "src/app/(auth)/registrierung-abschliessen"`
Expected: keine Fehler

Run: `npm run build`
Expected: erfolgreich, die neue Route erscheint in der Ausgabe

- [ ] **Step 8: Commit**

```bash
git add src/app/api/auth/sso-abschluss "src/app/(auth)/registrierung-abschliessen"
git commit -m "$(cat <<'EOF'
feat: Abschlussseite und Route fuer die Registrierung nach SSO

Namen und beide Haekchen werden hier abgefragt, erst danach legt der Server
das Profil an. Zeitstempel und Version entstehen serverseitig. Gemeinde kommt
aus dem Host-Header, Rolle bleibt buerger: SSO kann keine Rolle vergeben.

Abbrechen meldet wirklich ab, damit kein angemeldetes Konto ohne Profil
zurueckbleibt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Gate für Session ohne Profil

**Files:**
- Modify: `src/app/(app)/layout.tsx`

Ohne das Gate sieht jemand, der auf der Abschlussseite abbricht und dann `/feed` aufruft,
eine halb funktionierende App: Die Middleware lässt ihn durch, weil eine Session
existiert, aber jede API-Route antwortet mit 401, weil das Profil fehlt.

Das Gate gehört nicht in die Middleware. Die liest heute bewusst kein Profil, ein
zusätzlicher Datenbankaufruf bei jedem Request wäre teuer. Das Layout holt das Profil
ohnehin schon.

- [ ] **Step 1: Gate einbauen**

In `src/app/(app)/layout.tsx`, nach `const profile = profileResult.data`:

```tsx
  // Angemeldet, aber ohne Profil: Die Registrierung über einen externen
  // Anbieter wurde abgebrochen, bevor Name und Zustimmung vorlagen. Ohne
  // Profil funktioniert in der App nichts, jede API-Route antwortet mit 401.
  if (user && !profile) redirect('/registrierung-abschliessen')
```

`redirect` ist dort schon importiert.

- [ ] **Step 2: Prüfen, dass es keine Schleife gibt**

Die Abschlussseite liegt in der Route-Group `(auth)` und damit nicht unter diesem Layout.
Mit Profil leitet sie selbst auf `/home`, ohne Session auf `/login`. Eine Schleife ist
damit ausgeschlossen.

Run: `npm run build`
Expected: erfolgreich

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/layout.tsx"
git commit -m "$(cat <<'EOF'
feat: angemeldete Nutzer ohne Profil zur Abschlussseite leiten

Wer die Registrierung ueber einen externen Anbieter abbricht, hat eine
Session aber kein Profil. Die App lief damit halb: Seiten laden, jede
API-Route antwortet 401.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Sichtbarkeit und Google-Knopf

**Files:**
- Create: `src/lib/ssoSichtbar.ts`
- Test: `src/lib/ssoSichtbar.test.ts`
- Create: `src/components/auth/GoogleButton.tsx`
- Modify: `src/app/(auth)/login/page.tsx`

Drei Bedingungen, alle mit Grund:

- **Flag aus:** `NEXT_PUBLIC_SSO_AKTIV` ist nicht `'true'`. Damit bleibt der Knopf
  unsichtbar, bis Sie ihn freigeben, obwohl der Code schon live ist.
- **Keine Gemeinde:** Auf `dorfly.de/login` ist `slug === null`. `profilAnlegen` könnte
  dort keine Gemeinde ermitteln und würde werfen. Der Weg führt dort über `/start`.
- **Einladung im Link:** Bei `?token=` ist die E-Mail an die Einladung gebunden. Eine
  Anbieter-Adresse würde nicht passen, und es geht um privilegierte Rollen.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/lib/ssoSichtbar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ssoSichtbar } from './ssoSichtbar'

const AN = { flag: 'true', hostSlug: 'musterbach', einladungsToken: null }

describe('ssoSichtbar', () => {
  it('zeigt die Knöpfe auf einer Gemeinde-Subdomain mit aktivem Flag', () => {
    expect(ssoSichtbar(AN)).toBe(true)
  })

  it('verbirgt sie, solange das Flag nicht genau "true" ist', () => {
    expect(ssoSichtbar({ ...AN, flag: undefined })).toBe(false)
    expect(ssoSichtbar({ ...AN, flag: '' })).toBe(false)
    expect(ssoSichtbar({ ...AN, flag: 'false' })).toBe(false)
    expect(ssoSichtbar({ ...AN, flag: '1' })).toBe(false)
  })

  it('verbirgt sie ohne Gemeinde im Host', () => {
    expect(ssoSichtbar({ ...AN, hostSlug: null })).toBe(false)
    expect(ssoSichtbar({ ...AN, hostSlug: '' })).toBe(false)
  })

  it('verbirgt sie bei einer Einladung im Link', () => {
    expect(ssoSichtbar({ ...AN, einladungsToken: 'abc123' })).toBe(false)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/lib/ssoSichtbar.test.ts`
Expected: FAIL, `Cannot find module './ssoSichtbar'`

- [ ] **Step 3: Minimale Implementierung**

`src/lib/ssoSichtbar.ts`:

```ts
/**
 * Wann die Knöpfe für die Anmeldung über einen externen Anbieter erscheinen.
 *
 * Flag: NEXT_PUBLIC_SSO_AKTIV muss genau 'true' sein. Der Code darf live sein,
 * ohne dass die Knöpfe sichtbar werden.
 *
 * Gemeinde: Auf der Apex-Domain gibt es keinen Slug. profilAnlegen könnte die
 * Gemeinde dort nicht ermitteln und würde werfen, der Weg führt über /start.
 *
 * Einladung: Bei einem Token im Link ist die E-Mail an die Einladung gebunden.
 * Eine Anbieter-Adresse würde nicht passen, und es geht um privilegierte
 * Rollen. Einladungen laufen weiter über E-Mail und Passwort.
 */
export function ssoSichtbar(opts: {
  flag: string | undefined
  hostSlug: string | null
  einladungsToken: string | null
}): boolean {
  if (opts.flag !== 'true') return false
  if (!opts.hostSlug) return false
  if (opts.einladungsToken) return false
  return true
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/lib/ssoSichtbar.test.ts`
Expected: PASS, 4 Tests

- [ ] **Step 5: Den Google-Knopf schreiben**

`src/components/auth/GoogleButton.tsx`. Gestaltung nach Googles Vorgaben: offizielles
G-Mark als lokales SVG, nicht umgefärbt, Beschriftung „Mit Google anmelden", weißer Grund
mit grauem Rand. Das SVG liegt inline, damit keine Anfrage an ein Anbieter-CDN geht.

```tsx
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/** Offizielles G-Mark, vier Farben, nicht umfärben. */
function GoogleG() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function GoogleButton() {
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState('')
  const supabase = createClient()

  async function anmelden() {
    setFehler('')
    setLaedt(true)
    // scopes bewusst nur 'email': ohne 'profile' sendet Google weder Namen
    // noch Profilbild. Den Namen fragen wir selbst ab.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email',
      },
    })
    // Im Erfolgsfall verlässt der Browser die Seite, der Code hier läuft dann
    // nicht weiter. Ein Fehler heißt: Die Weiterleitung kam nie zustande.
    if (error) {
      setLaedt(false)
      setFehler('Die Anmeldung mit Google ist nicht möglich. Bitte später erneut versuchen.')
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={anmelden}
        disabled={laedt}
        aria-busy={laedt}
        className="w-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium py-3 rounded-xl flex items-center justify-center gap-3 transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
      >
        {laedt ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <GoogleG />}
        Mit Google anmelden
      </button>
      {fehler && <p role="alert" className="text-red-600 text-sm mt-2">{fehler}</p>}
    </div>
  )
}
```

- [ ] **Step 6: In die Login-Seite einbinden**

In `src/app/(auth)/login/page.tsx` importieren:

```ts
import GoogleButton from '@/components/auth/GoogleButton'
import { ssoSichtbar } from '@/lib/ssoSichtbar'
```

Den Host-Slug clientseitig bestimmen. Die Login-Seite ist eine Client Component und hat
keinen Zugriff auf den Header, der Host genügt hier aber, denn es geht nur um die
Sichtbarkeit. Die verbindliche Ableitung passiert serverseitig in `profilAnlegen`.

```ts
  const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'
  const hostSlug = typeof window === 'undefined'
    ? null
    : (() => {
        const host = window.location.hostname.replace(/:\d+$/, '')
        if (host === ROOT || host === `www.${ROOT}`) return null
        if (host.endsWith(`.${ROOT}`)) return host.slice(0, -(ROOT.length + 1))
        if (host.endsWith('.localhost')) return host.split('.localhost')[0]
        return null
      })()

  const zeigeSso = ssoSichtbar({
    flag: process.env.NEXT_PUBLIC_SSO_AKTIV,
    hostSlug,
    einladungsToken,
  })
```

Im Markup direkt **unter** dem Anmelde-Knopf und über „Passwort vergessen?", und ebenso
im Registrieren-Tab unter `<RegisterForm …/>`:

```tsx
          {zeigeSso && (
            <>
              <div className="flex items-center gap-3 pt-2">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-600">oder</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
              <GoogleButton />
            </>
          )}
```

E-Mail und Passwort bleiben damit oben und als erste Option, Google steht gleichwertig
daneben.

- [ ] **Step 7: Suite, Lint und Build**

Run: `npm run test`
Expected: PASS

Run: `npx eslint src/lib/ssoSichtbar.ts src/lib/ssoSichtbar.test.ts src/components/auth/GoogleButton.tsx "src/app/(auth)/login/page.tsx"`
Expected: nur die zwei vorbestehenden `react-hooks/set-state-in-effect`-Fehler in
`login/page.tsx`, die auch auf `master` stehen. Keine neuen.

Run: `npm run build`
Expected: erfolgreich

- [ ] **Step 8: Commit**

```bash
git add src/lib/ssoSichtbar.ts src/lib/ssoSichtbar.test.ts src/components/auth/GoogleButton.tsx "src/app/(auth)/login/page.tsx"
git commit -m "$(cat <<'EOF'
feat: Anmeldung mit Google auf der Login-Seite

Knopf nach Googles Gestaltungsvorgaben, scopes nur email: ohne profile
sendet Google weder Namen noch Profilbild.

Sichtbar nur mit NEXT_PUBLIC_SSO_AKTIV=true, nur auf einer
Gemeinde-Subdomain und nicht bei einer Einladung im Link. Begruendung je
Bedingung in ssoSichtbar.ts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Einrichtung und Test auf musterbach

Alles davor ist hinter dem Flag unsichtbar. Hier wird es scharf.

### Was Sie einstellen müssen

**Google Cloud Console** (console.cloud.google.com):

1. Projekt anlegen oder vorhandenes wählen.
2. **APIs & Services → OAuth consent screen**: Typ „External". App-Name „Dorfly",
   Support-E-Mail, Links auf `https://dorfly.de/datenschutz` und
   `https://dorfly.de/nutzungsbedingungen`. Bei den Scopes **nur** `openid` und `email`
   auswählen, **nicht** `profile`. Das ist die wirksame Stelle für Datensparsamkeit: Ohne
   `profile` sendet Google Namen und Profilbild gar nicht.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, Typ
   „Web application".
   - Authorized redirect URI, genau diese eine:
     `https://hzptnylfdfibijkgtfhf.supabase.co/auth/v1/callback`
   - Authorized JavaScript origins bleibt leer, der Ablauf läuft über
     Server-Weiterleitungen.
4. Client ID und Client Secret kopieren.

**Supabase Dashboard**:

5. **Authentication → Providers → Google**: einschalten, Client ID und Secret einfügen,
   speichern.
6. **Authentication → URL Configuration → Redirect URLs**: `https://*.dorfly.de/auth/callback`
   hinzufügen. Die **Site URL bleibt unverändert**. Hintergrund: Bei Supabase sind `.` und
   `/` Trennzeichen und ein einzelner `*` matcht keine Trennzeichen. Das Muster trifft
   also genau eine Subdomain-Ebene und genau diesen Pfad, keine mehrstufigen Hosts und
   keine zusätzlichen Pfadsegmente.

**Vercel**:

7. `NEXT_PUBLIC_SSO_AKTIV=true` setzen. Solange die Variable fehlt oder etwas anderes als
   `true` enthält, bleiben die Knöpfe unsichtbar.

### Testliste

- [ ] **Neuanmeldung mit Google auf `musterbach.dorfly.de/login`.** Erwartung: Google-Dialog,
      Rücksprung auf `musterbach.dorfly.de`, Abschlussseite erscheint. Nach dem Ausfüllen
      landet man auf `/home`.
- [ ] **Profil prüfen.** In der Datenbank: `role = 'buerger'`, `gemeinde_id` ist Musterbach,
      `terms_accepted_at`, `terms_version` und `age_confirmed_at` sind gesetzt, `avatar_url`
      ist leer.
- [ ] **Zweite Anmeldung mit demselben Google-Konto.** Erwartung: keine Abschlussseite
      mehr, direkt `/home`. Das prüft die Reihenfolge in `callbackWeg`.
- [ ] **Beide Häkchen leer lassen und abschicken.** Erwartung: zwei Fehlermeldungen,
      kein Profil entsteht.
- [ ] **Auf der Abschlussseite „Abbrechen und abmelden".** Erwartung: zurück auf `/login`,
      keine Session mehr. Danach `/feed` aufrufen: Erwartung `/login`, keine halb
      funktionierende App.
- [ ] **Abbruch im Google-Dialog** („Zurück" im Anbieter-Fenster). Erwartung: zurück auf
      der Login-Seite, keine rote Fehlermeldung, kein angelegtes Konto.
- [ ] **Mandantentrennung.** Mit demselben Konto `ehningen.dorfly.de/feed` aufrufen.
      Erwartung: Weiterleitung zurück nach Musterbach durch `zielFuerFremdeGemeinde`.
      Inhalte aus Ehningen dürfen nicht erscheinen.
- [ ] **SSO auf Ehningen neu registrieren**, mit einem zweiten Google-Konto. Erwartung:
      `gemeinde_id` ist Ehningen, nicht Musterbach. Testkonto danach löschen.
- [ ] **Apex-Domain.** `dorfly.de/login` aufrufen. Erwartung: kein Google-Knopf.
- [ ] **Einladungslink.** Eine Einladung öffnen (`?token=…`). Erwartung: kein Google-Knopf,
      Registrierung mit E-Mail und Passwort funktioniert unverändert.
- [ ] **Regression E-Mail und Passwort.** Neues Konto mit E-Mail registrieren, Mail
      bestätigen, anmelden. Erwartung: unverändert, keine Abschlussseite. Das prüft den
      Umbau aus Task 2.
- [ ] **Passwort zurücksetzen.** Erwartung: unverändert. Der Weg läuft über denselben
      Callback mit `next=/passwort-zuruecksetzen`.
- [ ] **OneSignal.** Mit dem SSO-Konto Push im Profil aktivieren, Testbenachrichtigung
      über `/api/notifications/test` schicken. Erwartung: kommt an, `external_id` ist die
      User-ID.
- [ ] **Kontolöschung.** Das SSO-Testkonto über Profil, Datenschutz und Daten löschen.
      Erwartung: Konto weg, Abmeldung. Hinweis: Der Widerruf bei Apple fehlt noch, für
      Google ist nichts zu widerrufen.
- [ ] **Offener Punkt notieren:** Verhalten bei einer E-Mail, die schon als Passwortkonto
      existiert. Dafür ein Passwortkonto mit einer Adresse anlegen, die auch ein
      Google-Konto ist, dann mit Google anmelden und notieren, was passiert: Verknüpfung,
      zweites Konto oder Fehler. Das Ergebnis gehört in die Spec, bevor SSO freigegeben
      wird.

---

## Nicht in diesem Plan

Apple im Web, der Widerruf der Apple-Token beim Löschen, die nativen Apps mit
`signInWithIdToken`, der Cron für angemeldete Konten ohne Profil, der OneSignal-Logout
beim Abmelden (siehe `2026-11-05-sso-vorarbeiten.md`, Task 2).
