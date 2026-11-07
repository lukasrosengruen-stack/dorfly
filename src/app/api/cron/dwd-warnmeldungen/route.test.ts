/**
 * Route-Test für den DWD-Cron. Er läuft alle 5 Minuten; dieselbe Warnung darf
 * pro Gemeinde nur einmal angelegt und gepusht werden.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { eqWert, fakeSupabase, hatOp, type Abfrage, type Antwort } from '@/lib/testing/supabaseFake'
import type { DwdAlert } from '@/features/warnmeldungen/types'

const GEMEINDE = '22222222-2222-4222-8222-222222222222'

const dwd = vi.hoisted(() => ({ alerts: [] as DwdAlert[] }))
vi.mock('@/features/warnmeldungen/dwd', async original => ({
  ...(await original<typeof import('@/features/warnmeldungen/dwd')>()),
  fetchDwdAlerts: async () => dwd.alerts,
}))

let service: ReturnType<typeof fakeSupabase>
let vorhandenePosts: { id: string; dwd_id: string; is_active: boolean }[]
let insertAntwort: Antwort | undefined
const push = vi.fn(async () => new Response('{}'))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => service.client,
}))

function responder(a: Abfrage): Antwort | undefined {
  if (a.tabelle === 'gemeinden') return { data: [{ id: GEMEINDE, slug: 'ehningen', warncell_id: '808115000' }] }
  if (a.tabelle === 'posts' && hatOp(a, 'insert')) return insertAntwort
  if (a.tabelle === 'posts' && hatOp(a, 'select')) return { data: vorhandenePosts }
  return undefined
}

function warnung(id: number): DwdAlert {
  return {
    id,
    alert_id: `2.49.0.0.276.0.DWD.PVW.${id}`,
    event_de: 'STARKREGEN',
    headline_de: 'Amtliche WARNUNG vor STARKREGEN',
    description_de: null,
    instruction_de: null,
    severity: 'moderate',
    status: 'actual',
    effective: '2026-11-07T10:00:00+00:00',
    expires: '2026-11-07T22:00:00+00:00',
  }
}

async function aufrufen() {
  const { GET } = await import('./route')
  return GET(new NextRequest('http://localhost/api/cron/dwd-warnmeldungen', {
    headers: { authorization: 'Bearer geheim' },
  }))
}

function updates() {
  return service.abfragen.filter(a => a.tabelle === 'posts' && hatOp(a, 'update'))
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'geheim')
  vi.stubGlobal('fetch', push)
  push.mockClear()
  service = fakeSupabase(responder)
  vorhandenePosts = []
  insertAntwort = undefined
  dwd.alerts = []
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('GET /api/cron/dwd-warnmeldungen', () => {
  it('lehnt Aufrufe ohne CRON_SECRET ab', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/dwd-warnmeldungen'))

    expect(res.status).toBe(401)
    expect(service.abfragen).toHaveLength(0)
  })

  it('legt eine neue Warnung an und pusht sie einmal', async () => {
    dwd.alerts = [warnung(1)]

    const res = await aufrufen()

    expect((await res.json()).created).toBe(1)
    expect(push).toHaveBeenCalledOnce()
  })

  it('pusht eine bereits angelegte Warnung beim naechsten Lauf nicht erneut', async () => {
    dwd.alerts = [warnung(1)]
    vorhandenePosts = [{ id: 'p1', dwd_id: '1', is_active: true }]

    await aufrufen()

    expect(service.abfragen.some(a => a.tabelle === 'posts' && hatOp(a, 'insert'))).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('pusht nicht, wenn ein paralleler Lauf die Warnung gerade schon angelegt hat', async () => {
    dwd.alerts = [warnung(1)]
    insertAntwort = { error: { code: '23505', message: 'duplicate key' } }
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await aufrufen()

    expect((await res.json()).created).toBe(0)
    expect(push).not.toHaveBeenCalled()
    expect(fehler).not.toHaveBeenCalled()
    fehler.mockRestore()
  })

  it('reaktiviert eine kurz verschwundene Warnung ohne neuen Push', async () => {
    dwd.alerts = [warnung(1)]
    vorhandenePosts = [{ id: 'p1', dwd_id: '1', is_active: false }]

    await aufrufen()

    expect(updates()).toHaveLength(1)
    expect(updates()[0].ops).toContainEqual(['update', [{ is_active: true }]])
    expect(eqWert(updates()[0], 'id')).toBe('p1')
    expect(push).not.toHaveBeenCalled()
  })

  it('deaktiviert Warnungen, die der DWD nicht mehr meldet', async () => {
    vorhandenePosts = [{ id: 'p1', dwd_id: '1', is_active: true }]

    await aufrufen()

    expect(updates()[0].ops).toContainEqual(['update', [{ is_active: false }]])
  })
})
