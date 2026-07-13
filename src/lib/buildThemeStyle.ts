import { generateColorScale } from '@/lib/colorScale'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/**
 * Builds the `:root {...}` CSS string injected via `dangerouslySetInnerHTML`
 * in the root layout. Validates each color against a strict hex format before
 * expanding it into a full shade scale via `generateColorScale` — invalid or
 * missing colors are silently skipped rather than throwing, since this runs
 * on every page load for every gemeinde.
 */
export function buildThemeStyle(primaryColor?: string | null, accentColor?: string | null): string | null {
  const declarations: string[] = []

  if (primaryColor && HEX_RE.test(primaryColor)) {
    const scale = generateColorScale(primaryColor)
    for (const [shade, hex] of Object.entries(scale)) {
      declarations.push(`--gemeinde-primary-${shade}: ${hex};`)
    }
  }
  if (accentColor && HEX_RE.test(accentColor)) {
    const scale = generateColorScale(accentColor)
    for (const [shade, hex] of Object.entries(scale)) {
      declarations.push(`--gemeinde-accent-${shade}: ${hex};`)
    }
  }

  return declarations.length > 0 ? `:root { ${declarations.join(' ')} }` : null
}
