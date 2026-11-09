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
let sperreLesen: Antwort | undefined
let sperreSetzen: Antwort | undefined
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
  if (a.tabelle === 'abfall_versandlaeufe') return hatOp(a, 'insert') ? sperreSetzen : sperreLesen
  if (a.tabelle === 'abfallkalender_praeferenzen') return praeferenzen
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
  vi.stubGlobal('fetch', push)
  push.mockClear()
  emailSenden.mockClear()
  service = fakeSupabase(responder)
  sperreLesen = undefined
  sperreSetzen = undefined
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

  it('versendet nicht noch einmal, wenn der Tag schon erledigt ist', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    sperreLesen = { data: { abfuhr_datum: '2026-07-16' } }

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(abfrage('abfallkalender_praeferenzen', 'select')).toBeUndefined()
    expect(abfrage('abfall_versandlaeufe', 'insert')).toBeUndefined()
    expect(push).not.toHaveBeenCalled()
  })

  it('versendet nicht, wenn die Sperre nicht gelesen werden kann', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    sperreLesen = { error: { code: '42501', message: 'permission denied' } }

    const res = await aufrufen()

    expect(res.status).toBe(500)
    expect(push).not.toHaveBeenCalled()
  })

  it('setzt die Sperre erst nach dem Versand', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    let sperreBeimVersand: boolean | undefined
    push.mockImplementationOnce(async () => {
      sperreBeimVersand = abfrage('abfall_versandlaeufe', 'insert') !== undefined
      return new Response('{}')
    })

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(sperreBeimVersand).toBe(false)
    expect(abfrage('abfall_versandlaeufe', 'insert')?.ops).toContainEqual(['insert', [{ abfuhr_datum: '2026-07-16' }]])
  })

  it('setzt keine Sperre, wenn die Praeferenzen nicht geladen werden koennen', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    praeferenzen = { error: { code: '42501', message: 'permission denied' } }

    const res = await aufrufen()

    expect(res.status).toBe(500)
    expect(abfrage('abfall_versandlaeufe', 'insert')).toBeUndefined()
  })

  it('setzt keine Sperre, wenn morgen nichts ansteht', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    termine = { data: [] }

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(abfrage('abfall_versandlaeufe', 'insert')).toBeUndefined()
  })

  it.each([
    ['Gemeinden', () => { gemeinden = { error: { message: 'kaputt' } } }],
    ['Profile', () => { profile = { error: { message: 'kaputt' } } }],
  ])('versendet nicht und setzt keine Sperre, wenn %s nicht geladen werden koennen', async (_name, vorbereiten) => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    vorbereiten()

    const res = await aufrufen()

    expect(res.status).toBe(500)
    expect(push).not.toHaveBeenCalled()
    expect(abfrage('abfall_versandlaeufe', 'insert')).toBeUndefined()
  })

  it('setzt keine Sperre, wenn OneSignal den Push ablehnt', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    push.mockImplementationOnce(async () => new Response('{}', { status: 400 }))

    const res = await aufrufen()

    expect(res.status).toBe(500)
    expect(abfrage('abfall_versandlaeufe', 'insert')).toBeUndefined()
  })

  it('setzt keine Sperre, wenn der Push-Aufruf scheitert', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    push.mockImplementationOnce(async () => { throw new Error('Netzwerk') })

    const res = await aufrufen()

    expect(res.status).toBe(500)
    expect(abfrage('abfall_versandlaeufe', 'insert')).toBeUndefined()
  })

  it('setzt keine Sperre, wenn Resend die E-Mail ablehnt', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    vi.stubEnv('RESEND_API_KEY', 'test')
    praeferenzen = { data: [{ ...PRAEFERENZ, push_aktiviert: false, email_aktiviert: true }] }
    emailSenden.mockImplementationOnce(async () => ({ data: null as unknown as { id: string }, error: { message: 'abgelehnt' } }))

    const res = await aufrufen()

    expect(emailSenden).toHaveBeenCalledOnce()
    expect(res.status).toBe(500)
    expect(abfrage('abfall_versandlaeufe', 'insert')).toBeUndefined()
  })

  it('meldet Erfolg, wenn ein paralleler Lauf die Sperre schon gesetzt hat', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    sperreSetzen = { error: { code: '23505', message: 'duplicate key' } }

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(push).toHaveBeenCalledOnce()
  })

  it('meldet einen Fehler, wenn die Sperre nach dem Versand nicht gesetzt werden kann', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    sperreSetzen = { error: { code: '42501', message: 'permission denied' } }

    const res = await aufrufen()

    expect(res.status).toBe(500)
    expect(push).toHaveBeenCalledOnce()
  })
})
