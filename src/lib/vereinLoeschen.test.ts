import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { loescheVerein } from './vereinLoeschen'
import type { Ziel } from './mitgliedschaft'

const ZIEL: Ziel = { verein_id: 'v1', organisation_id: null, gemeinde_id: 'g1', name: 'TSV', typ: 'verein', recht: 'verwalter' }

function erzeugeService(opts: { pfade?: string[]; storageFehler?: string; dbFehler?: { code: string; message: string } } = {}) {
  const aufrufe: string[] = []
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    aufrufe.push(`rpc:${name}`)
    if (name === 'verein_dateipfade') return { data: opts.pfade ?? [], error: null }
    if (opts.dbFehler) return { data: null, error: opts.dbFehler }
    expect(args).toMatchObject({ p_ausgefuehrt_von: 'anna', p_verein_id: 'v1' })
    return { data: [{ mitglied_id: 'bert', mitglied_email: 'bert@example.de', mitglied_name: 'Bert' }], error: null }
  })
  const remove = vi.fn(async (p: string[]) => {
    aufrufe.push(`storage:${p.length}`)
    return { data: [], error: opts.storageFehler ? { message: opts.storageFehler } : null }
  })
  const service = { rpc, storage: { from: () => ({ remove }) } } as unknown as SupabaseClient<Database>
  return { service, aufrufe }
}

describe('loescheVerein', () => {
  it('löscht erst Dateien, dann die Datenbank, und liefert die übrigen Mitglieder', async () => {
    const { service, aufrufe } = erzeugeService({ pfade: ['posts/a.jpg'] })
    const e = await loescheVerein(ZIEL, 'anna', service)
    expect(e).toEqual({ ok: true, betroffene: [{ id: 'bert', email: 'bert@example.de', name: 'Bert' }] })
    expect(aufrufe).toEqual(['rpc:verein_dateipfade', 'storage:1', 'rpc:verein_loeschen'])
  })

  it('verweigert Autoren, bevor irgendetwas gelöscht wird', async () => {
    const { service, aufrufe } = erzeugeService()
    expect(await loescheVerein({ ...ZIEL, recht: 'autor' }, 'bert', service)).toMatchObject({ ok: false, status: 403 })
    expect(aufrufe).toEqual([])
  })

  it('bricht ab, wenn Dateien nicht gelöscht werden können', async () => {
    const { service, aufrufe } = erzeugeService({ pfade: ['x'], storageFehler: 'nope' })
    expect(await loescheVerein(ZIEL, 'anna', service)).toMatchObject({ ok: false, status: 500 })
    expect(aufrufe).not.toContain('rpc:verein_loeschen')
  })

  it('übersetzt Datenbankfehler', async () => {
    const { service } = erzeugeService({ dbFehler: { code: '42501', message: 'Keine Berechtigung.' } })
    expect(await loescheVerein(ZIEL, 'anna', service)).toEqual({ ok: false, status: 403, fehler: 'Keine Berechtigung.' })
  })
})
