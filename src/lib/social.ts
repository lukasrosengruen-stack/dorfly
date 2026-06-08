export type SocialPlatform = 'x' | 'facebook' | 'instagram' | 'tiktok'

export function normalizeSocialUsername(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
}

const SOCIAL_URL_MAP: Record<SocialPlatform, (username: string) => string> = {
  x:         username => `https://x.com/${username}`,
  facebook:  username => `https://facebook.com/${username}`,
  instagram: username => `https://instagram.com/${username}`,
  tiktok:    username => `https://tiktok.com/@${username}`,
}

export function buildSocialUrl(platform: SocialPlatform, username: string): string {
  return SOCIAL_URL_MAP[platform](username)
}
