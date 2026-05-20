import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { profilAnlegen, type RegistrierungsDaten } from '@/lib/profil-anlegen'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'

  if (code) {
    const cookieStore = await cookies()
    const response = NextResponse.redirect(new URL(next, origin))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      let regDaten: RegistrierungsDaten = {}
      const regCookie = cookieStore.get('dorfly_reg')
      if (regCookie?.value) {
        try {
          regDaten = JSON.parse(decodeURIComponent(regCookie.value))
        } catch { /* ungültiges Cookie ignorieren */ }
        response.cookies.set('dorfly_reg', '', { expires: new Date(0), path: '/' })
      }

      await profilAnlegen(data.user.id, { email: data.user.email ?? undefined, ...regDaten }).catch(console.error)

      return response
    }
  }

  return NextResponse.redirect(new URL('/login?error=confirmation_failed', origin))
}
