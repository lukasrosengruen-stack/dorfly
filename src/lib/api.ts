/**
 * API-Hilfsfunktionen
 *
 * withAuth – zentrale Authentifizierungs- und Autorisierungsschicht für alle API-Routes.
 * Verhindert, dass jede Route Auth-Code dupliziert.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import type { Profile } from '@/types/database'
import type { User } from '@supabase/supabase-js'

export interface AuthContext {
  user: User
  profile: Profile
}

type AuthHandler = (req: NextRequest, ctx: AuthContext) => Promise<NextResponse>

interface WithAuthOptions {
  /**
   * Erlaubte Rollen. Wenn angegeben, müssen Nutzer eine dieser Rollen haben.
   * Wenn leer oder nicht angegeben, reicht jede angemeldete Person.
   */
  roles?: UserRole[]
}

/**
 * Higher-Order Function für API-Routes.
 *
 * Prüft automatisch:
 * - Ob der Nutzer eingeloggt ist (401 wenn nicht)
 * - Ob das Profil existiert (401 wenn nicht)
 * - Ob die Rolle ausreicht (403 wenn nicht)
 *
 * Übergib den handler dann an Next.js als Route-Handler:
 * @example
 * export const POST = withAuth(async (req, { user, profile }) => {
 *   // eigene Logik
 * }, { roles: ['verwaltung', 'super_admin'] })
 */
export function withAuth(handler: AuthHandler, options?: WithAuthOptions) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) {
        return NextResponse.json({ error: 'Profil nicht gefunden' }, { status: 401 })
      }

      if (options?.roles?.length && !options.roles.includes(profile.role as UserRole)) {
        return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      }

      return await handler(req, { user, profile: profile as Profile })
    } catch (e) {
      console.error('[withAuth] Unerwarteter Fehler:', e)
      return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
    }
  }
}

/**
 * Gibt eine einheitliche Fehlerantwort zurück.
 */
export function apiError(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Gibt eine einheitliche Erfolgsantwort zurück.
 */
export function apiOk(data?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ ok: true, ...data })
}
