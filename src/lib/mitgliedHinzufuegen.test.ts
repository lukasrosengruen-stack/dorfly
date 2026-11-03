import { describe, expect, it, vi } from 'vitest'
import { absenderFuer, mitgliedPerEmailHinzufuegen, type HinzufuegenDeps } from './mitgliedHinzufuegen'
import type { Ziel } from './mitgliedschaft'

const ZIEL: Ziel = {
  verein_id: 'v1', organisation_id: null, gemeinde_id: 'g1', name: 'TSV', typ: 'verein', recht: 'verwalter',
}
const GEMEINDE = { name: 'Ehningen', slug: 'ehningen' }

function deps(over: Partial<HinzufuegenDeps> = {}): HinzufuegenDeps {
  return {
    profilPerEmail: vi.fn(async () => null),
    mitgliedHinzufuegen: vi.fn(async () => ({ error: null })),
    einladungAnlegen: vi.fn(async () => ({ token: 'tok' })),
    sendeZuweisung: vi.fn(async () => undefined),
    sendeEinladung: vi.fn(async () => undefined),
    ...over,
  }
}

const eingabe = { email: ' Bert@Example.de ', rolle: 'autor' as const, ziel: ZIEL, akteurId: 'anna', gemeinde: GEMEINDE }

describe('mitgliedPerEmailHinzufuegen', () => {
  it('fügt ein bestehendes Konto direkt hinzu und benachrichtigt es', async () => {
    const d = deps({ profilPerEmail: vi.fn(async () => ({ id: 'bert', gemeinde_id: 'g1', display_name: 'Bert' })) })
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toEqual({ ok: true, art: 'hinzugefuegt' })
    expect(d.profilPerEmail).toHaveBeenCalledWith('bert@example.de')
    expect(d.mitgliedHinzufuegen).toHaveBeenCalledWith({
      p_profile_id: 'bert', p_rolle: 'autor', p_ausgefuehrt_von: 'anna', p_verein_id: 'v1', p_organisation_id: undefined,
    })
    expect(d.sendeZuweisung).toHaveBeenCalledWith(expect.objectContaining({
      to: 'bert@example.de', neueRolle: 'verein', organisationName: 'TSV', absender: 'der Verein „TSV“', mitgliedRolle: 'autor',
    }))
    expect(d.einladungAnlegen).not.toHaveBeenCalled()
  })

  it('gibt die Ablehnung der Datenbank weiter und schickt keine Mail', async () => {
    const d = deps({
      profilPerEmail: vi.fn(async () => ({ id: 'rat', gemeinde_id: 'g1', display_name: null })),
      mitgliedHinzufuegen: vi.fn(async () => ({ error: { code: 'P0001', message: 'Diese Person ist bereits einem Verein zugeordnet oder hat eine andere Rolle.' } })),
    })
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toEqual({
      ok: false, status: 409, fehler: 'Diese Person ist bereits einem Verein zugeordnet oder hat eine andere Rolle.',
    })
    expect(d.sendeZuweisung).not.toHaveBeenCalled()
  })

  it('lehnt Konten anderer Gemeinden ab', async () => {
    const d = deps({ profilPerEmail: vi.fn(async () => ({ id: 'x', gemeinde_id: 'g2', display_name: null })) })
    const e = await mitgliedPerEmailHinzufuegen(eingabe, d)
    expect(e).toEqual({ ok: false, status: 409, fehler: 'Diese E-Mail-Adresse kann nicht hinzugefügt werden.' })
    expect(d.mitgliedHinzufuegen).not.toHaveBeenCalled()
  })

  it('weist Autoren ab, ohne etwas aufzurufen', async () => {
    const d = deps()
    const e = await mitgliedPerEmailHinzufuegen({ ...eingabe, ziel: { ...ZIEL, recht: 'autor' } }, d)
    expect(e).toEqual({ ok: false, status: 403, fehler: 'Nur Verwalter können Personen hinzufügen.' })
    for (const fn of Object.values(d)) expect(fn).not.toHaveBeenCalled()
  })

  it('lädt unbekannte Adressen ein — mit Ziel und Mitgliedsrolle', async () => {
    const d = deps()
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toEqual({ ok: true, art: 'eingeladen' })
    expect(d.einladungAnlegen).toHaveBeenCalledWith({
      email: 'bert@example.de', rolle: 'verein', mitglied_rolle: 'autor', verein_id: 'v1', org_id: null,
      organisation_name: 'TSV', gemeinde_id: 'g1', eingeladen_von: 'anna',
    })
    expect(d.sendeEinladung).toHaveBeenCalledWith(expect.objectContaining({
      to: 'bert@example.de', token: 'tok', rolle: 'verein', organisationName: 'TSV', gemeindeSlug: 'ehningen',
    }))
  })

  it('meldet einen Fehler beim Anlegen der Einladung', async () => {
    const d = deps({ einladungAnlegen: vi.fn(async () => ({ fehler: 'db down' })) })
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toMatchObject({ ok: false, status: 500 })
    expect(d.sendeEinladung).not.toHaveBeenCalled()
  })

  it('bleibt erfolgreich, wenn nur die Mail scheitert', async () => {
    const d = deps({ sendeEinladung: vi.fn(async () => { throw new Error('resend down') }) })
    expect(await mitgliedPerEmailHinzufuegen(eingabe, d)).toEqual({ ok: true, art: 'eingeladen' })
  })
})

describe('absenderFuer', () => {
  it('nennt die Verwaltung nicht ausdrücklich (Standardtext der Mail)', () => {
    expect(absenderFuer({ ...ZIEL, recht: 'verwaltung' })).toBeNull()
  })
  it('nennt Verein, Organisation oder Betrieb', () => {
    expect(absenderFuer(ZIEL)).toBe('der Verein „TSV“')
    expect(absenderFuer({ ...ZIEL, typ: 'organisation', name: 'Tafel' })).toBe('die Organisation „Tafel“')
    expect(absenderFuer({ ...ZIEL, typ: 'gewerbe', name: 'Bäckerei' })).toBe('der Betrieb „Bäckerei“')
  })
})
