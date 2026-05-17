import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { validate, registrierenSchema } from '@/lib/validations'
import { getGemeindeSlug } from '@/lib/gemeinde'
import type { UserRole } from '@/types/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const v = validate(registrierenSchema, body)
    if (!v.success) return v.error

    const { userId, vorname, nachname, token } = v.data
    const supabase = await createServiceClient()

    const slug = await getGemeindeSlug()
    const { data: gemeinde } = await supabase
      .from('gemeinden')
      .select('id')
      .eq('slug', slug)
      .single()

    let rolle: string = 'buerger'
    let einladungId: string | null = null

    // Token-basierte Registrierung: Rolle und Einladungs-ID ermitteln
    if (token) {
      await supabase.rpc('einladungen_ablauf_aktualisieren')

      const { data: einladung } = await supabase
        .from('einladungen')
        .select('id, rolle, status, verein_id, org_id, organisation_name, gemeinde_id')
        .eq('token', token)
        .single()

      if (einladung && einladung.status === 'offen' && einladung.gemeinde_id === gemeinde?.id) {
        rolle = einladung.rolle
        einladungId = einladung.id

        // Einladung als angenommen markieren
        await supabase
          .from('einladungen')
          .update({ status: 'angenommen', angenommen_am: new Date().toISOString() })
          .eq('id', einladung.id)
      }
    }

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      role: rolle as UserRole,
      gemeinde_id: gemeinde?.id ?? null,
      display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
    })

    if (error) throw error

    // Org-Eintrag bei Einladung mit Vereins-/Org-Daten anlegen
    if (einladungId) {
      const { data: einladung } = await supabase
        .from('einladungen')
        .select('rolle, verein_id, org_id, organisation_name, gemeinde_id')
        .eq('id', einladungId)
        .single()

      if (einladung) {
        if (einladung.rolle === 'verein') {
          if (einladung.verein_id) {
            // Transfer: bestehenden Verein übernehmen
            await supabase
              .from('vereine')
              .update({ profile_id: userId })
              .eq('id', einladung.verein_id)
          } else if (einladung.organisation_name) {
            // Neu anlegen
            await supabase.from('vereine').insert({
              profile_id: userId,
              gemeinde_id: einladung.gemeinde_id,
              verein_name: einladung.organisation_name,
              typ: 'verein',
            })
          }
        } else if (['organisation', 'gewerbe'].includes(einladung.rolle)) {
          if (einladung.org_id) {
            await supabase
              .from('organisationen')
              .update({ profile_id: userId })
              .eq('id', einladung.org_id)
          } else if (einladung.organisation_name) {
            await supabase.from('organisationen').insert({
              profile_id: userId,
              gemeinde_id: einladung.gemeinde_id,
              name: einladung.organisation_name,
              typ: einladung.rolle as 'gewerbe' | 'verein' | 'institution',
            })
          }
        }

        // Audit-Log
        await supabase.from('rollen_log').insert({
          gemeinde_id: einladung.gemeinde_id,
          aktion: 'eingeladen',
          ziel_profile_id: userId,
          ziel_email: '',
          neue_rolle: einladung.rolle,
          einladung_id: einladungId,
          ausgefuehrt_von: userId,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
