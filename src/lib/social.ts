export type SocialPlatform = 'x' | 'facebook' | 'instagram' | 'tiktok'

export function normalizeSocialUsername(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
}

export function buildSocialUrl(platform: SocialPlatform, username: string): string {
  switch (platform) {
    case 'x':         return `https://x.com/${username}`
    case 'facebook':  return `https://facebook.com/${username}`
    case 'instagram': return `https://instagram.com/${username}`
    case 'tiktok':    return `https://tiktok.com/@${username}`
  }
}
