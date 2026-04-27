import { headers } from 'next/headers'

export async function getGemeindeSlug(): Promise<string> {
  const h = await headers()
  return h.get('x-gemeinde-slug') ?? process.env.NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG ?? 'ehningen'
}
