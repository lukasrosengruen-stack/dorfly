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
    // PKCE-Flow: Primärpfad (gleicher Browser wie Registrierung)
    const { error: pkceError, data: pkceData } = await supabase.auth.exchangeCodeForSession(code)
    if (!pkceError) {
      user = pkceData.user
    } else {
      console.error('[auth/callback] exchangeCodeForSession fehlgeschlagen:', pkceError.message, pkceError.status)
      // PKCE gescheitert (anderer Browser/Inkognito). Neuere Supabase-Versionen senden
      // token_hash zusätzlich zum code – diesen als Fallback versuchen, er funktioniert
      // browserunabhängig und bestätigt auch die E-Mail.
      if (token_hash && type) {
        const { error: otpError, data: otpData } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'email_change',
        })
        if (otpError) console.error('[auth/callback] verifyOtp-Fallback fehlgeschlagen:', otpError.message)
        else user = otpData.user
      }
    }
  } else if (token_hash && type) {
    // Nur token_hash (kein code): z.B. "Erneut senden"-E-Mail
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
      termsAcceptedAt: meta.terms_accepted_at,
      termsVersion: meta.terms_version,
      ageConfirmedAt: meta.age_confirmed_at,
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
        .upsert({
          id: user!.id,
          role: 'buerger',
          gemeinde_id: gemeindeId,
          email: null,
          terms_accepted_at: meta.terms_accepted_at ?? null,
          terms_version: meta.terms_version ?? null,
          age_confirmed_at: meta.age_confirmed_at ?? null,
        }, { onConflict: 'id' })
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
