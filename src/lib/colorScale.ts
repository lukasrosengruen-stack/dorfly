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

export function generateColorScale(baseHex: string): ColorScale {
  const { h, s, l } = hexToHsl(baseHex)
  const scale = { '500': hslToHex(h, s, l) } as ColorScale

  for (const shade of Object.keys(LIGHTER_MIX) as (keyof typeof LIGHTER_MIX)[]) {
    const mix = LIGHTER_MIX[shade]
    scale[shade] = hslToHex(h, s, l + (1 - l) * mix)
  }
  for (const shade of Object.keys(DARKER_MIX) as (keyof typeof DARKER_MIX)[]) {
    const mix = DARKER_MIX[shade]
    scale[shade] = hslToHex(h, s, l * (1 - mix))
  }

  return scale
}
