interface FeedBeitrag {
  channel: string
  org_id: string | null
  sichtbarkeit?: string | null
}

interface Abos {
  gewerbe: Set<string>
  vereine: Set<string>
}

/**
 * Ob ein Beitrag in den Feed eines Nutzers gehört. Der Feed ist ein Abo-Feed:
 * Gewerbe-Beiträge nur von abonnierten Betrieben, Vereinsbeiträge nur für
 * Abonnenten — außer der Verein hat sie für alle freigegeben.
 */
export function istImFeedSichtbar(p: FeedBeitrag, abos: Abos): boolean {
  if (p.channel === 'gewerbe' && p.org_id && !abos.gewerbe.has(p.org_id)) return false
  if (p.channel === 'verein' && p.org_id && p.sichtbarkeit !== 'alle' && !abos.vereine.has(p.org_id)) return false
  return true
}
