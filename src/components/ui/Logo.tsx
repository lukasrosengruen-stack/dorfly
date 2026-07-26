/**
 * Logo – Dorfly-Wortmarke
 *
 * Feste Markenfarben, unabhängig vom Gemeinde-Theme (primary-500/accent-500
 * werden pro Gemeinde überschrieben, die Wortmarke bleibt immer Dorfly-blau).
 *
 * @example
 * <Logo size={24} />
 */
const COLORS = {
  blue: '#0057A8',
  navy: '#0D1B2A',
  green: '#00A878',
} as const

export interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        fontSize: size,
        fontWeight: 800,
        letterSpacing: '-0.04em',
        display: 'inline-flex',
        alignItems: 'baseline',
      }}
    >
      <span style={{ color: COLORS.blue }}>Dorf</span>
      <span style={{ color: COLORS.navy }}>ly</span>
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '0.16em',
          height: '0.16em',
          borderRadius: '50%',
          background: COLORS.green,
          marginLeft: '0.06em',
        }}
      />
    </span>
  )
}
