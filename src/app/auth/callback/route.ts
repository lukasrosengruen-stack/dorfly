import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { profilAnlegen, type RegistrierungsDaten } from '@/lib/profil-anlegen'
import type { Database } from '@/types/supabase'
import type { User } from '@supabase/supabase-js'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'

export async function GET(request: NextRequest) {
  const { searchParams, origin, hostname } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type')
  const next       = searchParams.get('next') ?? '/home'

  const cookieStore = await cookies()
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => { pendingCookies.push(...cookiesToSet) },
      },
    }
  )

  let user: User | null = null

  if (code) {
    // PKCE-Flow: initiale Registrierungsbestätigung (gleicher Browser)
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession fehlgeschlagen:', error.message, error.status)
      // PKCE-Code vorhanden aber Austausch fehlgeschlagen = Link in anderem Browser geöffnet
      // (z.B. Registrierung im Inkognito-Fenster, E-Mail-Link öffnet im normalen Browser)
      return NextResponse.redirect(new URL('/login?error=wrong_browser', origin))
    }
    user = data.user
  } else if (token_hash && type) {
    // OTP-Flow: "Erneut senden"-Bestätigung oder anderer Browser
    // Tritt auf wenn der Link in einem anderen Browser geöffnet wird als dem,
    // in dem die Registrierung gestartet wurde (PKCE-Cookie fehlt).
    const { error, data } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
    })
    if (error) console.error('[auth/callback] verifyOtp fehlgeschlagen:', error.message)
    else user = data.user
  }

  if (user) {
    const meta = user.user_metadata ?? {}
    const regDaten: RegistrierungsDaten = {
      vorname: meta.vorname,
      nachname: meta.nachname,
      token: meta.einladungs_token,
    }
    await profilAnlegen(user.id, { email: user.email ?? undefined, ...regDaten }).catch(async (err) => {
      console.error('[auth/callback] profilAnlegen fehlgeschlagen, versuche Fallback:', err)

      const callbackSlug = hostname.endsWith(ROOT_DOMAIN)
        ? hostname.slice(0, -(ROOT_DOMAIN.length + 1))
        : null

      let gemeindeId: string | null = null
      if (callbackSlug && callbackSlug !== 'www') {
        const { data: gm } = await supabase
          .from('gemeinden')
          .select('id')
          .eq('slug', callbackSlug)
          .single()
        gemeindeId = gm?.id ?? null
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: user!.id, role: 'buerger', gemeinde_id: gemeindeId, email: null }, { onConflict: 'id' })
      if (upsertError) console.error('[auth/callback] Fallback-Profil fehlgeschlagen:', upsertError)
    })

    const { data: profile } = await supabase
      .from('profiles')
      .select('gemeinden(slug)')
      .eq('id', user.id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slug = (profile as any)?.gemeinden?.slug as string | undefined
    const targetOrigin = slug ? `https://${slug}.${ROOT_DOMAIN}` : origin

    const response = NextResponse.redirect(new URL(next, targetOrigin))

    const cookieDomain = hostname.endsWith(ROOT_DOMAIN) ? `.${ROOT_DOMAIN}` : undefined
    pendingCookies.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, { ...(options as Parameters<typeof response.cookies.set>[2]), domain: cookieDomain })
    )

    return response
  }

  return NextResponse.redirect(new URL('/login?error=confirmation_failed', origin))
}
