import { createBrowserClient } from '@supabase/ssr'
import { authCookieDomain } from '@/lib/previewUmgebung'
import type { Database } from '@/types/supabase'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'
// Cross-subdomain cookies: PKCE-Verifier und Session-Token gelten auf allen Subdomains
const COOKIE_DOMAIN = authCookieDomain(ROOT_DOMAIN)

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    COOKIE_DOMAIN ? { cookieOptions: { domain: COOKIE_DOMAIN } } : undefined
  )
}
