/**
 * Mitgliedschaften in Vereinen, Organisationen und Gewerben (Migration 065).
 *
 * Die Regeln selbst (wer darf was, letzter Verwalter, eine Person = ein Verein)
 * prüfen die SQL-Funktionen. Hier liegt nur, was die API-Routen zum Aufrufen und
 * Anzeigen brauchen.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Profile } from '@/types/database'

export type MitgliedRolle = 'verwalter' | 'autor'
export type ZielTyp = 'verein' | 'organisation' | 'gewerbe'
/** Was die handelnde Person mit dem Ziel darf. */
export type ZielRecht = 'verwaltung' | MitgliedRolle

export interface Mitgliedschaft {
  rolle: MitgliedRolle
  verein_id: string | null
  organisation_id: string | null
}

export interface Ziel {
  verein_id: string | null
  organisation_id: string | null
  gemeinde_id: string
  name: string
  typ: ZielTyp
  recht: ZielRecht
}

export interface TeamMitglied {
  profile_id: string
  name: string
  email: string | null
  rolle: MitgliedRolle
  ich: boolean
}

export interface TeamEinladung {
  id: string
  email: string
  mitglied_rolle: MitgliedRolle
  ablauft_am: string
}

export interface TeamDaten {
  ziel: { verein_id: string | null; organisation_id: string | null; name: string; typ: ZielTyp }
  recht: ZielRecht
  mitglieder: TeamMitglied[]
  einladungen: TeamEinladung[]
  umfang: { beitraege: number; abonnenten: number }
}

type Service = SupabaseClient<Database>

const ALLGEMEINER_FEHLER = 'Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.'

/** Übersetzt Fehler der SQL-Funktionen (Codes siehe Migration 065) in HTTP-Antworten. */
export function rpcFehler(error: { code?: string; message: string }): { status: number; meldung: string } {
  // Grant-Fehler von Postgres sind keine eigenen Meldungen der SQL-Funktionen.
  if (/^permission denied/i.test(error.message)) return { status: 500, meldung: ALLGEMEINER_FEHLER }
  switch (error.code) {
    case '42501': return { status: 403, meldung: error.message }
    case 'P0001': return { status: 409, meldung: error.message }
    case 'P0002': return { status: 404, meldung: error.message }
    case '22023': return { status: 400, meldung: error.message }
    default:      return { status: 500, meldung: ALLGEMEINER_FEHLER }
  }
}

export function kurzname(
  p: { vorname?: string | null; nachname?: string | null; display_name?: string | null } | null,
): string | null {
  if (!p) return null
  if (p.vorname && p.nachname) return `${p.vorname} ${p.nachname.charAt(0)}.`
  return p.vorname || p.display_name || null
}

export async function meineMitgliedschaft(service: Service, profileId: string): Promise<Mitgliedschaft | null> {
  const { data, error } = await service
    .from('mitgliedschaften')
    .select('rolle, verein_id, organisation_id')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (error) throw new Error(`Mitgliedschaft konnte nicht geladen werden: ${error.message}`)
  return data as Mitgliedschaft | null
}

/** Verein- bzw. Gewerbe-ID der eigenen Mitgliedschaft, wenn sie zur Art passt. */
export async function meinVereinsziel(
  service: Service,
  profileId: string,
  art: 'verein' | 'gewerbe',
): Promise<{ id: string; rolle: MitgliedRolle } | null> {
  const m = await meineMitgliedschaft(service, profileId)
  const id = art === 'verein' ? m?.verein_id : m?.organisation_id
  return m && id ? { id, rolle: m.rolle } : null
}

type ZielErgebnis = { ok: true; ziel: Ziel } | { ok: false; status: number; fehler: string }

/**
 * Welchen Verein bzw. welches Gewerbe meint die Anfrage?
 *   * Verwaltung/Super-Admin: aus der Angabe im Request, Gemeinde wird geprüft.
 *   * Mitglieder: immer die eigene Mitgliedschaft — eine Angabe im Request wird ignoriert.
 */
export async function bestimmeZiel(
  service: Service,
  profile: Pick<Profile, 'id' | 'role' | 'gemeinde_id'>,
  angabe: { verein_id?: string | null; organisation_id?: string | null },
): Promise<ZielErgebnis> {
  let verein_id: string | null = null
  let organisation_id: string | null = null
  let recht: ZielRecht

  if (profile.role === 'verwaltung' || profile.role === 'super_admin') {
    if (!!angabe.verein_id === !!angabe.organisation_id) {
      return { ok: false, status: 400, fehler: 'Bitte genau einen Verein oder ein Gewerbe angeben.' }
    }
    verein_id = angabe.verein_id ?? null
    organisation_id = angabe.organisation_id ?? null
    recht = 'verwaltung'
  } else {
    const m = await meineMitgliedschaft(service, profile.id)
    if (!m) return { ok: false, status: 404, fehler: 'Sie sind keinem Verein und keinem Gewerbe zugeordnet.' }
    verein_id = m.verein_id
    organisation_id = m.organisation_id
    recht = m.rolle
  }

  let gemeinde_id: string
  let name: string
  let typ: ZielTyp
  if (verein_id) {
    const { data, error } = await service.from('vereine').select('gemeinde_id, verein_name, typ').eq('id', verein_id).maybeSingle()
    if (error) throw new Error(`Ziel konnte nicht geladen werden: ${error.message}`)
    if (!data) return { ok: false, status: 404, fehler: 'Verein nicht gefunden.' }
    gemeinde_id = data.gemeinde_id
    name = data.verein_name
    typ = data.typ === 'organisation' ? 'organisation' : 'verein'
  } else {
    const { data, error } = await service.from('organisationen').select('gemeinde_id, name').eq('id', organisation_id!).maybeSingle()
    if (error) throw new Error(`Ziel konnte nicht geladen werden: ${error.message}`)
    if (!data) return { ok: false, status: 404, fehler: 'Gewerbe nicht gefunden.' }
    gemeinde_id = data.gemeinde_id
    name = data.name
    typ = 'gewerbe'
  }

  if (profile.role === 'verwaltung' && gemeinde_id !== profile.gemeinde_id) {
    return { ok: false, status: 404, fehler: typ === 'gewerbe' ? 'Gewerbe nicht gefunden.' : 'Verein nicht gefunden.' }
  }

  return { ok: true, ziel: { verein_id, organisation_id, gemeinde_id, name, typ, recht } }
}

