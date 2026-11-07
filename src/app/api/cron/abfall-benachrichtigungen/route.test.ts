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
let sperre: Antwort | undefined
const push = vi.fn(async () => new Response('{}'))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => service.client,
}))

function responder(a: Abfrage): Antwort | undefined {
  if (a.tabelle === 'abfall_versandlaeufe') return sperre
  if (a.tabelle === 'abfallkalender_praeferenzen') {
    return { data: [{ user_id: NUTZER, gemeinde_id: GEMEINDE, ausgewaehlte_typen: ['restmuell'], push_aktiviert: true, email_aktiviert: false }] }
  }
  if (a.tabelle === 'abfalltermine') return { data: [{ gemeinde_id: GEMEINDE, typ: 'restmuell' }] }
  if (a.tabelle === 'gemeinden') return { data: [{ id: GEMEINDE, slug: 'ehningen' }] }
  return undefined
}

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
  service = fakeSupabase(responder)
  sperre = undefined
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
    sperre = { error: { code: '23505', message: 'duplicate key' } }

    const res = await aufrufen()

    expect(res.status).toBe(200)
    expect(abfrage('abfallkalender_praeferenzen', 'select')).toBeUndefined()
    expect(push).not.toHaveBeenCalled()
  })

  it('versendet nicht, wenn die Sperre nicht gesetzt werden kann', async () => {
    vi.useFakeTimers({ now: new Date('2026-07-15T16:00:00Z'), toFake: ['Date'] })
    sperre = { error: { code: '42501', message: 'permission denied' } }

    const res = await aufrufen()

    expect(res.status).toBe(500)
    expect(push).not.toHaveBeenCalled()
  })
})
