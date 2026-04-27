import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'
const DEFAULT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG ?? 'ehningen'

function extractSlug(hostname: string): string {
  if (
    hostname.includes('localhost') ||
    hostname.includes('vercel.app') ||
    hostname === ROOT_DOMAIN ||
    hostname === `www.${ROOT_DOMAIN}`
  ) {
    return DEFAULT_SLUG
  }
  return hostname.replace(`.${ROOT_DOMAIN}`, '')
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const slug = extractSlug(hostname)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-gemeinde-slug', slug)

  // Supabase session refresh
  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
