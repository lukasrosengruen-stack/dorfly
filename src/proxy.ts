import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/api/']
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') ?? ''
  const slug = extractSlug(hostname)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-gemeinde-slug', slug)

  const isPublic = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons).*)'],
}
