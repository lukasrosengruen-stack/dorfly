/**
 * Route-Tests für /api/mitglieder, /api/mitglieder/einladung, /api/mitglieder/verein.
 *
 * Supabase ist durch src/lib/testing/supabaseFake.ts ersetzt. Geprüft wird das
 * Verhalten der Routen: Rollen, Akteur-ID aus der Session, Ziel aus der eigenen
 * Mitgliedschaft, Fehlerübersetzung. Die Regeln in der Datenbank selbst testen
 * src/lib/mitgliedschaften.db.test.ts und kontoLoeschen.db.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { eqWert, fakeSupabase, hatOp, type Abfrage, type Antwort } from '@/lib/testing/supabaseFake'

const ANNA = '11111111-1111-4111-8111-111111111111'   // Verwalterin TSV
const BERT = '22222222-2222-4222-8222-222222222222'   // Autor TSV
const CARL = '33333333-3333-4333-8333-333333333333'   // Bürger
const VERW = '44444444-4444-4444-8444-444444444444'   // Verwaltung
const TSV = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FREMD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const G1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const EINLADUNG = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

const PROFILE: Record<string, { id: string; role: string; gemeinde_id: string; email: string; display_name: string }> = {
  [ANNA]: { id: ANNA, role: 'verein', gemeinde_id: G1, email: 'anna@example.de', display_name: 'Anna' },
  [BERT]: { id: BERT, role: 'verein', gemeinde_id: G1, email: 'bert@example.de', display_name: 'Bert' },
  [CARL]: { id: CARL, role: 'buerger', gemeinde_id: G1, email: 'carl@example.de', display_name: 'Carl' },
  [VERW]: { id: VERW, role: 'verwaltung', gemeinde_id: G1, email: 'rathaus@example.de', display_name: 'Rathaus' },
}
const MITGLIEDSCHAFT: Record<string, { rolle: string; verein_id: string; organisation_id: null }> = {
  [ANNA]: { rolle: 'verwalter', verein_id: TSV, organisation_id: null },
  [BERT]: { rolle: 'autor', verein_id: TSV, organisation_id: null },
}

let sitzung: string | null
let rpcAntwort: Antwort
let zusatz: (a: Abfrage) => Antwort | undefined
let service: ReturnType<typeof fakeSupabase>

/** Standard-Datenbank: Profile, Mitgliedschaften, der Verein TSV in G1. */
function standardResponder(a: Abfrage): Antwort | undefined {
  const extra = zusatz(a)
  if (extra) return extra
  if (a.tabelle === 'mitgliedschaften' && hatOp(a, 'maybeSingle')) {
    return { data: MITGLIEDSCHAFT[eqWert(a, 'profile_id') as string] ?? null }
  }
  if (a.tabelle === 'vereine' && hatOp(a, 'maybeSingle')) {
    return { data: eqWert(a, 'id') === TSV ? { gemeinde_id: G1, verein_name: 'TSV', typ: 'verein' } : null }
  }
  if (a.tabelle === 'gemeinden') return { data: { name: 'Ehningen', slug: 'ehningen' } }
  if (a.tabelle === 'profiles' && hatOp(a, 'maybeSingle')) {
    const p = PROFILE[eqWert(a, 'id') as string]
    return { data: p ? { ...p, gemeinden: { name: 'Ehningen' } } : null }
  }
  return undefined
}

vi.mock('@/lib/supabase/server', () => ({
  // withAuth: Session und Profil
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: sitzung ? { id: sitzung } : null } }) },
    from: () => {
      const b = { select: () => b, eq: () => b, single: async () => ({ data: sitzung ? PROFILE[sitzung] : null }) }
      return b
    },
  }),
  createServiceClient: async () => service.client,
}))

