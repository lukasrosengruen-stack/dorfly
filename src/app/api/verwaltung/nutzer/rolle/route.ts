import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { validate, rolleZuweisenSchema } from '@/lib/validations'
import { createServiceClient } from '@/lib/supabase/server'
import { sendeRollenentzugEmail, sendeRollenzuweisungEmail } from '@/lib/email'
import { meineMitgliedschaft, rpcFehler } from '@/lib/mitgliedschaft'
import type { UserRole } from '@/types/database'

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

    const { email, neueRolle, organisation_name } = v.data
    const supabase = await createServiceClient()

    const { data: zielProfil } = await supabase
      .from('profiles')
      .select('id, display_name, role, gemeinde_id')
      .eq('email', email.toLowerCase())
      .eq('gemeinde_id', gemeindeId)
      .single()

    if (!zielProfil) return apiError('Nutzer gehört nicht zu dieser Gemeinde', 404)
    const mitgliedschaft = await meineMitgliedschaft(supabase, zielProfil.id)
    const vereinsRolle = ['verein', 'organisation', 'gewerbe'].includes(neueRolle)
    const orgName: string | null = organisation_name ?? null
    // Reparaturfall: Rolle ohne Mitgliedschaft (verwaist) – mit Namen legt verein_anlegen den Verein an.
    const reparatur = vereinsRolle && !!orgName && !mitgliedschaft
    if (zielProfil.role === neueRolle && !reparatur) return apiError('Nutzer hat diese Rolle bereits', 400)

    const { data: gemeinde } = await supabase
      .from('gemeinden')
      .select('name, slug')
      .eq('id', gemeindeId)
      .single()

    const alteRolle = zielProfil.role
    const gemeindeName = gemeinde?.name ?? ''

    if (mitgliedschaft) {
      // Mitglieder wechseln nicht still die Rolle: erst aus dem Verein entfernen.
      if (neueRolle !== 'buerger') {
        return apiError(
          'Diese Person ist Mitglied eines Vereins oder Gewerbes. Bitte entfernen Sie sie zuerst dort (Bereich „Vereine & Gewerbe“).',
          409,
        )
      }
      const { error } = await supabase.rpc('mitglied_entfernen', {
        p_profile_id: zielProfil.id,
        p_ausgefuehrt_von: profile.id,
      })
      if (error) {
        const f = rpcFehler(error)
        return apiError(f.meldung, f.status)
      }
    } else if (vereinsRolle && orgName) {
      // Neuen Verein/Gewerbe anlegen, Person wird Verwalter (protokolliert die Funktion)
      const { error } = await supabase.rpc('verein_anlegen', {
        p_profile_id: zielProfil.id,
        p_typ: neueRolle,
        p_name: orgName,
        p_ausgefuehrt_von: profile.id,
      })
      if (error) {
        const f = rpcFehler(error)
        return apiError(f.meldung, f.status)
      }
    } else {
      const { error: rolleUpdateError } = await supabase
        .from('profiles')
        .update({ role: neueRolle as UserRole })
        .eq('id', zielProfil.id)

      if (rolleUpdateError) return apiError(`Rolle konnte nicht gesetzt werden: ${rolleUpdateError.message}`)

      await supabase.from('rollen_log').insert({
        gemeinde_id: gemeindeId,
        aktion: alteRolle !== 'buerger' ? 'rolle_transfer' : 'rolle_gesetzt',
        ziel_profile_id: zielProfil.id,
        ziel_email: email.toLowerCase(),
        alte_rolle: alteRolle,
        neue_rolle: neueRolle,
        ausgefuehrt_von: profile.id,
      })
    }

    // Offene Einladungen für diesen Nutzer widerrufen
    await supabase
      .from('einladungen')
      .update({ status: 'widerrufen' })
      .eq('email', email.toLowerCase())
      .eq('gemeinde_id', gemeindeId)
      .eq('status', 'offen')

    // E-Mail an Ziel-Nutzer
    if (neueRolle === 'buerger' && alteRolle !== 'buerger') {
      await sendeRollenentzugEmail({ to: email, name: zielProfil.display_name, gemeindeName, alteRolle })
    } else {
      // Bei Verein/Organisation/Gewerbe wird daraus die Willkommensmail (Person ist Verwalter)
      await sendeRollenzuweisungEmail({
        to: email, name: zielProfil.display_name, gemeindeName, gemeindeSlug: gemeinde?.slug ?? null,
        neueRolle, organisationName: orgName, mitgliedRolle: 'verwalter',
      })
    }

    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
