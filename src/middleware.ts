import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/start', '/posts/', '/api/', '/auth/']
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
  if (slug !== null) {
    requestHeaders.set('x-gemeinde-slug', slug)
  }

  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  if (isPublic) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (slug === null) {
    return NextResponse.redirect(new URL('/start', request.url))
  }

  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|OneSignalSDKWorker\\.js).*)'],
}
