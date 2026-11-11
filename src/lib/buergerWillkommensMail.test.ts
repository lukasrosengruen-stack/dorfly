import { describe, expect, it } from 'vitest'
import { buergerWillkommensMail, type BuergerWillkommensDaten } from './buergerWillkommensMail'

const ALLES_AN = { abfallkalender: true, umfragen: true, gemeinderat: true, gewerbe: true, vereine: true }

const BASIS: BuergerWillkommensDaten = {
  vorname: 'Anna',
  hatName: true,
  gemeindeName: 'Ehningen',
  gemeindeSlug: 'ehningen',
  features: ALLES_AN,
}

const text = (d: Partial<BuergerWillkommensDaten> = {}) => buergerWillkommensMail({ ...BASIS, ...d }).html

describe('buergerWillkommensMail', () => {
  it('begruesst mit Gemeinde im Betreff und Vornamen in der Anrede', () => {
    const { betreff, html } = buergerWillkommensMail(BASIS)

    expect(betreff).toBe('Willkommen bei Dorfly Ehningen, so legen Sie los')
    expect(html).toContain('Guten Tag Anna,')
  })

  it('nutzt ohne Vornamen eine neutrale Anrede', () => {
    expect(text({ vorname: null, hatName: false })).toContain('Guten Tag,')
  })

  it('maskiert Namen, damit kein HTML eingeschleust werden kann', () => {
    const html = text({ vorname: '<b>Anna</b>', gemeindeName: 'Ehningen & Co' })

    expect(html).toContain('&lt;b&gt;Anna&lt;/b&gt;')
    expect(html).toContain('Ehningen &amp; Co')
  })

  it('bittet nur ohne Namen darum, ihn einzutragen', () => {
    expect(text({ hatName: false })).toContain('Namen eintragen')
    expect(text({ hatName: true })).not.toContain('Namen eintragen')
  })

  it('erklaert, dass alles abonniert ist und wie man abbestellt', () => {
    const html = text()

    expect(html).toContain('bereits abonniert')
    expect(html).toContain('Glocke')
  })

  it('erwaehnt die eigenen Warnmeldungen der Gemeinde neben denen des DWD', () => {
    const html = text()

    expect(html).toContain('Deutschen Wetterdienstes')
    expect(html).toContain('Warnmeldungen der Gemeinde')
  })

  it('nennt nur Funktionen, die in der Gemeinde freigeschaltet sind', () => {
    const html = text({ features: {} })

    expect(html).not.toContain('Abfallkalender')
    expect(html).not.toContain('Umfragen')
    expect(html).not.toContain('Gemeinderat')
    expect(html).not.toContain('Glocke')
    expect(html).toContain('Mängelmelder')
    expect(html).toContain('Veranstaltungen')
  })

  it('nennt im Abo-Hinweis nur die freigeschalteten Verzeichnisse', () => {
    const nurVereine = text({ features: { vereine: true } })

    expect(nurVereine).toContain('<em>Vereine</em>')
    expect(nurVereine).not.toContain('Lokale Angebote')
  })

  it('verwendet die Bezeichnung der Gemeinde fuer die Fragen an das Rathaus', () => {
    expect(text()).toContain('Frag den Bürgermeister')
    expect(text({ features: { ...ALLES_AN, buergermeisterLabel: 'verwaltung' } })).toContain('Frag die Verwaltung')
  })

  it('verlinkt auf die Gemeinde-Subdomain', () => {
    expect(text()).toContain('https://ehningen.dorfly.de/home')
  })
})
