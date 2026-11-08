import { describe, expect, it } from 'vitest'
import { istImFeedSichtbar } from './feedSichtbarkeit'

const ABOS = { gewerbe: new Set(['baecker']), vereine: new Set(['tsv']) }

describe('istImFeedSichtbar', () => {
  it('zeigt Beitraege der Gemeinde immer', () => {
    expect(istImFeedSichtbar({ channel: 'gemeinde', org_id: null, sichtbarkeit: null }, ABOS)).toBe(true)
  })

  it('zeigt Gewerbe-Beitraege nur abonnierter Betriebe', () => {
    expect(istImFeedSichtbar({ channel: 'gewerbe', org_id: 'baecker', sichtbarkeit: null }, ABOS)).toBe(true)
    expect(istImFeedSichtbar({ channel: 'gewerbe', org_id: 'metzger', sichtbarkeit: null }, ABOS)).toBe(false)
  })

  it('zeigt Vereinsbeitraege nur Abonnenten', () => {
    expect(istImFeedSichtbar({ channel: 'verein', org_id: 'tsv', sichtbarkeit: 'abonnenten' }, ABOS)).toBe(true)
    expect(istImFeedSichtbar({ channel: 'verein', org_id: 'chor', sichtbarkeit: 'abonnenten' }, ABOS)).toBe(false)
    expect(istImFeedSichtbar({ channel: 'verein', org_id: 'chor', sichtbarkeit: null }, ABOS)).toBe(false)
  })

  it('zeigt Gaesten alles, weil sie nichts abonnieren koennen', () => {
    expect(istImFeedSichtbar({ channel: 'gewerbe', org_id: 'metzger', sichtbarkeit: null }, null)).toBe(true)
    expect(istImFeedSichtbar({ channel: 'verein', org_id: 'chor', sichtbarkeit: 'abonnenten' }, null)).toBe(true)
  })

  it('zeigt Vereinsbeitraege fuer alle auch Nicht-Abonnenten', () => {
    expect(istImFeedSichtbar({ channel: 'verein', org_id: 'chor', sichtbarkeit: 'alle' }, ABOS)).toBe(true)
  })
})
