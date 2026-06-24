import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/api/', '/auth/', '/push-register']
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'
const DEFAULT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_GEMEINDE_SLUG ?? 'ehningen'

function extractSlug(hostname: string): string {
  // Reines localhost (ohne Subdomain) → Default-Slug
  if (hostname === 'localhost' || /^localhost:\d+$/.test(hostname)) {
    return DEFAULT_SLUG
  }

  // *.localhost (z.B. ehningen.localhost:3000) → Subdomain extrahieren
  if (hostname.includes('.localhost')) {
    return hostname.split('.localhost')[0]
  }

  // Vercel Preview-Deployments → Default-Slug
  if (hostname.includes('vercel.app')) {
    return DEFAULT_SLUG
  }

  // Root-Domain (dorfly.de / www.dorfly.de) → Default-Slug
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return DEFAULT_SLUG
  }

  // Subdomain (ehningen.dorfly.de) → Slug extrahieren
  return hostname.replace(`.${ROOT_DOMAIN}`, '')
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? ''
  const slug = extractSlug(hostname)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-gemeinde-slug', slug)

  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons).*)'],
}
