/**
 * Mitglied per E-Mail hinzufügen.
 *
 * Hat die Adresse schon ein Konto in der Gemeinde, wird die Person sofort Mitglied
 * (die Datenbank prüft Rolle, Gemeinde und Rechte). Sonst geht eine Einladung raus;
 * beim Registrieren löst profilAnlegen sie über einladung_einloesen ein.
 */

import { rpcFehler, type MitgliedRolle, type Ziel } from './mitgliedschaft'

export interface HinzufuegenDeps {
  profilPerEmail(email: string): Promise<{ id: string; gemeinde_id: string | null; display_name: string | null } | null>
  mitgliedHinzufuegen(args: {
    p_profile_id: string
    p_rolle: MitgliedRolle
    p_ausgefuehrt_von: string
    p_verein_id?: string
    p_organisation_id?: string
  }): Promise<{ error: { code?: string; message: string } | null }>
  /** Widerruft offene Einladungen derselben Adresse und legt die neue an. */
  einladungAnlegen(daten: {
    email: string
    rolle: string
    mitglied_rolle: MitgliedRolle
    verein_id: string | null
    org_id: string | null
    organisation_name: string
    gemeinde_id: string
    eingeladen_von: string
  }): Promise<{ token: string } | { fehler: string }>
  sendeZuweisung(p: {
    to: string; name: string | null; gemeindeName: string; neueRolle: string; organisationName: string; absender: string | null
  }): Promise<unknown>
  sendeEinladung(p: {
    to: string; gemeindeName: string; gemeindeSlug: string; rolle: string; organisationName: string; token: string; absender: string | null
  }): Promise<unknown>
}

export interface HinzufuegenEingabe {
  email: string
  rolle: MitgliedRolle
  ziel: Ziel
  akteurId: string
  gemeinde: { name: string; slug: string }
}

export type HinzufuegenErgebnis =
  | { ok: true; art: 'hinzugefuegt' | 'eingeladen' }
  | { ok: false; status: number; fehler: string }

/** Absender für Mails; null = Standardtext „die Gemeindeverwaltung …“. */
export function absenderFuer(ziel: Ziel): string | null {
  if (ziel.recht === 'verwaltung') return null
  const art = ziel.typ === 'gewerbe' ? 'der Betrieb' : ziel.typ === 'organisation' ? 'die Organisation' : 'der Verein'
  return `${art} „${ziel.name}“`
}

async function mailOhneAbbruch(versand: () => Promise<unknown>, kontext: string) {
  try {
    await versand()
  } catch (e) {
    console.error(`[mitglieder] Mail fehlgeschlagen (${kontext}):`, e)
  }
}

export async function mitgliedPerEmailHinzufuegen(
  eingabe: HinzufuegenEingabe,
  deps: HinzufuegenDeps,
): Promise<HinzufuegenErgebnis> {
  const { ziel, rolle, akteurId, gemeinde } = eingabe
  const email = eingabe.email.trim().toLowerCase()
  const absender = absenderFuer(ziel)

  const profil = await deps.profilPerEmail(email)

  if (profil) {
    if (profil.gemeinde_id !== ziel.gemeinde_id) {
      return { ok: false, status: 409, fehler: 'Diese E-Mail-Adresse gehört zu einem Konto einer anderen Gemeinde.' }
    }
    const { error } = await deps.mitgliedHinzufuegen({
      p_profile_id: profil.id,
      p_rolle: rolle,
      p_ausgefuehrt_von: akteurId,
      p_verein_id: ziel.verein_id ?? undefined,
      p_organisation_id: ziel.organisation_id ?? undefined,
    })
    if (error) {
      const f = rpcFehler(error)
      return { ok: false, status: f.status, fehler: f.meldung }
    }
    await mailOhneAbbruch(() => deps.sendeZuweisung({
      to: email, name: profil.display_name, gemeindeName: gemeinde.name,
      neueRolle: ziel.typ, organisationName: ziel.name, absender,
    }), 'Zuweisung')
    return { ok: true, art: 'hinzugefuegt' }
  }

  const einladung = await deps.einladungAnlegen({
    email,
    rolle: ziel.typ,
    mitglied_rolle: rolle,
    verein_id: ziel.verein_id,
    org_id: ziel.organisation_id,
    organisation_name: ziel.name,
    gemeinde_id: ziel.gemeinde_id,
    eingeladen_von: akteurId,
  })
  if ('fehler' in einladung) {
    console.error('[mitglieder] Einladung konnte nicht angelegt werden:', einladung.fehler)
    return { ok: false, status: 500, fehler: 'Die Einladung konnte nicht angelegt werden. Bitte versuchen Sie es erneut.' }
  }

  await mailOhneAbbruch(() => deps.sendeEinladung({
    to: email, gemeindeName: gemeinde.name, gemeindeSlug: gemeinde.slug,
    rolle: ziel.typ, organisationName: ziel.name, token: einladung.token, absender,
  }), 'Einladung')

  return { ok: true, art: 'eingeladen' }
}
