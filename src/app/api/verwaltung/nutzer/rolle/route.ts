import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { validate, rolleZuweisenSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { sendeRollenentzugEmail, sendeRollenzuweisungEmail } from '@/lib/email'
import type { UserRole } from '@/types/supabase'

// PATCH /api/verwaltung/nutzer/rolle – Einem bestehenden Nutzer eine Rolle direkt zuweisen
export const PATCH = withAuth(
  async (req: NextRequest, { profile }) => {
    const body = await req.json()
    const v = validate(rolleZuweisenSchema, body)
    if (!v.success) return v.error

    const gemeindeId = (profile.role === 'super_admin' && v.data.gemeinde_id)
      ? v.data.gemeinde_id
      : profile.gemeinde_id
    if (!gemeindeId) return apiError('Keine Gemeinde zugewiesen', 400)

    if (v.data.neueRolle === 'verwaltung' && profile.role !== 'super_admin') {
      return apiError('Nur Super-Admins können die Verwaltungs-Rolle vergeben', 403)
    }

    const { email, neueRolle, organisation_name, verein_id, org_id } = v.data
    const supabase = await createServiceClient()

    const { data: zielProfil } = await supabase
      .from('profiles')
      .select('id, display_name, role, gemeinde_id')
      .eq('email', email.toLowerCase())
      .eq('gemeinde_id', gemeindeId)
      .single()

    if (!zielProfil) return apiError('Nutzer gehört nicht zu dieser Gemeinde', 404)
    if (zielProfil.role === neueRolle) return apiError('Nutzer hat diese Rolle bereits', 400)

    const { data: gemeinde } = await supabase
      .from('gemeinden')
      .select('name')
      .eq('id', gemeindeId)
      .single()

    const alteRolle = zielProfil.role
    const gemeindeName = gemeinde?.name ?? ''
    let orgName: string | null = organisation_name ?? null

    // Bei Transfer eines bestehenden Vereins/Org: alten Inhaber automatisch degradieren
    if (neueRolle === 'verein' && verein_id) {
      const { data: alterVerein } = await supabase
        .from('vereine')
        .select('profile_id, verein_name, profiles!inner(id, display_name, role, email)')
        .eq('id', verein_id)
        .eq('gemeinde_id', gemeindeId)
        .single()

      if (alterVerein?.profile_id && alterVerein.profile_id !== zielProfil.id) {
        const alterInhaber = alterVerein.profiles as unknown as { id: string; display_name: string | null; role: string; email: string | null } | null
        if (alterInhaber && alterInhaber.role === 'verein') {
          await supabase.from('profiles').update({ role: 'buerger' }).eq('id', alterVerein.profile_id)

          if (alterInhaber.email) {
            await sendeRollenentzugEmail({
              to: alterInhaber.email,
              name: alterInhaber.display_name,
              gemeindeName,
              alteRolle: 'verein',
            })
          }
          await supabase.from('rollen_log').insert({
            gemeinde_id: gemeindeId,
            aktion: 'rolle_transfer',
            ziel_profile_id: alterVerein.profile_id,
            ziel_email: alterInhaber.email ?? '',
            alte_rolle: 'verein',
            neue_rolle: 'buerger',
            ausgefuehrt_von: profile.id,
          })
        }
      }

      await supabase.from('vereine').update({ profile_id: zielProfil.id }).eq('id', verein_id)
      orgName = alterVerein?.verein_name ?? orgName

    } else if (['organisation', 'gewerbe'].includes(neueRolle) && org_id) {
      const { data: alteOrg } = await supabase
        .from('organisationen')
        .select('profile_id, name, profiles!inner(id, display_name, role, email)')
        .eq('id', org_id)
        .eq('gemeinde_id', gemeindeId)
        .single()

      if (alteOrg?.profile_id && alteOrg.profile_id !== zielProfil.id) {
        const alterInhaber = alteOrg.profiles as unknown as { id: string; display_name: string | null; role: string; email: string | null } | null
        if (alterInhaber && ['organisation', 'gewerbe'].includes(alterInhaber.role)) {
          await supabase.from('profiles').update({ role: 'buerger' }).eq('id', alteOrg.profile_id)

          if (alterInhaber.email) {
            await sendeRollenentzugEmail({
              to: alterInhaber.email,
              name: alterInhaber.display_name,
              gemeindeName,
              alteRolle: alterInhaber.role,
            })
          }
          await supabase.from('rollen_log').insert({
            gemeinde_id: gemeindeId,
            aktion: 'rolle_transfer',
            ziel_profile_id: alteOrg.profile_id,
            ziel_email: alterInhaber.email ?? '',
            alte_rolle: alterInhaber.role,
            neue_rolle: 'buerger',
            ausgefuehrt_von: profile.id,
          })
        }
      }

      await supabase.from('organisationen').update({ profile_id: zielProfil.id }).eq('id', org_id)
      orgName = alteOrg?.name ?? orgName

    } else if (neueRolle === 'verein' && organisation_name) {
      await supabase.from('vereine').insert({
        profile_id: zielProfil.id,
        gemeinde_id: gemeindeId,
        verein_name: organisation_name,
        typ: 'verein',
      })
    } else if (['organisation', 'gewerbe'].includes(neueRolle) && organisation_name) {
      await supabase.from('organisationen').insert({
        profile_id: zielProfil.id,
        gemeinde_id: gemeindeId,
        name: organisation_name,
        typ: neueRolle as 'gewerbe' | 'verein' | 'institution',
      })
    }

    // Neue Rolle setzen
    const { error: rolleUpdateError } = await supabase
      .from('profiles')
      .update({ role: neueRolle as UserRole })
      .eq('id', zielProfil.id)

    if (rolleUpdateError) return apiError(`Rolle konnte nicht gesetzt werden: ${rolleUpdateError.message}`)

    // Offene Einladungen für diesen Nutzer widerrufen
    await supabase
      .from('einladungen')
      .update({ status: 'widerrufen' })
      .eq('email', email.toLowerCase())
      .eq('gemeinde_id', gemeindeId)
      .eq('status', 'offen')

    // Audit-Log für den Ziel-Nutzer
    await supabase.from('rollen_log').insert({
      gemeinde_id: gemeindeId,
      aktion: alteRolle !== 'buerger' ? 'rolle_transfer' : 'rolle_gesetzt',
      ziel_profile_id: zielProfil.id,
      ziel_email: email.toLowerCase(),
      alte_rolle: alteRolle,
      neue_rolle: neueRolle,
      ausgefuehrt_von: profile.id,
    })

    // E-Mail an Ziel-Nutzer
    if (neueRolle === 'buerger' && alteRolle !== 'buerger') {
      await sendeRollenentzugEmail({ to: email, name: zielProfil.display_name, gemeindeName, alteRolle })
    } else {
      await sendeRollenzuweisungEmail({ to: email, name: zielProfil.display_name, gemeindeName, neueRolle, organisationName: orgName })
    }

    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
