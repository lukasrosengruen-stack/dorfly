import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { profilAnlegen, type RegistrierungsDaten } from '@/lib/profil-anlegen'
import type { Database } from '@/types/supabase'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'

export async function GET(request: NextRequest) {
  const { searchParams, origin, hostname } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/home'

  if (code) {
    const cookieStore = await cookies()

    // Collect cookies first so we can apply them after we know the target origin
    const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            pendingCookies.push(...cookiesToSet)
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const meta = data.user.user_metadata ?? {}
      const regDaten: RegistrierungsDaten = {
        vorname: meta.vorname,
        nachname: meta.nachname,
        token: meta.einladungs_token,
      }
      await profilAnlegen(data.user.id, { email: data.user.email ?? undefined, ...regDaten }).catch(async (err) => {
        console.error('[auth/callback] profilAnlegen fehlgeschlagen, versuche Fallback:', err)

        // Fallback: minimales Profil direkt per User-Session anlegen.
        // Gemeinde aus der Callback-Domain ableiten (z.B. musterbach.dorfly.de → musterbach).
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
          .upsert({ id: data.user.id, role: 'buerger', gemeinde_id: gemeindeId, email: null }, { onConflict: 'id' })
        if (upsertError) console.error('[auth/callback] Fallback-Profil fehlgeschlagen:', upsertError)
      })

      // Gemeinde-Subdomain des Users ermitteln für korrekten Redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('gemeinden(slug)')
        .eq('id', data.user.id)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slug = (profile as any)?.gemeinden?.slug as string | undefined
      const targetOrigin = slug ? `https://${slug}.${ROOT_DOMAIN}` : origin

      const response = NextResponse.redirect(new URL(next, targetOrigin))

      // Cookies mit .dorfly.de-Domain setzen, damit sie auf allen Subdomains gelten
      const cookieDomain = hostname.endsWith(ROOT_DOMAIN) ? `.${ROOT_DOMAIN}` : undefined
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, { ...(options as Parameters<typeof response.cookies.set>[2]), domain: cookieDomain })
      )

      return response
    }
  }

  return NextResponse.redirect(new URL('/login?error=confirmation_failed', origin))
}
