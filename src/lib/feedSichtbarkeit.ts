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
 *
 * `abos = null` steht für Gäste: Sie können nichts abonnieren und sehen deshalb
 * alles, so wie angemeldete Nutzer standardmäßig alles abonniert haben.
 */
export function istImFeedSichtbar(p: FeedBeitrag, abos: Abos | null): boolean {
  if (!abos) return true
  if (p.channel === 'gewerbe' && p.org_id && !abos.gewerbe.has(p.org_id)) return false
  if (p.channel === 'verein' && p.org_id && p.sichtbarkeit !== 'alle' && !abos.vereine.has(p.org_id)) return false
  return true
}
