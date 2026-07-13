export type ColorScale = {
  '50': string; '100': string; '200': string; '300': string; '400': string
  '500': string; '600': string; '700': string; '800': string; '900': string
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return { h, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const toChannel = (n: number): string => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(Math.min(Math.max(c, 0), 1) * 255).toString(16).padStart(2, '0')
  }
  return `#${toChannel(0)}${toChannel(8)}${toChannel(4)}`
}

const LIGHTER_MIX = { '50': 0.92, '100': 0.8, '200': 0.6, '300': 0.4, '400': 0.18 } as const
const DARKER_MIX = { '600': 0.15, '700': 0.3, '800': 0.45, '900': 0.6 } as const

/**
 * Maps every value of a record through `fn`, preserving the exact key set in
 * the type system. Used so that `ColorScale`'s key set drives both the
 * lightness-mix table and the final hex map — adding a shade to `ColorScale`
 * without a corresponding entry becomes a compile error instead of a
 * silent `undefined` at runtime.
 */
function mapRecord<K extends string, V, R>(record: Record<K, V>, fn: (value: V, key: K) => R): Record<K, R> {
  return Object.fromEntries(
    (Object.entries(record) as [K, V][]).map(([key, value]) => [key, fn(value, key)]),
  ) as Record<K, R>
}

export function generateColorScale(baseHex: string): ColorScale {
  if (!/^#[0-9a-fA-F]{6}$/.test(baseHex)) {
    throw new Error(`generateColorScale: invalid hex color "${baseHex}", expected format #rrggbb`)
  }
  const { h, s, l } = hexToHsl(baseHex)

  const lightness: Record<keyof ColorScale, number> = {
    ...mapRecord(LIGHTER_MIX, mix => l + (1 - l) * mix),
    '500': l,
    ...mapRecord(DARKER_MIX, mix => l * (1 - mix)),
  }

  return mapRecord(lightness, lVal => hslToHex(h, s, lVal))
}
