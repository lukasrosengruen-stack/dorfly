export type GemeindeFeatures = {
  abfallkalender?:      boolean
  umfragen?:            boolean
  gemeinderat?:         boolean
  gewerbe?:             boolean
  vereine?:             boolean
  marktplatz?:          boolean
  buergermeisterLabel?: 'buergermeister' | 'verwaltung'
}

type FeatureToggleKey = Exclude<keyof GemeindeFeatures, 'buergermeisterLabel'>

export function getFeatures(gemeinde: { features: unknown } | null | undefined): GemeindeFeatures {
  if (!gemeinde?.features || typeof gemeinde.features !== 'object' || Array.isArray(gemeinde.features)) {
    return {}
  }
  return gemeinde.features as GemeindeFeatures
}

export function isFeatureAktiv(
  gemeinde: { features: unknown } | null | undefined,
  feature: FeatureToggleKey,
): boolean {
  return getFeatures(gemeinde)[feature] === true
}

export function getBuergermeisterLabel(
  gemeinde: { features: unknown } | null | undefined,
): { long: string; short: string } {
  const label = getFeatures(gemeinde).buergermeisterLabel ?? 'buergermeister'
  if (label === 'verwaltung') {
    return { long: 'Frag die Verwaltung', short: 'Verwaltung' }
  }
  return { long: 'Frag den Bürgermeister', short: 'Frag BM' }
}
