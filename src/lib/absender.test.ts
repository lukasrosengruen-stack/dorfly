import { describe, expect, it } from 'vitest'
import { mitVereinsabsender, vereinsIds } from './absender'

const NAMEN = new Map([['v1', 'TSV']])

describe('mitVereinsabsender', () => {
  it('setzt den Vereinsnamen aus org_id bei Vereinsbeiträgen', () => {
    expect(mitVereinsabsender({ channel: 'verein', org_id: 'v1' }, { display_name: 'Anna', verein_name: 'alt', role: 'verein' }, NAMEN))
      .toEqual({ display_name: 'Anna', verein_name: 'TSV', role: 'verein' })
  })

  it('erzeugt einen Absender, wenn der Autor gelöscht wurde', () => {
    expect(mitVereinsabsender({ channel: 'verein', org_id: 'v1' }, null, NAMEN))
      .toEqual({ display_name: null, verein_name: 'TSV', role: 'verein', avatar_url: null })
  })

  it('lässt andere Kanäle unverändert', () => {
    const autor = { display_name: 'Rat', verein_name: null, role: 'gemeinderat' }
    expect(mitVereinsabsender({ channel: 'gemeinde', org_id: null }, autor, NAMEN)).toBe(autor)
  })
})

describe('vereinsIds', () => {
  it('nur Vereinsbeiträge mit org_id, ohne Dubletten', () => {
    expect(vereinsIds([
      { channel: 'verein', org_id: 'v1' }, { channel: 'verein', org_id: 'v1' },
      { channel: 'gewerbe', org_id: 'g1' }, { channel: 'verein', org_id: null },
    ])).toEqual(['v1'])
  })
})