/** Mitglieder, offene Einladungen und Umfang eines Ziels (für den Bereich „Team“). */
export async function ladeTeam(service: Service, ziel: Ziel, ichId: string): Promise<TeamDaten> {
  const zielId = (ziel.verein_id ?? ziel.organisation_id)!
  const mitgliedSpalte = ziel.verein_id ? 'verein_id' : 'organisation_id'
  const einladungSpalte = ziel.verein_id ? 'verein_id' : 'org_id'

  const [mitglieder, einladungen, beitraege, abonnenten] = await Promise.all([
    service
      .from('mitgliedschaften')
      .select('profile_id, rolle, created_at, profiles!mitgliedschaften_profile_id_fkey(display_name, vorname, nachname, email)')
      .eq(mitgliedSpalte, zielId)
      .order('created_at'),
    service
      .from('einladungen')
      .select('id, email, mitglied_rolle, ablauft_am')
      .eq(einladungSpalte, zielId)
      .eq('status', 'offen')
      .order('erstellt_am'),
    service.from('posts').select('id', { count: 'exact', head: true }).eq('org_id', zielId),
    ziel.verein_id
      ? service.from('verein_abonnements').select('id', { count: 'exact', head: true }).eq('verein_id', zielId)
      : service.from('gewerbe_abonnements').select('id', { count: 'exact', head: true }).eq('gewerbe_id', zielId),
  ])

  if (mitglieder.error) throw new Error(`Mitglieder konnten nicht geladen werden: ${mitglieder.error.message}`)
  if (einladungen.error) throw new Error(`Einladungen konnten nicht geladen werden: ${einladungen.error.message}`)

  if (beitraege.error) throw new Error(`Beiträge konnten nicht gezählt werden: ${beitraege.error.message}`)
  if (abonnenten.error) throw new Error(`Abonnenten konnten nicht gezählt werden: ${abonnenten.error.message}`)

  type Zeile = {
    profile_id: string
    rolle: MitgliedRolle
    profiles: { display_name: string | null; vorname: string | null; nachname: string | null; email: string | null } | null
  }

  return {
    ziel: { verein_id: ziel.verein_id, organisation_id: ziel.organisation_id, name: ziel.name, typ: ziel.typ },
    recht: ziel.recht,
    mitglieder: ((mitglieder.data ?? []) as unknown as Zeile[]).map(z => ({
      profile_id: z.profile_id,
      name: [z.profiles?.vorname, z.profiles?.nachname].filter(Boolean).join(' ')
        || z.profiles?.display_name
        || z.profiles?.email
        || 'Unbekannt',
      email: z.profiles?.email ?? null,
      rolle: z.rolle,
      ich: z.profile_id === ichId,
    })),
    einladungen: (einladungen.data ?? []).map(e => ({
      id: e.id,
      email: e.email,
      mitglied_rolle: (e.mitglied_rolle ?? 'autor') as MitgliedRolle,
      ablauft_am: e.ablauft_am,
    })),
    umfang: { beitraege: beitraege.count ?? 0, abonnenten: abonnenten.count ?? 0 },
  }
}

export interface VereinsEintrag {
  id: string
  name: string
  typ: ZielTyp
  mitglieder: number
  verwalter: number
}

/** Liste für die Verwaltung: Vereine/Organisationen und Gewerbe mit Mitgliederzahlen. */
export function vereinsEintraege(
  vereine: { id: string; verein_name: string; typ: string }[],
  gewerbe: { id: string; name: string }[],
  mitgliedschaften: { verein_id: string | null; organisation_id: string | null; rolle: string }[],
): VereinsEintrag[] {
  const zaehle = (id: string, spalte: 'verein_id' | 'organisation_id') => {
    const eigene = mitgliedschaften.filter(m => m[spalte] === id)
    return { mitglieder: eigene.length, verwalter: eigene.filter(m => m.rolle === 'verwalter').length }
  }
  return [
    ...vereine.map(v => ({
      id: v.id,
      name: v.verein_name,
      typ: (v.typ === 'organisation' ? 'organisation' : 'verein') as ZielTyp,
      ...zaehle(v.id, 'verein_id'),
    })),
    ...gewerbe.map(g => ({ id: g.id, name: g.name, typ: 'gewerbe' as ZielTyp, ...zaehle(g.id, 'organisation_id') })),
  ]
}
