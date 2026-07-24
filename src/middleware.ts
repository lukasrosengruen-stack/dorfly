import { NextResponse, type NextRequest } from 'next/server'
import { isGuestRoute } from '@/lib/guestRoutes'

const PUBLIC_ROUTES = ['/login', '/start', '/homepage', '/posts/', '/api/', '/auth/', '/datenschutz', '/impressum', '/nutzungsbedingungen', '/support']
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'

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

export default function proxy(request: NextRequest) {
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

  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  if (isPublic) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (slug === null) {
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/homepage', request.url))
    }
    return NextResponse.redirect(new URL('/homepage', request.url))
  }

  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  // Gäste (ohne Session) dürfen die nicht-account-basierten Routen sehen (App-Store 5.1.1(v)).
  // Der x-gemeinde-slug-Header ist oben bereits gesetzt und wird mit durchgereicht.
  if (!hasSession && !isGuestRoute(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|screenshots|OneSignalSDKWorker\\.js).*)'],
}
