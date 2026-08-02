import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isGuestRoute } from '@/lib/guestRoutes'

const PUBLIC_ROUTES = ['/login', '/start', '/homepage', '/posts/', '/api/', '/auth/', '/datenschutz', '/impressum', '/nutzungsbedingungen', '/support']
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'
// Muss zu lib/supabase/client.ts und server.ts passen — sonst schreibt die
// Middleware das erneuerte Token auf eine andere Cookie-Domain als der Rest.
const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? `.${ROOT_DOMAIN}` : undefined

function extractSlug(hostname: string): string | null {
  // Port strippen, damit dorfly.de:3000 korrekt als Root-Domain erkannt wird
  const host = hostname.replace(/:\d+$/, '')

  // Reines localhost (ohne Subdomain) → Env-Variable oder null
  if (host === 'localhost') {
    return process.env.NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG ?? null
  }

  // *.localhost (z.B. ehningen.localhost:3000) → Subdomain extrahieren
  if (host.includes('.localhost')) {
    return host.split('.localhost')[0]
  }

  // Vercel Preview-Deployments → kein Slug
  if (host.includes('vercel.app')) {
    return null
  }

  // Root-Domain (dorfly.de / www.dorfly.de) → kein Slug
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) {
    return null
  }

  // Subdomain (ehningen.dorfly.de) → Slug extrahieren
  return host.replace(`.${ROOT_DOMAIN}`, '')
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? ''
  const slug = extractSlug(hostname)

  const requestHeaders = new Headers(request.headers)
  // SICHERHEIT: Einen vom Client mitgeschickten x-gemeinde-slug-Header nie vertrauen.
  // Er wird ausschließlich serverseitig aus dem Host abgeleitet gesetzt. Ohne dieses
  // delete könnte er auf der Apex-Domain (slug === null) durchgereicht und gefälscht werden.
  requestHeaders.delete('x-gemeinde-slug')
  if (slug !== null) {
    requestHeaders.set('x-gemeinde-slug', slug)
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } })

  // Ohne Auth-Cookie gibt es nichts zu erneuern — dann sparen wir uns den
  // Roundtrip zum Auth-Server (Gäste, Login, Marketingseiten).
  const hatAuthCookie = request.cookies
    .getAll()
    .some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  let user = null

  if (hatAuthCookie) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Erst in den Request spiegeln, damit die nachgelagerten Server
            // Components in diesem Durchlauf bereits das neue Token sehen.
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request: { headers: requestHeaders } })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(
                name,
                value,
                COOKIE_DOMAIN ? { ...options, domain: COOKIE_DOMAIN } : options,
              ),
            )
          },
        },
      },
    )

    // Muss aufgerufen werden: getUser() stößt den Refresh an und damit setAll().
    // Vorher prüfte die Middleware nur, ob ein Cookie existiert — in Server
    // Components erneuerte Tokens gingen dadurch verloren, weil cookies().set()
    // dort wirkungslos ist und der catch-Block sie still verschluckt hat.
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  // Erneuerte Auth-Cookies auch auf Redirects/Rewrites mitnehmen, sonst geht das
  // frische Token ausgerechnet bei den weiterleitenden Requests verloren.
  function mitAuthCookies(ziel: NextResponse) {
    response.cookies.getAll().forEach(cookie => ziel.cookies.set(cookie))
    return ziel
  }

  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  if (isPublic) {
    return response
  }

  if (slug === null) {
    if (pathname === '/') {
      return mitAuthCookies(NextResponse.rewrite(new URL('/homepage', request.url)))
    }
    return mitAuthCookies(NextResponse.redirect(new URL('/homepage', request.url)))
  }

  // Gäste (ohne gültige Session) dürfen die nicht-account-basierten Routen sehen
  // (App-Store 5.1.1(v)). Der x-gemeinde-slug-Header ist oben bereits gesetzt.
  if (!user && !isGuestRoute(pathname)) {
    return mitAuthCookies(NextResponse.redirect(new URL('/login', request.url)))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|screenshots|badges|OneSignalSDKWorker\\.js|lukas-rosengruen\\.jpg).*)'],
}