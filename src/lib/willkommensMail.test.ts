import { describe, expect, it } from 'vitest'
import { istVereinsrolle, willkommensMail } from './willkommensMail'

const BASIS = {
  gemeindeName: 'Ehningen',
  gemeindeSlug: 'ehningen',
  organisationName: 'TSV Ehningen',
  absender: null,
  link: 'https://ehningen.dorfly.de/login?token=abc',
  eingeladen: true,
}

describe('istVereinsrolle', () => {
  it('erkennt Verein, Organisation und Gewerbe', () => {
    expect(['verein', 'organisation', 'gewerbe'].every(istVereinsrolle)).toBe(true)
    expect(['buerger', 'gemeinderat', 'verwaltung'].some(istVereinsrolle)).toBe(false)
  })
})

describe('willkommensMail', () => {
  it('Verwalter eines Vereins: Profil, Team und Prüfung durch die Gemeinde', () => {
    const { betreff, html } = willkommensMail({ ...BASIS, typ: 'verein', mitgliedRolle: 'verwalter' })
    expect(betreff).toBe('Willkommen bei Dorfly Ehningen: Sie verwalten jetzt TSV Ehningen')
    expect(html).toContain('<strong>Verwalter</strong>')
    expect(html).toContain('Vereinsprofil')
    expect(html).toContain('„Team“')
    expect(html).toContain('von der Gemeindeverwaltung geprüft')
    expect(html).toContain('Jetzt registrieren')
    expect(html).toContain('7 Tage')
  })

  it('Autor: kein Profil- und Team-Abschnitt', () => {
    const { betreff, html } = willkommensMail({ ...BASIS, typ: 'verein', mitgliedRolle: 'autor' })
    expect(betreff).toBe('Willkommen bei Dorfly Ehningen: Sie schreiben jetzt für TSV Ehningen')
    expect(html).toContain('<strong>Autor</strong>')
    expect(html).not.toContain('Vereinsprofil prüfen')
    expect(html).not.toContain('Ihr Team')
  })

  it('Gewerbe: Betrieb, Lokale Angebote, sofort sichtbar, Wochenlimit', () => {
    const { html } = willkommensMail({ ...BASIS, typ: 'gewerbe', organisationName: 'Bäckerei Maier', mitgliedRolle: 'verwalter' })
    expect(html).toContain('Betrieb')
    expect(html).toContain('Lokale Angebote')
    expect(html).toContain('erscheinen sofort')
    expect(html).not.toContain('von der Gemeindeverwaltung geprüft')
  })

  it('ohne Mitgliedsrolle gilt Verwalter (Einladung der Verwaltung für neuen Verein)', () => {
    const { html } = willkommensMail({ ...BASIS, typ: 'organisation', mitgliedRolle: null })
    expect(html).toContain('<strong>Verwalter</strong>')
    expect(html).toContain('Organisation')
  })

  it('bestehendes Konto: Anmelden und Link zum Dashboard', () => {
    const { html } = willkommensMail({ ...BASIS, typ: 'verein', mitgliedRolle: 'verwalter', eingeladen: false, link: 'https://ehningen.dorfly.de/dashboard' })
    expect(html).toContain('Zum Dashboard')
    expect(html).not.toContain('7 Tage')
  })

  it('ohne Namen ein neutraler Betreff und korrekte Grammatik', () => {
    const verein = willkommensMail({ ...BASIS, typ: 'verein', mitgliedRolle: 'verwalter', organisationName: null })
    expect(verein.betreff).toBe('Willkommen bei Dorfly Ehningen')
    expect(verein.html).toContain('für Ihren Verein in Dorfly')
    expect(verein.html).toContain('erreicht Ihr Verein die Menschen')
    const org = willkommensMail({ ...BASIS, typ: 'organisation', mitgliedRolle: 'verwalter', organisationName: null })
    expect(org.html).toContain('für Ihre Organisation in Dorfly')
    expect(org.html).toContain('So wird Ihre Organisation im Vereinsverzeichnis gefunden')
  })

  it('escaped Namen, Absender und Hinweis', () => {
    const { html } = willkommensMail({
      ...BASIS, typ: 'verein', mitgliedRolle: 'verwalter',
      organisationName: '<b>X</b>', absender: 'der Verein „<i>Y</i>“', hinweis: '<script>',
    })
    expect(html).not.toContain('<b>X</b>')
    expect(html).not.toContain('<i>Y</i>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;')
  })

  it('nennt den Vereinsnamen nicht doppelt, wenn ein Mitglied einlädt', () => {
    const { html } = willkommensMail({ ...BASIS, typ: 'verein', mitgliedRolle: 'autor', absender: 'der Verein „TSV Ehningen“' })
    expect(html).toContain('Sie wurden als <strong>Autor</strong> für <strong>TSV Ehningen</strong>')
    expect(html).not.toContain('der Verein')
  })

  it('Einladung der Verwaltung beginnt mit großem Buchstaben', () => {
    expect(willkommensMail({ ...BASIS, typ: 'verein', mitgliedRolle: 'verwalter' }).html)
      .toContain('Die Gemeindeverwaltung <strong>Ehningen</strong> hat Sie als')
  })

  it('verweist auf die Kontaktadresse statt auf „antworten“ (Absender ist noreply)', () => {
    const { html } = willkommensMail({ ...BASIS, typ: 'verein', mitgliedRolle: 'autor' })
    expect(html).toContain('mailto:hallo@dorfly.de')
    expect(html).not.toContain('Antworten Sie')
  })

  it('enthält den Play-Store-Link', () => {
    expect(willkommensMail({ ...BASIS, typ: 'verein', mitgliedRolle: 'autor' }).html)
      .toContain('play.google.com/store/apps/details?id=de.dorfly.app')
  })
})
