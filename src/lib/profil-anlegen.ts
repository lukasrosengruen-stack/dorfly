import { createServiceClient, createClient } from '@/lib/supabase/server'
import { getGemeindeSlug } from '@/lib/gemeinde'
import type { UserRole } from '@/types/database'

export interface RegistrierungsDaten {
  email?: string
  vorname?: string
  nachname?: string
  token?: string
}

export async function profilAnlegen(userId: string, daten: RegistrierungsDaten = {}) {
  const { email, vorname, nachname, token } = daten
  const serviceClient = await createServiceClient()
  const publicClient  = await createClient()

  const { data: bestehendesProfil } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (bestehendesProfil) return

  let gemeindeId: string | null = null
  let rolle: string = 'buerger'
  let einladungId: string | null = null
  let einladungDetails: {
    rolle: string
    verein_id: string | null
    org_id: string | null
    organisation_name: string | null
    gemeinde_id: string
  } | null = null

  if (token) {
    // SECURITY DEFINER-Funktion: kein service_role nötig, funktioniert für anon/authenticated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: einladungData } = await (publicClient as any).rpc('get_einladung_by_token', { p_token: token })

    if (einladungData && einladungData.status === 'offen') {
      // Gemeinde-ID direkt aus der Einladung – zuverlässiger als Slug-Lookup
      gemeindeId = einladungData.gemeinde_id
      rolle      = einladungData.rolle

      // Einladung als angenommen markieren (braucht service_role für Schreibzugriff)
      const { data: einladungRow } = await serviceClient
        .from('einladungen')
        .select('id, rolle, verein_id, org_id, organisation_name, gemeinde_id')
        .eq('token', token)
        .single()

      if (einladungRow) {
        einladungId     = einladungRow.id
        einladungDetails = einladungRow

        await serviceClient
          .from('einladungen')
          .update({ status: 'angenommen', angenommen_am: new Date().toISOString() })
          .eq('id', einladungRow.id)
      }
    }
  }

  // Kein Token oder Einladung ungültig: Gemeinde per Subdomain-Slug ermitteln
  if (!gemeindeId) {
    const slug = await getGemeindeSlug()
    if (slug === null) {
      throw new Error('profilAnlegen: Kein Gemeinde-Slug vorhanden. Registrierung ohne Subdomain-Kontext nicht möglich.')
    }
    const { data: gemeinde } = await publicClient
      .from('gemeinden')
      .select('id')
      .eq('slug', slug)
      .single()
    gemeindeId = gemeinde?.id ?? null
  }

  const { error } = await serviceClient.from('profiles').insert({
    id: userId,
    email: email ?? null,
    role: rolle as UserRole,
    gemeinde_id: gemeindeId,
    display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
  })

  if (error) {
    // Unique-Verletzung auf email: verwaistes Profil einer gelöschten auth.users-Zeile.
    // Profil ohne E-Mail anlegen — kann später manuell ergänzt werden.
    if (error.code === '23505' && email) {
      const { error: retryError } = await serviceClient.from('profiles').insert({
        id: userId,
        email: null,
        role: rolle as UserRole,
        gemeinde_id: gemeindeId,
        display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
      })
      if (retryError) throw retryError
    } else {
      throw error
    }
  }

  if (einladungId && einladungDetails) {
    if (einladungDetails.rolle === 'verein') {
      if (einladungDetails.verein_id) {
        await serviceClient
          .from('vereine')
          .update({ profile_id: userId })
          .eq('id', einladungDetails.verein_id)
      } else if (einladungDetails.organisation_name) {
        await serviceClient.from('vereine').insert({
          profile_id: userId,
          gemeinde_id: einladungDetails.gemeinde_id,
          verein_name: einladungDetails.organisation_name,
          typ: 'verein',
        })
      }
    } else if (['organisation', 'gewerbe'].includes(einladungDetails.rolle ?? '')) {
      if (einladungDetails.org_id) {
        await serviceClient
          .from('organisationen')
          .update({ profile_id: userId })
          .eq('id', einladungDetails.org_id)
      } else if (einladungDetails.organisation_name) {
        await serviceClient.from('organisationen').insert({
          profile_id: userId,
          gemeinde_id: einladungDetails.gemeinde_id,
          name: einladungDetails.organisation_name,
          typ: einladungDetails.rolle as 'gewerbe' | 'verein' | 'institution',
        })
      }
    }

    await serviceClient.from('rollen_log').insert({
      gemeinde_id: einladungDetails.gemeinde_id,
      aktion: 'eingeladen',
      ziel_profile_id: userId,
      ziel_email: '',
      neue_rolle: einladungDetails.rolle,
      einladung_id: einladungId,
      ausgefuehrt_von: userId,
    })
  }
}
