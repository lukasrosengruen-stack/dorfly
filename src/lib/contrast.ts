function relativeLuminance(hex: string): number {
  const channels = [0, 2, 4].map(i => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = channels.map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}
