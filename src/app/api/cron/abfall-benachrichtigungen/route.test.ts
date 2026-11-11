/**
 * Route-Test für den Abfall-Cron. Er läuft stündlich; versendet wird nur am
 * Abend deutscher Zeit und je Abfuhrtag nur einmal, auch wenn Vercel denselben
 * Lauf doppelt ausliefert.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeSupabase, hatOp, type Abfrage, type Antwort } from '@/lib/testing/supabaseFake'

const NUTZER = '11111111-1111-4111-8111-111111111111'
const GEMEINDE = '22222222-2222-4222-8222-222222222222'

let service: ReturnType<typeof fakeSupabase>
let sperreSetzen: Antwort | undefined
let sperreLoeschen: Antwort | undefined
let praeferenzenWerfen: boolean
let praeferenzen: Antwort
let termine: Antwort
let gemeinden: Antwort
let profile: Antwort
const push = vi.fn(async () => new Response('{}'))
const { emailSenden } = vi.hoisted(() => ({
  emailSenden: vi.fn(async () => ({ data: { id: 'mail' }, error: null as { message: string } | null })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => service.client,
}))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: emailSenden }
  },
}))

function responder(a: Abfrage): Antwort | undefined {
  if (a.tabelle === 'abfall_versandlaeufe') return hatOp(a, 'insert') ? sperreSetzen : sperreLoeschen
  if (a.tabelle === 'abfallkalender_praeferenzen') {
    if (praeferenzenWerfen) throw new Error('unerwartet')
    return praeferenzen
  }
  if (a.tabelle === 'abfalltermine') return termine
  if (a.tabelle === 'gemeinden') return gemeinden
  if (a.tabelle === 'profiles') return profile
  return undefined
}

const PRAEFERENZ = { user_id: NUTZER, gemeinde_id: GEMEINDE, ausgewaehlte_typen: ['restmuell'], push_aktiviert: true, email_aktiviert: false }

async function aufrufen() {
  const { GET } = await import('./route')
  return GET(new NextRequest('http://localhost/api/cron/abfall-benachrichtigungen', {
    headers: { authorization: 'Bearer geheim' },
  }))
}

function abfrage(tabelle: string, op: string) {
  return service.abfragen.find(a => a.tabelle === tabelle && hatOp(a, op))
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'geheim')
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://produktion.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'app-test')
  vi.stubEnv('ONESIGNAL_REST_API_KEY', 'key-test')
  vi.stubGlobal('fetch', push)
  push.mockClear()
  emailSenden.mockClear()
  service = fakeSupabase(responder)
  sperreSetzen = undefined
  sperreLoeschen = undefined
  praeferenzenWerfen = false
  praeferenzen = { data: [PRAEFERENZ] }
  termine = { data: [{ gemeinde_id: GEMEINDE, typ: 'restmuell' }] }
  gemeinden = { data: [{ id: GEMEINDE, slug: 'ehningen' }] }
  profile = { data: [{ id: NUTZER, display_name: 'Testperson', email: 'test@example.invalid' }] }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/cron/abfall-benachrichtigungen', () => {
  it('lehnt Aufrufe ohne CRON_SECRET ab', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/abfall-benachrichtigungen'))

    expect(res.status).toBe(401)
    expect(service.abfragen).toHaveLength(0)
  })

  it('tut ausserhalb des Abendfensters nichts', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T08:00:00Z'), toFake: ['Date'] }) // 10 Uhr in Berlin

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(service.abfragen).toHaveLength(0)
    expect(push).not.toHaveBeenCalled()
  })

  it('versendet im Sommer um 18 Uhr deutscher Zeit fuer den Folgetag', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })

    await aufrufen()

    expect(abfrage('abfall_versandlaeufe', 'insert')?.ops).toContainEqual(['insert', [{ abfuhr_datum: '2026-07-16' }]])
    expect(abfrage('abfalltermine', 'select')?.ops).toContainEqual(['eq', ['datum', '2026-07-16']])
    expect(push).toHaveBeenCalledOnce()
  })

  it('versendet im Winter um 18 Uhr deutscher Zeit fuer den Folgetag', async () => {
    vi.useFakeTimers({ now: new Date('2026-01-15T17:00:00Z'), toFake: ['Date'] })

    await aufrufen()

    expect(abfrage('abfalltermine', 'select')?.ops).toContainEqual(['eq', ['datum', '2026-01-16']])
    expect(push).toHaveBeenCalledOnce()
  })

  it('holt einen ausgefallenen 18-Uhr-Lauf eine Stunde spaeter nach', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T17:00:00Z'), toFake: ['Date'] }) // 19 Uhr in Berlin

    await aufrufen()

    expect(push).toHaveBeenCalledOnce()
  })

  it('versendet nicht noch einmal, wenn der Tag schon gesperrt ist', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    sperreSetzen = { error: { code: '23505', message: 'duplicate key' } }

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(abfrage('abfallkalender_praeferenzen', 'select')).toBeUndefined()
    expect(abfrage('abfall_versandlaeufe', 'delete')).toBeUndefined()
    expect(push).not.toHaveBeenCalled()
  })

  it('versendet nicht, wenn die Sperre nicht gesetzt werden kann', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    sperreSetzen = { error: { code: '42501', message: 'permission denied' } }

    const res = await aufrufen()

    expect(res.status).toBe(500)
    expect(abfrage('abfall_versandlaeufe', 'delete')).toBeUndefined()
    expect(push).not.toHaveBeenCalled()
  })

  it('setzt die Sperre vor dem Versand und behaelt sie nach Erfolg', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    let sperreBeimVersand: boolean | undefined
    push.mockImplementationOnce(async () => {
      sperreBeimVersand = abfrage('abfall_versandlaeufe', 'insert') !== undefined
      return new Response('{}')
    })

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(sperreBeimVersand).toBe(true)
    expect(abfrage('abfall_versandlaeufe', 'delete')).toBeUndefined()
  })

  it('behaelt die Sperre, wenn morgen nichts ansteht', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    termine = { data: [] }

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(abfrage('abfall_versandlaeufe', 'delete')).toBeUndefined()
  })

  function erwarteFreigabe(res: Response) {
    expect(res.status).toBe(500)
    expect(abfrage('abfall_versandlaeufe', 'delete')?.ops).toContainEqual(['eq', ['abfuhr_datum', '2026-07-16']])
  }

  it('gibt die Sperre frei, wenn die Praeferenzen nicht geladen werden koennen', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    praeferenzen = { error: { code: '42501', message: 'permission denied' } }

    erwarteFreigabe(await aufrufen())
  })

  it('gibt die Sperre frei, wenn die Termine nicht geladen werden koennen', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    termine = { error: { message: 'kaputt' } }

    erwarteFreigabe(await aufrufen())
    expect(push).not.toHaveBeenCalled()
  })

  it.each([
    ['Gemeinden', () => { gemeinden = { error: { message: 'kaputt' } } }],
    ['Profile', () => { profile = { error: { message: 'kaputt' } } }],
  ])('versendet nicht und gibt die Sperre frei, wenn %s nicht geladen werden koennen', async (_name, vorbereiten) => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    vorbereiten()

    erwarteFreigabe(await aufrufen())
    expect(push).not.toHaveBeenCalled()
  })

  it('gibt die Sperre frei, wenn OneSignal den Push ablehnt', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    push.mockImplementationOnce(async () => new Response('{}', { status: 400 }))

    erwarteFreigabe(await aufrufen())
  })

  it('gibt die Sperre frei, wenn der Push-Aufruf scheitert', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    push.mockImplementationOnce(async () => { throw new Error('Netzwerk') })

    erwarteFreigabe(await aufrufen())
  })

  it('gibt die Sperre frei, wenn Resend die E-Mail ablehnt', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    vi.stubEnv('RESEND_API_KEY', 'test')
    praeferenzen = { data: [{ ...PRAEFERENZ, push_aktiviert: false, email_aktiviert: true }] }
    emailSenden.mockImplementationOnce(async () => ({ data: null as unknown as { id: string }, error: { message: 'abgelehnt' } }))

    erwarteFreigabe(await aufrufen())
    expect(emailSenden).toHaveBeenCalledOnce()
  })

  it('gibt die Sperre auch bei einem unerwarteten Fehler frei', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    praeferenzenWerfen = true

    erwarteFreigabe(await aufrufen())
  })

  it('meldet in der Produktion einen Fehler, wenn die OneSignal-Variablen fehlen', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    vi.stubEnv('ONESIGNAL_REST_API_KEY', '')

    erwarteFreigabe(await aufrufen())
    expect(push).not.toHaveBeenCalled()
  })

  describe('in der Testumgebung', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
      vi.stubEnv('VERCEL_ENV', 'preview')
    })

    it('pusht nie und meldet trotzdem Erfolg, auch mit gesetzten Variablen', async () => {
      const res = await aufrufen()

      expect(res.status).toBe(200)
      expect(push).not.toHaveBeenCalled()
      expect(abfrage('abfall_versandlaeufe', 'delete')).toBeUndefined()
    })

    it('meldet auch ohne OneSignal-Variablen Erfolg', async () => {
      vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', '')
      vi.stubEnv('ONESIGNAL_REST_API_KEY', '')

      expect((await aufrufen()).status).toBe(200)
      expect(push).not.toHaveBeenCalled()
    })

    it('schickt keine Mail an Adressen ausserhalb der Erlaubnisliste', async () => {
      vi.stubEnv('RESEND_API_KEY', 'test')
      praeferenzen = { data: [{ ...PRAEFERENZ, push_aktiviert: false, email_aktiviert: true }] }

      expect((await aufrufen()).status).toBe(200)
      expect(emailSenden).not.toHaveBeenCalled()
    })

    it('schickt die Mail an eine erlaubte Testadresse', async () => {
      vi.stubEnv('RESEND_API_KEY', 'test')
      praeferenzen = { data: [{ ...PRAEFERENZ, push_aktiviert: false, email_aktiviert: true }] }
      profile = { data: [{ id: NUTZER, display_name: 'Lukas', email: 'lukas.rosengruen+testdorf@dorfly.de' }] }

      expect((await aufrufen()).status).toBe(200)
      expect(emailSenden).toHaveBeenCalledWith(expect.objectContaining({ to: ['lukas.rosengruen+testdorf@dorfly.de'] }), undefined)
    })
  })

  it('bleibt bei 500, wenn die Sperre nicht freigegeben werden kann', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    praeferenzen = { error: { code: '42501', message: 'permission denied' } }
    sperreLoeschen = { error: { message: 'kaputt' } }

    const res = await aufrufen()

    expect(res.status).toBe(500)
  })
})
