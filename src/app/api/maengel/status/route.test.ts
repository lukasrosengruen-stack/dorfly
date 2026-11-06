/**
 * Route-Test für /api/maengel/status. Die Verwaltung soll nicht auf den Versand
 * von E-Mail und Push warten: die Antwort kommt zuerst, die Benachrichtigung danach.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeSupabase, hatOp, type Abfrage, type Antwort } from '@/lib/testing/supabaseFake'

const VERWALTUNG = '11111111-1111-4111-8111-111111111111'
const MELDER = '22222222-2222-4222-8222-222222222222'
const MANGEL = '33333333-3333-4333-8333-333333333333'
const GEMEINDE = '44444444-4444-4444-8444-444444444444'

const hilfen = vi.hoisted(() => ({
  nachAntwort: [] as (() => unknown)[],
  email: vi.fn(async () => {}),
  push: vi.fn(async () => {}),
}))

vi.mock('next/server', async original => ({
  ...(await original<typeof import('next/server')>()),
  after: (aufgabe: () => unknown) => { hilfen.nachAntwort.push(aufgabe) },
}))
vi.mock('@/lib/email', () => ({ sendeMangelUpdateEmail: hilfen.email }))
vi.mock('@/lib/push', () => ({ sendePushAnNutzer: hilfen.push }))

let service: ReturnType<typeof fakeSupabase>
let updateAntwort: Antwort | undefined

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: VERWALTUNG } } }) },
    from: () => {
      const b = {
        select: () => b,
        eq: () => b,
        single: async () => ({ data: { id: VERWALTUNG, role: 'verwaltung', gemeinde_id: GEMEINDE } }),
      }
      return b
    },
  }),
  createServiceClient: async () => ({
    ...(service.client as object),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'melder@example.de' } } }) } },
  }),
}))

function responder(a: Abfrage): Antwort | undefined {
  if (a.tabelle === 'maengel' && hatOp(a, 'single')) {
    return {
      data: { titel: 'Schlagloch', status: 'offen', nachricht_an_buerger: null, melder_id: MELDER, gemeinde_id: GEMEINDE },
    }
  }
  if (a.tabelle === 'maengel' && hatOp(a, 'update')) return updateAntwort
  if (a.tabelle === 'gemeinden') return { data: { name: 'Ehningen', slug: 'ehningen' } }
  return undefined
}

async function statusSetzen(status: string) {
  const { POST } = await import('./route')
  return POST(new NextRequest('http://localhost/api/maengel/status', {
    method: 'POST',
    body: JSON.stringify({ mangelId: MANGEL, status }),
  }))
}

beforeEach(() => {
  service = fakeSupabase(responder)
  updateAntwort = undefined
  hilfen.nachAntwort.length = 0
  hilfen.email.mockClear()
  hilfen.push.mockClear()
})

describe('POST /api/maengel/status', () => {
  it('antwortet, ohne auf E-Mail und Push zu warten', async () => {
    const res = await statusSetzen('erledigt')

    expect(res.status).toBe(200)
    expect(hilfen.email).not.toHaveBeenCalled()
    expect(hilfen.push).not.toHaveBeenCalled()
    expect(hilfen.nachAntwort).toHaveLength(1)
  })

  it('benachrichtigt den Melder nach der Antwort', async () => {
    await statusSetzen('erledigt')

    await hilfen.nachAntwort[0]()

    expect(hilfen.email).toHaveBeenCalledOnce()
    expect(hilfen.push).toHaveBeenCalledOnce()
  })

  it('benachrichtigt nicht, wenn sich nichts geaendert hat', async () => {
    const res = await statusSetzen('offen')

    expect(res.status).toBe(200)
    expect(hilfen.nachAntwort).toHaveLength(0)
  })

  it('benachrichtigt nicht, wenn das Speichern scheitert', async () => {
    updateAntwort = { error: { message: 'kaputt' } }

    const res = await statusSetzen('erledigt')

    expect(res.status).toBe(500)
    expect(hilfen.nachAntwort).toHaveLength(0)
  })
})
