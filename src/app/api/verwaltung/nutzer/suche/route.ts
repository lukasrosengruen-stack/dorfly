import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/verwaltung/nutzer/suche?email=... – Nutzer in der eigenen Gemeinde suchen
export const GET = withAuth(
  async (req: NextRequest, { profile }) => {
    const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim()
    if (!email) return apiError('E-Mail fehlt', 400)
    const queryGemeindeId = req.nextUrl.searchParams.get('gemeinde_id')
    const gemeindeId = (profile.role === 'super_admin' && queryGemeindeId)
      ? queryGemeindeId
      : profile.gemeinde_id
    if (!gemeindeId) return apiError('Keine Gemeinde zugewiesen', 400)

    const supabase = await createServiceClient()

    // Auth-User per E-Mail suchen (service_role kann auth.users abfragen)
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (authError) return apiError(authError.message)

    const authUser = users.find(u => u.email?.toLowerCase() === email)
    if (!authUser) return NextResponse.json({ nutzer: null })

    // Profil in der richtigen Gemeinde prüfen
    const { data: nutzerProfil } = await supabase
      .from('profiles')
      .select('id, display_name, role, gemeinde_id, created_at')
      .eq('id', authUser.id)
      .eq('gemeinde_id', gemeindeId)
      .single()

    if (!nutzerProfil) return NextResponse.json({ nutzer: null, grund: 'andere_gemeinde' })

    return NextResponse.json({
      nutzer: {
        id: nutzerProfil.id,
        email: authUser.email,
        display_name: nutzerProfil.display_name,
        vorname: null,
        nachname: null,
        role: nutzerProfil.role,
        erstellt_am: nutzerProfil.created_at,
      },
    })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
