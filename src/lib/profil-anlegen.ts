import { createServiceClient, createClient } from '@/lib/supabase/server'
import { getGemeindeSlug } from '@/lib/gemeinde'
import type { UserRole } from '@/types/supabase'

export interface RegistrierungsDaten {
  email?: string
  vorname?: string
  nachname?: string
  token?: string
}

export async function profilAnlegen(userId: string, daten: RegistrierungsDaten = {}) {
  const { email, vorname, nachname, token } = daten
  const supabase = await createServiceClient()

  const { data: bestehendesProfil } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (bestehendesProfil) return

  const slug = await getGemeindeSlug()
  const publicClient = await createClient()
  const { data: gemeinde } = await publicClient
    .from('gemeinden')
    .select('id')
    .eq('slug', slug)
    .single()

  let rolle: string = 'buerger'
  let einladungId: string | null = null

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

      await supabase
        .from('einladungen')
        .update({ status: 'angenommen', angenommen_am: new Date().toISOString() })
        .eq('id', einladung.id)
    }
  }

  const { error } = await supabase.from('profiles').insert({
    id: userId,
    email: email ?? null,
    role: rolle as UserRole,
    gemeinde_id: gemeinde?.id ?? null,
    display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
  })

  if (error) throw error

  if (einladungId) {
    const { data: einladung } = await supabase
      .from('einladungen')
      .select('rolle, verein_id, org_id, organisation_name, gemeinde_id')
      .eq('id', einladungId)
      .single()

    if (einladung) {
      if (einladung.rolle === 'verein') {
        if (einladung.verein_id) {
          await supabase
            .from('vereine')
            .update({ profile_id: userId })
            .eq('id', einladung.verein_id)
        } else if (einladung.organisation_name) {
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
}
