import { after } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { getGemeindeSlug } from '@/lib/gemeinde'
import { getFeatures } from '@/lib/features'
import { sendeBuergerWillkommensEmail } from '@/lib/email'
import type { UserRole } from '@/types/database'

export interface RegistrierungsDaten {
  email?: string
  vorname?: string
  nachname?: string
  token?: string
  termsAcceptedAt?: string
  termsVersion?: string
  ageConfirmedAt?: string
}

export async function profilAnlegen(userId: string, daten: RegistrierungsDaten = {}) {
  const { email, vorname, nachname, token, termsAcceptedAt, termsVersion, ageConfirmedAt } = daten
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
      // SICHERHEIT: Token an die eingeladene E-Mail binden. Der Token ist ein reines
      // Bearer-Credential im Einladungslink. Ohne diese Prüfung könnte jeder, der an
      // den Link gelangt (weitergeleitete Mail, geteiltes Postfach), die – ggf.
      // privilegierte – Rolle für ein Konto mit beliebiger E-Mail beanspruchen.
      if (!email || email.toLowerCase() !== String(einladungData.email).toLowerCase()) {
        throw new Error('Diese Einladung ist für eine andere E-Mail-Adresse ausgestellt.')
      }

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
    vorname: vorname ?? null,
    nachname: nachname ?? null,
    display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
    terms_accepted_at: termsAcceptedAt ?? null,
    terms_version: termsVersion ?? null,
    age_confirmed_at: ageConfirmedAt ?? null,
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
        vorname: vorname ?? null,
        nachname: nachname ?? null,
        display_name: [vorname, nachname].filter(Boolean).join(' ') || null,
        terms_accepted_at: termsAcceptedAt ?? null,
        terms_version: termsVersion ?? null,
        age_confirmed_at: ageConfirmedAt ?? null,
      })
      if (retryError) throw retryError
    } else {
      throw error
    }
  }

  // Erst jetzt steht fest, dass das Profil neu ist. Vereins- und Gewerbe-Teams haben
  // ihre eigene Willkommensmail bekommen. Versand nach der Antwort, damit die
  // Registrierung nicht auf den Mailserver wartet.
  if (rolle === 'buerger' && email && gemeindeId) {
    const zielGemeinde = gemeindeId
    after(async () => {
      try {
        const { data: gemeinde } = await serviceClient
          .from('gemeinden')
          .select('name, slug, features')
          .eq('id', zielGemeinde)
          .single()
        if (!gemeinde) return
        const { error: mailFehler } = await sendeBuergerWillkommensEmail({
          to: email,
          vorname: vorname || null,
          hatName: Boolean(vorname || nachname),
          gemeindeName: gemeinde.name,
          gemeindeSlug: gemeinde.slug,
          features: getFeatures(gemeinde),
        })
        if (mailFehler) console.error('[profilAnlegen] Willkommensmail fehlgeschlagen:', { userId, fehler: mailFehler.message })
      } catch (e) {
        console.error('[profilAnlegen] Willkommensmail fehlgeschlagen:', { userId, fehler: e })
      }
    })
  }

  if (einladungId && einladungDetails) {
    if (['verein', 'organisation', 'gewerbe'].includes(einladungDetails.rolle)) {
      // Mitgliedschaft im eingeladenen Verein bzw. neuen Verein aus organisation_name
      // (Migration 065). Rolle 'organisation' landet dabei immer in vereine.
      const { error: einloeseFehler } = await serviceClient.rpc('einladung_einloesen', {
        p_profile_id: userId,
        p_einladung_id: einladungId,
      })
      if (einloeseFehler) {
        // Kein Abbruch: Das Konto besteht schon. Ohne Verein kann die Person ihn im
        // Dashboard selbst anlegen, oder die Verwaltung ordnet sie zu.
        console.error('[profilAnlegen] Einladung nicht eingeloest:', {
          userId, einladungId, fehler: einloeseFehler.message,
        })
        // Eine Vereinsrolle ohne Mitgliedschaft wäre verwaist: bei Einladungen in einen
        // bestehenden Verein (verein_id/org_id) zurück auf buerger. Bei organisation_name
        // behält die Person die Rolle und kann den Verein selbst anlegen.
        if (einladungDetails.verein_id || einladungDetails.org_id) {
          const { error: resetFehler } = await serviceClient
            .from('profiles')
            .update({ role: 'buerger' })
            .eq('id', userId)
          if (resetFehler) {
            console.error('[profilAnlegen] Rolle konnte nicht zurueckgesetzt werden:', {
              userId, einladungId, fehler: resetFehler.message,
            })
          }
        }
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