const mails = vi.hoisted(() => ({
  einladung: vi.fn(async () => ({ error: null })),
  zuweisung: vi.fn(async () => ({ error: null })),
  entzug: vi.fn(async () => ({ error: null })),
}))
vi.mock('@/lib/email', () => ({
  sendeEinladungsEmail: mails.einladung,
  sendeRollenzuweisungEmail: mails.zuweisung,
  sendeRollenentzugEmail: mails.entzug,
}))

const loescheVerein = vi.hoisted(() => vi.fn())
vi.mock('@/lib/vereinLoeschen', () => ({ loescheVerein }))

const mitglieder = await import('./route')
const einladung = await import('./einladung/route')
const verein = await import('./verein/route')

function anfrage(method: string, body?: unknown, query = '') {
  return new NextRequest(`http://localhost/api/mitglieder${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function antwort(res: Response) {
  return { status: res.status, json: await res.json() }
}

beforeEach(() => {
  sitzung = ANNA
  rpcAntwort = {}
  zusatz = () => undefined
  service = fakeSupabase(standardResponder, () => rpcAntwort)
  vi.clearAllMocks()
})

describe('Rollen und Anmeldung', () => {
  it('ohne Anmeldung 401', async () => {
    sitzung = null
    expect((await mitglieder.GET(anfrage('GET'))).status).toBe(401)
  })

  it('Bürger dürfen keine Team-Routen nutzen', async () => {
    sitzung = CARL
    for (const res of [
      await mitglieder.GET(anfrage('GET')),
      await mitglieder.POST(anfrage('POST', { email: 'x@example.de', rolle: 'autor' })),
      await verein.DELETE(anfrage('DELETE', { bestaetigung: 'TSV' })),
    ]) expect(res.status).toBe(403)
    expect(service.rpcs).toEqual([])
  })
})

describe('GET /api/mitglieder', () => {
  it('Mitglieder sehen immer das eigene Team — Query-Parameter werden ignoriert', async () => {
    const res = await mitglieder.GET(anfrage('GET', undefined, `?verein_id=${FREMD}`))
    expect(res.status).toBe(200)
    const vereinsAbfragen = service.abfragen.filter(a => a.tabelle === 'vereine').map(a => eqWert(a, 'id'))
    expect(vereinsAbfragen).toEqual([TSV])
    expect((await res.json()).ziel.name).toBe('TSV')
  })

  it('Verwaltung braucht genau ein Ziel', async () => {
    sitzung = VERW
    expect((await mitglieder.GET(anfrage('GET'))).status).toBe(400)
    expect((await mitglieder.GET(anfrage('GET', undefined, `?verein_id=${TSV}`))).status).toBe(200)
  })
})

describe('POST /api/mitglieder', () => {
  it('Autoren dürfen niemanden hinzufügen', async () => {
    sitzung = BERT
    const res = await mitglieder.POST(anfrage('POST', { email: 'carl@example.de', rolle: 'autor' }))
    expect(await antwort(res)).toEqual({ status: 403, json: { error: 'Nur Verwalter können Personen hinzufügen.' } })
    expect(service.rpcs).toEqual([])
  })

  it('bestehendes Konto: RPC mit Akteur aus der Session und eigenem Verein', async () => {
    zusatz = a => a.tabelle === 'profiles' && hatOp(a, 'ilike')
      ? { data: [{ id: CARL, gemeinde_id: G1, display_name: 'Carl' }] }
      : undefined
    const res = await mitglieder.POST(anfrage('POST', { email: 'Carl@Example.de', rolle: 'autor', verein_id: FREMD }))
    expect(await antwort(res)).toEqual({ status: 200, json: { ok: true, art: 'hinzugefuegt' } })
    expect(service.rpcs).toEqual([{
      name: 'mitglied_hinzufuegen',
      args: { p_profile_id: CARL, p_rolle: 'autor', p_ausgefuehrt_von: ANNA, p_verein_id: TSV, p_organisation_id: undefined },
    }])
    expect(mails.zuweisung).toHaveBeenCalledOnce()
  })

  it('unbekannte Adresse: widerruft nur Einladungen in den eigenen Verein und lädt ein', async () => {
    zusatz = a => a.tabelle === 'einladungen' && hatOp(a, 'insert') ? { data: { token: 'tok' } } : undefined
    const res = await mitglieder.POST(anfrage('POST', { email: 'neu@example.de', rolle: 'verwalter' }))
    expect(await antwort(res)).toEqual({ status: 200, json: { ok: true, art: 'eingeladen' } })

    const widerruf = service.abfragen.find(a => a.tabelle === 'einladungen' && hatOp(a, 'update'))!
    expect(eqWert(widerruf, 'verein_id')).toBe(TSV)
    expect(eqWert(widerruf, 'email')).toBe('neu@example.de')

    const insert = service.abfragen.find(a => a.tabelle === 'einladungen' && hatOp(a, 'insert'))!
    expect(insert.ops[0][1][0]).toMatchObject({ verein_id: TSV, mitglied_rolle: 'verwalter', eingeladen_von: ANNA, rolle: 'verein' })
    expect(mails.einladung).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok', mitgliedRolle: 'verwalter' }))
  })

  it('mehrdeutige Adresse: 409, keine Einladung', async () => {
    zusatz = a => a.tabelle === 'profiles' && hatOp(a, 'ilike')
      ? { data: [{ id: CARL, gemeinde_id: G1, display_name: null }, { id: BERT, gemeinde_id: G1, display_name: null }] }
      : undefined
    const res = await mitglieder.POST(anfrage('POST', { email: 'carl@example.de', rolle: 'autor' }))
    expect(res.status).toBe(409)
    expect(service.abfragen.some(a => a.tabelle === 'einladungen')).toBe(false)
  })

  it('ungültige Eingaben: 400', async () => {
    expect((await mitglieder.POST(anfrage('POST', { email: 'keine-mail', rolle: 'autor' }))).status).toBe(400)
    expect((await mitglieder.POST(anfrage('POST', { email: 'a@example.de', rolle: 'chef' }))).status).toBe(400)
  })
})

describe('PATCH /api/mitglieder', () => {
  it('Akteur kommt aus der Session, nicht aus dem Request', async () => {
    const res = await mitglieder.PATCH(anfrage('PATCH', { profile_id: BERT, rolle: 'verwalter', p_ausgefuehrt_von: VERW }))
    expect(res.status).toBe(200)
    expect(service.rpcs).toEqual([{
      name: 'mitglied_rolle_aendern', args: { p_profile_id: BERT, p_rolle: 'verwalter', p_ausgefuehrt_von: ANNA },
    }])
  })

  it('fachliche Ablehnung der Datenbank: 409 mit ihrer Meldung', async () => {
    rpcAntwort = { error: { code: 'P0001', message: 'Der letzte Verwalter kann nicht herabgestuft werden.' } }
    expect(await antwort(await mitglieder.PATCH(anfrage('PATCH', { profile_id: ANNA, rolle: 'autor' }))))
      .toEqual({ status: 409, json: { error: 'Der letzte Verwalter kann nicht herabgestuft werden.' } })
  })

  it('fehlende Grants verraten keine Interna', async () => {
    rpcAntwort = { error: { code: '42501', message: 'permission denied for function mitglied_rolle_aendern' } }
    expect(await antwort(await mitglieder.PATCH(anfrage('PATCH', { profile_id: BERT, rolle: 'autor' }))))
      .toEqual({ status: 500, json: { error: 'Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.' } })
  })
})

describe('DELETE /api/mitglieder', () => {
  it('entfernt mit Akteur aus der Session und benachrichtigt die Person', async () => {
    const res = await mitglieder.DELETE(anfrage('DELETE', { profile_id: BERT }))
    expect(res.status).toBe(200)
    expect(service.rpcs).toEqual([{ name: 'mitglied_entfernen', args: { p_profile_id: BERT, p_ausgefuehrt_von: ANNA } }])
    expect(mails.entzug).toHaveBeenCalledWith(expect.objectContaining({ to: 'bert@example.de', absender: 'der Verein „TSV“' }))
  })

  it('wer selbst austritt, bekommt keine Mail', async () => {
    sitzung = BERT
    expect((await mitglieder.DELETE(anfrage('DELETE', { profile_id: BERT }))).status).toBe(200)
    expect(mails.entzug).not.toHaveBeenCalled()
  })

  it('bei Ablehnung keine Mail', async () => {
    rpcAntwort = { error: { code: '42501', message: 'Keine Berechtigung.' } }
    expect((await mitglieder.DELETE(anfrage('DELETE', { profile_id: BERT }))).status).toBe(403)
    expect(mails.entzug).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/mitglieder/einladung', () => {
  it('Autoren dürfen keine Einladungen zurückziehen', async () => {
    sitzung = BERT
    expect((await einladung.DELETE(anfrage('DELETE', { einladung_id: EINLADUNG }))).status).toBe(403)
    expect(service.abfragen.some(a => a.tabelle === 'einladungen')).toBe(false)
  })

  it('zieht nur Einladungen in den eigenen Verein zurück', async () => {
    zusatz = a => a.tabelle === 'einladungen' ? { data: { email: 'neu@example.de' } } : undefined
    expect((await einladung.DELETE(anfrage('DELETE', { einladung_id: EINLADUNG, verein_id: FREMD }))).status).toBe(200)
    const update = service.abfragen.find(a => a.tabelle === 'einladungen')!
    expect(eqWert(update, 'id')).toBe(EINLADUNG)
    expect(eqWert(update, 'verein_id')).toBe(TSV)
    expect(eqWert(update, 'status')).toBe('offen')
  })

  it('unbekannte Einladung: 404', async () => {
    expect((await einladung.DELETE(anfrage('DELETE', { einladung_id: EINLADUNG }))).status).toBe(404)
  })
})

describe('DELETE /api/mitglieder/verein', () => {
  it('Autoren: 403, noch vor der Namensprüfung, nichts gelöscht', async () => {
    sitzung = BERT
    expect((await verein.DELETE(anfrage('DELETE', { bestaetigung: 'falsch' }))).status).toBe(403)
    expect(loescheVerein).not.toHaveBeenCalled()
  })

  it('falscher Name: 400, nichts gelöscht', async () => {
    expect((await verein.DELETE(anfrage('DELETE', { bestaetigung: 'TSV Ehningen' }))).status).toBe(400)
    expect(loescheVerein).not.toHaveBeenCalled()
  })

  it('löscht den eigenen Verein und benachrichtigt die übrigen Mitglieder', async () => {
    loescheVerein.mockResolvedValue({ ok: true, betroffene: [{ id: BERT, email: 'bert@example.de', name: 'Bert' }] })
    expect((await verein.DELETE(anfrage('DELETE', { bestaetigung: ' TSV ', verein_id: FREMD }))).status).toBe(200)
    expect(loescheVerein).toHaveBeenCalledWith(expect.objectContaining({ verein_id: TSV, recht: 'verwalter' }), ANNA, service.client)
    expect(mails.entzug).toHaveBeenCalledWith(expect.objectContaining({ to: 'bert@example.de', zusatz: 'Der Eintrag „TSV“ wurde gelöscht.' }))
  })

  it('Fehler beim Löschen wird weitergegeben, keine Mails', async () => {
    loescheVerein.mockResolvedValue({ ok: false, status: 403, fehler: 'Keine Berechtigung.' })
    expect(await antwort(await verein.DELETE(anfrage('DELETE', { bestaetigung: 'TSV' }))))
      .toEqual({ status: 403, json: { error: 'Keine Berechtigung.' } })
    expect(mails.entzug).not.toHaveBeenCalled()
  })
})
