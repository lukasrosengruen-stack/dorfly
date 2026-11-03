import { describe, expect, it } from 'vitest'
import { mitVereinsabsender, vereinsIds, type AbsenderName } from './absender'

const NAMEN = new Map<string, AbsenderName>([
  ['v1', { name: 'TSV', typ: 'verein' }],
  ['o1', { name: 'Stadtmarketing', typ: 'organisation' }],
  ['g1', { name: 'Bäckerei Huber', typ: 'gewerbe' }],
])

describe('mitVereinsabsender', () => {
  it('setzt den Vereinsnamen aus org_id bei Vereinsbeiträgen', () => {
    expect(mitVereinsabsender({ channel: 'verein', org_id: 'v1' }, { display_name: 'Anna', verein_name: 'alt', role: 'verein' }, NAMEN))
      .toEqual({ display_name: 'Anna', verein_name: 'TSV', role: 'verein' })
  })

  it('erzeugt einen Absender, wenn der Autor gelöscht wurde', () => {
    expect(mitVereinsabsender({ channel: 'verein', org_id: 'v1' }, null, NAMEN))
      .toEqual({ display_name: null, verein_name: 'TSV', role: 'verein', avatar_url: null })
  })

  it('verwendet die Rolle organisation für Organisationen ohne Autor', () => {
    expect(mitVereinsabsender({ channel: 'verein', org_id: 'o1' }, null, NAMEN))
      .toEqual({ display_name: null, verein_name: 'Stadtmarketing', role: 'organisation', avatar_url: null })
  })

  it('erzeugt bei Gewerbebeiträgen ohne Autor einen Betriebsabsender', () => {
    expect(mitVereinsabsender({ channel: 'gewerbe', org_id: 'g1' }, null, NAMEN))
      .toEqual({ display_name: 'Bäckerei Huber', verein_name: null, role: 'gewerbe', avatar_url: null })
  })

  it('setzt bei Gewerbebeiträgen mit Autor keinen verein_name', () => {
    const autor = { display_name: 'Huber', verein_name: null, role: 'gewerbe' }
    expect(mitVereinsabsender({ channel: 'gewerbe', org_id: 'g1' }, autor, NAMEN)).toBe(autor)
  })

  it('liefert null, wenn der Name unbekannt ist und kein Autor existiert', () => {
    expect(mitVereinsabsender({ channel: 'gewerbe', org_id: 'x' }, null, NAMEN)).toBeNull()
  })

  it('lässt andere Kanäle unverändert', () => {
    const autor = { display_name: 'Rat', verein_name: null, role: 'gemeinderat' }
    expect(mitVereinsabsender({ channel: 'gemeinde', org_id: null }, autor, NAMEN)).toBe(autor)
  })
})

describe('vereinsIds', () => {
  it('Verein- und Gewerbebeiträge mit org_id, ohne Dubletten', () => {
    expect(vereinsIds([
      { channel: 'verein', org_id: 'v1' }, { channel: 'verein', org_id: 'v1' },
      { channel: 'gewerbe', org_id: 'g1' }, { channel: 'verein', org_id: null },
      { channel: 'gemeinde', org_id: 'x' },
    ])).toEqual(['v1', 'g1'])
  })
})
