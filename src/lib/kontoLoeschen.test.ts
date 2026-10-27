import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { loescheKonto, loescheOneSignalNutzer } from './kontoLoeschen'

const USER = '11111111-1111-1111-1111-111111111111'
const ONESIGNAL = { appId: 'app-123', apiKey: 'key-abc' }

interface ServiceMock {
  pfade?: string[]
  pfadFehler?: string
  storageFehler?: string
  dbFehler?: string
}

function erzeugeService(opts: ServiceMock = {}) {
  const aufrufe: string[] = []
  const remove = vi.fn(async (pfade: string[]) => {
    aufrufe.push(`storage:${pfade.length}`)
    return { data: [], error: opts.storageFehler ? { message: opts.storageFehler } : null }
  })
  const rpc = vi.fn(async (name: string) => {
    aufrufe.push(`rpc:${name}`)
    if (name === 'konto_dateipfade') {
      return opts.pfadFehler
        ? { data: null, error: { message: opts.pfadFehler } }
        : { data: opts.pfade ?? [], error: null }
    }
    return { data: null, error: opts.dbFehler ? { message: opts.dbFehler } : null }
  })
  const service = { rpc, storage: { from: () => ({ remove }) } } as unknown as SupabaseClient<Database>
  return { service, rpc, remove, aufrufe }
}

const okFetch = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch

describe('loescheOneSignalNutzer', () => {
  it('löscht per external_id mit dem REST-Key', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }))
    expect(await loescheOneSignalNutzer(USER, ONESIGNAL, fetchFn as unknown as typeof fetch)).toBeNull()
    expect(fetchFn).toHaveBeenCalledWith(
      `https://api.onesignal.com/apps/app-123/users/by/external_id/${USER}`,
      { method: 'DELETE', headers: { Authorization: 'Key key-abc' } },
    )
  })

  it('wertet 404 als Erfolg (Push nie aktiviert)', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch
    expect(await loescheOneSignalNutzer(USER, ONESIGNAL, fetchFn)).toBeNull()
  })

  it('meldet andere Statuscodes und Netzwerkfehler als Fehler', async () => {
    const fehler500 = vi.fn(async () => new Response(null, { status: 500 })) as unknown as typeof fetch
    expect(await loescheOneSignalNutzer(USER, ONESIGNAL, fehler500)).toMatch(/500/)
    const netz = vi.fn(async () => { throw new Error('offline') }) as unknown as typeof fetch
    expect(await loescheOneSignalNutzer(USER, ONESIGNAL, netz)).toBe('offline')
  })
})

describe('loescheKonto', () => {
  it('läuft in der Reihenfolge OneSignal → Dateien → Datenbank', async () => {
    const { service, aufrufe } = erzeugeService({ pfade: ['maengel/1.jpg', 'posts/2.jpg'] })
    const ergebnis = await loescheKonto(USER, { service, oneSignal: ONESIGNAL, fetch: okFetch })
    expect(ergebnis).toEqual({ ok: true, dateien: 2 })
    expect(aufrufe).toEqual(['rpc:konto_dateipfade', 'storage:2', 'rpc:konto_loeschen'])
  })

  it('löscht Dateien in Paketen zu 1000', async () => {
    const pfade = Array.from({ length: 2500 }, (_, i) => `posts/${i}.jpg`)
    const { service, aufrufe } = erzeugeService({ pfade })
    await loescheKonto(USER, { service, oneSignal: ONESIGNAL, fetch: okFetch })
    expect(aufrufe.filter(a => a.startsWith('storage'))).toEqual(['storage:1000', 'storage:1000', 'storage:500'])
  })

  it('ruft remove() nicht auf, wenn es keine Dateien gibt', async () => {
    const { service, remove } = erzeugeService({ pfade: [] })
    expect(await loescheKonto(USER, { service, oneSignal: ONESIGNAL, fetch: okFetch })).toEqual({ ok: true, dateien: 0 })
    expect(remove).not.toHaveBeenCalled()
  })

  it('bricht ohne OneSignal-Konfiguration ab, bevor etwas gelöscht wird', async () => {
    const { service, rpc } = erzeugeService()
    const ergebnis = await loescheKonto(USER, { service, oneSignal: null, fetch: okFetch })
    expect(ergebnis).toMatchObject({ ok: false, schritt: 'onesignal' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('bricht ab, wenn OneSignal scheitert — Datenbank bleibt unberührt', async () => {
    const { service, rpc } = erzeugeService()
    const fehler = vi.fn(async () => new Response(null, { status: 503 })) as unknown as typeof fetch
    const ergebnis = await loescheKonto(USER, { service, oneSignal: ONESIGNAL, fetch: fehler })
    expect(ergebnis).toMatchObject({ ok: false, schritt: 'onesignal' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('bricht ab, wenn die Dateipfade nicht ermittelt werden können', async () => {
    const { service, aufrufe } = erzeugeService({ pfadFehler: 'permission denied' })
    const ergebnis = await loescheKonto(USER, { service, oneSignal: ONESIGNAL, fetch: okFetch })
    expect(ergebnis).toEqual({ ok: false, schritt: 'dateien', fehler: 'permission denied' })
    expect(aufrufe).not.toContain('rpc:konto_loeschen')
  })

  it('bricht ab, wenn der Storage scheitert — Datenbank bleibt unberührt', async () => {
    const { service, aufrufe } = erzeugeService({ pfade: ['a.jpg'], storageFehler: 'timeout' })
    const ergebnis = await loescheKonto(USER, { service, oneSignal: ONESIGNAL, fetch: okFetch })
    expect(ergebnis).toEqual({ ok: false, schritt: 'dateien', fehler: 'timeout' })
    expect(aufrufe).not.toContain('rpc:konto_loeschen')
  })

  it('meldet einen Fehler der Datenbank-Transaktion', async () => {
    const { service } = erzeugeService({ dbFehler: 'violates foreign key constraint' })
    const ergebnis = await loescheKonto(USER, { service, oneSignal: ONESIGNAL, fetch: okFetch })
    expect(ergebnis).toEqual({ ok: false, schritt: 'datenbank', fehler: 'violates foreign key constraint' })
  })
})
