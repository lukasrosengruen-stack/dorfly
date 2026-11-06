/**
 * Route-Test für /api/umfragen/abstimmen. Geprüft wird, dass eine Stimme nicht
 * doppelt zählen kann und dass Teilnahme und Antworten nie auseinanderlaufen.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { eqWert, fakeSupabase, hatOp, type Abfrage, type Antwort } from '@/lib/testing/supabaseFake'

const NUTZER = '11111111-1111-4111-8111-111111111111'
const UMFRAGE = '22222222-2222-4222-8222-222222222222'
const FRAGE = '33333333-3333-4333-8333-333333333333'
const GEMEINDE = '44444444-4444-4444-8444-444444444444'

let service: ReturnType<typeof fakeSupabase>
let antworten: Partial<Record<'teilnahme' | 'antworten' | 'umfrage', Antwort>>

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: NUTZER } } }) },
    from: () => {
      const b = {
        select: () => b,
        eq: () => b,
        single: async () => ({ data: { id: NUTZER, role: 'buerger', gemeinde_id: GEMEINDE } }),
      }
      return b
    },
  }),
  createServiceClient: async () => service.client,
}))

function responder(a: Abfrage): Antwort | undefined {
  if (a.tabelle === 'umfragen') return antworten.umfrage
  if (a.tabelle === 'umfrage_teilnahmen' && hatOp(a, 'insert')) return antworten.teilnahme
  if (a.tabelle === 'umfrage_antworten') return antworten.antworten
  return undefined
}

async function abstimmen() {
  const { POST } = await import('./route')
  return POST(new NextRequest('http://localhost/api/umfragen/abstimmen', {
    method: 'POST',
    body: JSON.stringify({ umfrageId: UMFRAGE, antworten: [{ frage_id: FRAGE, antwort_text: 'ja' }] }),
  }))
}

function schreibvorgaenge() {
  return service.abfragen
    .filter(a => hatOp(a, 'insert') || hatOp(a, 'delete'))
    .map(a => `${hatOp(a, 'insert') ? 'insert' : 'delete'} ${a.tabelle}`)
}

beforeEach(() => {
  service = fakeSupabase(responder)
  antworten = {
    umfrage: { data: { enddatum: new Date(Date.now() + 86_400_000).toISOString(), gemeinde_id: GEMEINDE } },
  }
})

describe('POST /api/umfragen/abstimmen', () => {
  it('reserviert die Teilnahme, bevor die Antworten gespeichert werden', async () => {
    const res = await abstimmen()

    expect(res.status).toBe(200)
    expect(schreibvorgaenge()).toEqual(['insert umfrage_teilnahmen', 'insert umfrage_antworten'])
  })

  it('lehnt eine zweite Stimme ab und speichert keine Antworten', async () => {
    antworten.teilnahme = { error: { code: '23505', message: 'duplicate key' } }

    const res = await abstimmen()

    expect(res.status).toBe(409)
    expect(schreibvorgaenge()).toEqual(['insert umfrage_teilnahmen'])
  })

  it('speichert keine Antworten, wenn die Teilnahme nicht gespeichert werden kann', async () => {
    antworten.teilnahme = { error: { code: '57014', message: 'interne Details' } }

    const res = await abstimmen()

    expect(res.status).toBe(500)
    expect((await res.json()).error).not.toContain('interne Details')
    expect(schreibvorgaenge()).toEqual(['insert umfrage_teilnahmen'])
  })

  it('nimmt die Teilnahme zurueck, wenn die Antworten nicht gespeichert werden koennen', async () => {
    antworten.antworten = { error: { message: 'interne Details' } }

    const res = await abstimmen()

    expect(res.status).toBe(500)
    expect((await res.json()).error).not.toContain('interne Details')
    expect(schreibvorgaenge()).toEqual([
      'insert umfrage_teilnahmen',
      'insert umfrage_antworten',
      'delete umfrage_teilnahmen',
    ])
    const zurueck = service.abfragen.find(a => hatOp(a, 'delete'))!
    expect(eqWert(zurueck, 'umfrage_id')).toBe(UMFRAGE)
    expect(eqWert(zurueck, 'user_id')).toBe(NUTZER)
  })

  it('schreibt nichts, wenn die Umfrage beendet ist', async () => {
    antworten.umfrage = { data: { enddatum: new Date(Date.now() - 1000).toISOString(), gemeinde_id: GEMEINDE } }

    const res = await abstimmen()

    expect(res.status).toBe(400)
    expect(schreibvorgaenge()).toEqual([])
  })

  it('schreibt nichts bei einer Umfrage aus einer anderen Gemeinde', async () => {
    antworten.umfrage = {
      data: {
        enddatum: new Date(Date.now() + 86_400_000).toISOString(),
        gemeinde_id: '55555555-5555-4555-8555-555555555555',
      },
    }

    const res = await abstimmen()

    expect(res.status).toBe(403)
    expect(schreibvorgaenge()).toEqual([])
  })
})
