import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isFeatureAktiv } from '@/lib/features'
import { Users, Home, TrendingUp, AlertTriangle, Clock, MessageCircleQuestion } from 'lucide-react'
import { FrageErgebnis } from '@/types/umfrage'
import AbfallkalenderSection from '@/components/dashboard/AbfallkalenderSection'
import WarnmeldungenSection from '@/components/dashboard/WarnmeldungenSection'
import EinladungenSection from '@/components/dashboard/EinladungenSection'
import GemeindeEinstellungen from '@/components/dashboard/GemeindeEinstellungen'
import PostFreigabe from '@/components/dashboard/PostFreigabe'
import PostVerwaltungSection from '@/components/dashboard/PostVerwaltungSection'
import BuergerfrageSection from '@/components/dashboard/BuergerfrageSection'
import MaengelSection from '@/components/dashboard/MaengelSection'
import UmfragenSection from '@/components/dashboard/UmfragenSection'
import { mergeArbeitsset } from '@/lib/dashboardArbeitsset'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type SupabaseServiceClient = Awaited<ReturnType<typeof createServiceClient>>

/**
 * Buendelt alle Maengel-Abfragen fuers Dashboard in einem eigenen Promise.all
 * und gibt ein benanntes Objekt zurueck statt eines Tupels.
 *
 * Grund: Drei der sechs Abfragen haben denselben Rueckgabetyp
 * `{ count: number | null }`. Bei positionaler Destrukturierung im
 * aeusseren Promise.all kompiliert ein Vertauscher zweier benachbarter
 * Eintraege anstandslos und liefert falsche KPI-Zahlen, die weder tsc
 * noch Tests noch die Oberflaeche aufdecken. Der Zugriff ueber
 * Eigenschaftsnamen macht das strukturell unmoeglich. Die innere
 * Promise.all feuert sofort, die Parallelitaet zum aeusseren Block bleibt
 * also erhalten.
 *
 * Alternative geprueft: `superadmin_maengel_stats(p_gemeinde_id)` aus
 * supabase/migrations/010_superadmin_dashboard_functions.sql liefert
 * dieselben vier Zahlen in einer Abfrage per COUNT(*) FILTER. Bewusst
 * nicht verwendet: die Funktion ist SECURITY DEFINER und ihr EXECUTE ist
 * per REVOKE ... FROM PUBLIC / GRANT ... TO service_role (Zeilen 171 und
 * 177 der Migration) ausschliesslich fuer service_role freigegeben, nicht
 * fuer authenticated. Sie ist fuer das Super-Admin-Dashboard gedacht, das
 * gemeindeuebergreifend abfragt (p_gemeinde_id ist optional). Sie hier
 * einzusetzen wuerde bedeuten, die vier Zaehlungen ueber den
 * Service-Role-Client statt den RLS-gebundenen Nutzer-Client laufen zu
 * lassen — RLS als zweite Absicherung der Gemeinde-Grenze ginge verloren,
 * und man vertraut allein der Anwendung, `p_gemeinde_id` korrekt zu
 * fuellen. Vier billige head:true-Counts sind hier der sicherere Weg.
 */
async function ladeMaengelDaten(supabase: SupabaseServerClient, gemeindeId: string) {
  const [arbeitsset, offene, gesamt, offen, inBearbeitung, erledigt] = await Promise.all([
    // Arbeitsset: die zehn neuesten Meldungen.
    supabase.from('maengel').select('id, titel, status, created_at, beschreibung, adresse, foto_url, lat, lng, nachricht_an_buerger, profiles(display_name)').eq('gemeinde_id', gemeindeId).order('created_at', { ascending: false }).limit(10),
    // Unabhaengig vom Alter: alles, was noch offen ist. Gedeckelt auf 50 —
    // offeneVerborgen unten macht sichtbar, wenn diese Deckelung greift.
    supabase.from('maengel').select('id, titel, status, created_at, beschreibung, adresse, foto_url, lat, lng, nachricht_an_buerger, profiles(display_name)').eq('gemeinde_id', gemeindeId).neq('status', 'erledigt').order('created_at', { ascending: false }).limit(50),
    supabase.from('maengel').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId),
    supabase.from('maengel').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId).eq('status', 'offen'),
    supabase.from('maengel').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId).eq('status', 'in_bearbeitung'),
    supabase.from('maengel').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId).eq('status', 'erledigt'),
  ])

  const offenAnzahl = offen.count ?? 0
  const inBearbeitungAnzahl = inBearbeitung.count ?? 0
  const nichtErledigtGesamt = offenAnzahl + inBearbeitungAnzahl
  const nichtErledigtGeladen = offene.data?.length ?? 0

  return {
    maengel: mergeArbeitsset([arbeitsset.data ?? [], offene.data ?? []], m => m.created_at),
    gesamt: gesamt.count ?? 0,
    offen: offenAnzahl,
    inBearbeitung: inBearbeitungAnzahl,
    erledigt: erledigt.count ?? 0,
    // >0, wenn die 50er-Deckelung oben tatsaechlich nicht erledigte Faelle
    // verschluckt hat (z.B. nach einem Unwetter mit vielen offenen Meldungen).
    offeneVerborgen: Math.max(0, nichtErledigtGesamt - nichtErledigtGeladen),
  }
}

/**
 * Buendelt alle Fragen-Abfragen fuers Dashboard analog zu ladeMaengelDaten
 * (siehe Kommentar dort) in einem eigenen inneren Promise.all mit benanntem
 * Rueckgabeobjekt statt positionaler Destrukturierung im aeusseren Block.
 */
async function ladeFragenDaten(supabase: SupabaseServerClient, gemeindeId: string) {
  const [arbeitsset, offene, gesamt, offen] = await Promise.all([
    // Arbeitsset: die zehn neuesten Fragen.
    supabase.from('fragen').select('id, frage, antwort, status, created_at, profiles(display_name)').eq('gemeinde_id', gemeindeId).order('created_at', { ascending: false }).limit(10),
    // Unabhaengig vom Alter: alles, was noch offen ist. Gedeckelt auf 50 —
    // offeneVerborgen unten macht sichtbar, wenn diese Deckelung greift.
    supabase.from('fragen').select('id, frage, antwort, status, created_at, profiles(display_name)').eq('gemeinde_id', gemeindeId).eq('status', 'offen').order('created_at', { ascending: false }).limit(50),
    supabase.from('fragen').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId),
    supabase.from('fragen').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId).eq('status', 'offen'),
  ])

  return {
    fragen: mergeArbeitsset([arbeitsset.data ?? [], offene.data ?? []], f => f.created_at),
    gesamt: gesamt.count ?? 0,
    offen: offen.count ?? 0,
    // >0, wenn die 50er-Deckelung oben tatsaechlich offene Fragen verschluckt
    // hat (z.B. bei einer Frage-Welle nach einer Gemeinderatssitzung).
    offeneVerborgen: Math.max(0, (offen.count ?? 0) - (offene.data?.length ?? 0)),
  }
}

/**
 * Buendelt alle Beitrags-Abfragen fuers Dashboard analog zu ladeMaengelDaten
 * und ladeFragenDaten (siehe Kommentar dort) in einem eigenen inneren
 * Promise.all mit benanntem Rueckgabeobjekt.
 *
 * Anders als dort laeuft hier alles ueber den Service-Client: die
 * Beitragsabfragen im Dashboard nutzen bereits an anderer Stelle `service`
 * statt `supabase` (siehe pendingPostsResult unten), das wird hier
 * fortgesetzt.
 */
async function ladePostsDaten(service: SupabaseServiceClient, gemeindeId: string) {
  const heute = new Date().toISOString().split('T')[0]
  const postSpalten = 'id, titel, inhalt, tag, channel, pinned, bild_url, veranstaltung_datum, veranstaltung_ort, post_termine(datum), published_at, publish_at, profiles(role)'

  const [arbeitsset, veranstaltungen, zusatztermine, gesamt] = await Promise.all([
    // Arbeitsset: die 20 neuesten veroeffentlichten Beitraege. Geplante
    // Beitraege brauchen keine Sonderbehandlung: published_at wird beim
    // Freigeben auf publish_at gesetzt, sie sortieren sich also von selbst
    // nach oben ein.
    service.from('posts').select(postSpalten).eq('gemeinde_id', gemeindeId).eq('status', 'published').order('published_at', { ascending: false }).limit(20),
    // Kommende Veranstaltungen (Haupttermin) bleiben unabhaengig vom Alter
    // sichtbar, sonst faellt eine weit im Voraus angekuendigte Veranstaltung
    // aus der Liste, sobald 20 neuere Beitraege dazukommen.
    service.from('posts').select(postSpalten).eq('gemeinde_id', gemeindeId).eq('status', 'published').eq('tag', 'veranstaltung').gte('veranstaltung_datum', heute).order('veranstaltung_datum', { ascending: true }).limit(50),
    // Mehrtaegige Veranstaltungen: veranstaltung_datum ist nur der erste
    // Termin. Ist der bereits vergangen, ein Zusatztermin aus post_termine
    // aber noch nicht, gilt der Beitrag trotzdem als kommend. Hier bewusst
    // nur post_id und datum holen (post_id ist eine native Spalte auf
    // post_termine, kein Embed noetig) — die vollen Beitragsdaten holt
    // Abfrage 4 unten gezielt fuer genau diese ids nach (siehe Begruendung
    // dort). Filter auf die eingebettete posts-Tabelle nach Vorbild aus
    // src/app/(app)/veranstaltungen/page.tsx (Zeile 33-41), inklusive
    // posts.tag: post_termine wird zwar aktuell nur fuer Veranstaltungen
    // angelegt, aber nur clientseitig (PostErstellenButton) abgesichert —
    // der Filter hier ist die serverseitige Absicherung dagegen.
    service.from('post_termine').select('post_id, datum, posts!inner(gemeinde_id, status, tag)').eq('posts.gemeinde_id', gemeindeId).eq('posts.status', 'published').eq('posts.tag', 'veranstaltung').gte('datum', heute).limit(50),
    // Gesamtzahl aller veroeffentlichten Beitraege fuer die "N von M"-Anzeige.
    service.from('posts').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId).eq('status', 'published'),
  ])

  // Fruehester bekannter kuenftiger Termin je Beitrag — Grundlage fuer die
  // Sortierung der Veranstaltungsgruppe weiter unten. Nur echte
  // Zukunftstermine fliessen ein: veranstaltung_datum aus der zweiten
  // Abfrage ist durch deren gte-Filter bereits >= heute, ebenso datum aus
  // der dritten.
  const naechsterTermin = new Map<string, string>()
  for (const row of veranstaltungen.data ?? []) {
    if (row.veranstaltung_datum) naechsterTermin.set(row.id, row.veranstaltung_datum)
  }
  for (const row of zusatztermine.data ?? []) {
    const bisher = naechsterTermin.get(row.post_id)
    if (!bisher || row.datum.localeCompare(bisher) < 0) naechsterTermin.set(row.post_id, row.datum)
  }

  // Volle Beitragsdaten fuer Beitraege, die NUR ueber einen Zusatztermin
  // gefunden wurden (Haupttermin vergangen, nicht unter den 20 neuesten).
  // Bewusst eine zweite Abfrage statt eines Stub-Objekts mit leerem
  // post_termine: ein leeres Array ist nicht dasselbe wie "keine Aenderung".
  // Oeffnet die Sachbearbeiterin so einen Beitrag zum Bearbeiten, fuellt
  // PostVerwaltungSection.openEdit() weitereTermine daraus, und beim
  // Speichern prueft src/app/api/posts/update/route.ts (Zeile 44)
  // `weitereTermine !== undefined` — ein leeres Array erfuellt das, Zeile 45
  // loescht daraufhin unbedingt alle bestehenden post_termine-Zeilen, Zeile
  // 46 legt mangels length>0 keine neuen an. Der echte, noch bevorstehende
  // Zusatztermin waere damit unwiderruflich weg. Deshalb: volle Daten
  // laden. Haengt von den post_ids aus der post_termine-Abfrage oben ab,
  // laeuft deshalb bewusst NACH dem Promise.all und nur, wenn es
  // ueberhaupt solche ids gibt (kein Leerlauf-Roundtrip im Regelfall).
  const zusatzPostIds = Array.from(new Set((zusatztermine.data ?? []).map(z => z.post_id)))
  const zusatzPosts = zusatzPostIds.length > 0
    ? (await service.from('posts').select(postSpalten).in('id', zusatzPostIds).eq('gemeinde_id', gemeindeId).eq('status', 'published')).data ?? []
    : []

  // Kommende Veranstaltungen zusammenfuehren (Haupttermin-Treffer + die
  // per Zusatztermin nachgeladenen Beitraege), ueber die id entdoppelt.
  // mergeArbeitsset uebernimmt hier nur das Entdoppeln — ihre eingebaute
  // Sortierung (juengstes Datum zuerst, siehe Kommentar dort) passt nicht:
  // die Veranstaltungsgruppe soll nach dem naechsten Termin AUFsteigend
  // sortiert sein, nicht nach veranstaltung_datum absteigend. Deshalb im
  // Anschluss mit dem oben gebauten naechsterTermin-Datum neu sortiert.
  const veranstaltungenGruppe = mergeArbeitsset(
    [veranstaltungen.data ?? [], zusatzPosts],
    p => p.veranstaltung_datum,
  ).sort((a, b) => (naechsterTermin.get(a.id) ?? '').localeCompare(naechsterTermin.get(b.id) ?? ''))

  // Uebrige Beitraege: das Arbeitsset abzueglich allem, was schon in der
  // Veranstaltungsgruppe steht — ein Beitrag erscheint so nur einmal, und
  // zwar in der Veranstaltungsgruppe, wenn er in beiden vorkommt. Die
  // Reihenfolge (neueste zuerst) bringt die Abfrage selbst schon mit.
  const veranstaltungIds = new Set(veranstaltungenGruppe.map(p => p.id))
  const uebrigeBeitraege = (arbeitsset.data ?? []).filter(p => !veranstaltungIds.has(p.id))

  return {
    // Veranstaltungsgruppe zuerst: eine vor Monaten veroeffentlichte, aber
    // erst morgen stattfindende Veranstaltung wuerde sonst unter den 20
    // aktuellen Beitraegen untergehen — sie ist zwar in der Liste, aber
    // praktisch nicht auffindbar. Das widerspraeche dem Zweck, sie bewusst
    // zu behalten.
    posts: [...veranstaltungenGruppe, ...uebrigeBeitraege],
    gesamt: gesamt.count ?? 0,
  }
}

/**
 * Buendelt alle Warnmeldungs-Abfragen fuers Dashboard analog zu
 * ladeMaengelDaten, ladeFragenDaten und ladePostsDaten (siehe Kommentare
 * dort) in einem eigenen inneren Promise.all mit benanntem
 * Rueckgabeobjekt. Laeuft ueber den Service-Client, da Warnmeldungen
 * bereits an anderer Stelle im Dashboard ueber `service` geladen werden.
 */
async function ladeWarnmeldungenDaten(service: SupabaseServiceClient, gemeindeId: string) {
  const warnSpalten = 'id, titel, severity, is_active, dwd_id, created_at'

  const [arbeitsset, aktive, gesamt, aktivCount] = await Promise.all([
    // Arbeitsset: die zehn neuesten Warnmeldungen.
    service.from('posts').select(warnSpalten).eq('gemeinde_id', gemeindeId).eq('channel', 'warnung').order('created_at', { ascending: false }).limit(10),
    // Unabhaengig vom Alter: alles, was noch aktiv ist. Eine aktive Warnung
    // von vor Monaten bleibt weiterhin relevant und darf nicht aus der
    // Liste fallen.
    service.from('posts').select(warnSpalten).eq('gemeinde_id', gemeindeId).eq('channel', 'warnung').eq('is_active', true).order('created_at', { ascending: false }).limit(50),
    service.from('posts').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId).eq('channel', 'warnung'),
    // Echte Gesamtzahl aktiver Warnungen, unabhaengig von der 50er-Deckelung
    // oben. Bei Warnmeldungen wiegt eine stillschweigend verschluckte aktive
    // Warnung schwerer als anderswo — es geht um Gefahreninformation, siehe
    // aktiveVerborgen unten.
    service.from('posts').select('id', { count: 'exact', head: true }).eq('gemeinde_id', gemeindeId).eq('channel', 'warnung').eq('is_active', true),
  ])

  return {
    warnmeldungen: mergeArbeitsset([arbeitsset.data ?? [], aktive.data ?? []], w => w.created_at),
    gesamt: gesamt.count ?? 0,
    // >0, wenn die 50er-Deckelung oben tatsaechlich aktive Warnungen
    // verschluckt hat. Anders als bei Maengeln/Fragen faellt eine
    // verschluckte Warnung sonst lautlos aus Liste UND "X aktiv"-Badge —
    // die Verwaltung saehe eine aktive Gefahreninformation schlicht nicht.
    aktiveVerborgen: Math.max(0, (aktivCount.count ?? 0) - (aktive.data?.length ?? 0)),
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, gemeinden(*), verein_name, gemeinde_id')
    .eq('id', user?.id ?? '')
    .single()

  if (profile?.role === 'gewerbe') redirect('/gewerbe/dashboard')
  if (!profile || !['verwaltung', 'super_admin', 'verein', 'organisation', 'gemeinderat'].includes(profile.role)) {
    redirect('/feed')
  }

  // Gemeinderat: eigene Posts + eingehende Fragen
  if (profile.role === 'gemeinderat') {
    const [gemeinderatPostsResult, gemeinderatFragenResult] = await Promise.all([
      supabase
        .from('posts')
        .select('id, titel, inhalt, tag, status, published_at, rejection_reason')
        .eq('author_id', user!.id)
        .eq('channel', 'gemeinderat')
        .order('published_at', { ascending: false }),
      supabase
        .from('gemeinderat_fragen')
        .select('id, frage, antwort, status, created_at, fragesteller:profiles!fragesteller_id(display_name)')
        .eq('gemeinderat_id', user!.id)
        .order('created_at', { ascending: false }),
    ])

    const GemeinderatDashboard = (await import('@/components/dashboard/GemeinderatDashboard')).default
    return (
      <GemeinderatDashboard
        posts={(gemeinderatPostsResult.data ?? []) as Parameters<typeof GemeinderatDashboard>[0]['posts']}
        fragen={(gemeinderatFragenResult.data ?? []) as unknown as Parameters<typeof GemeinderatDashboard>[0]['fragen']}
        gemeindeId={profile.gemeinde_id!}
        profileId={user!.id}
        fraktion={profile.fraktion ?? null}
        ueber_mich={profile.ueber_mich ?? null}
        kontakt_email={profile.kontakt_email ?? null}
        avatar_url={profile.avatar_url ?? null}
        social_x={profile.social_x ?? null}
        social_facebook={profile.social_facebook ?? null}
        social_instagram={profile.social_instagram ?? null}
        social_tiktok={profile.social_tiktok ?? null}
      />
    )
  }

  // Verein / Organisation sieht eigene Beiträge + Profil
  if (profile.role === 'verein' || profile.role === 'organisation') {
    const [vereinPostsResult, vereinProfilResult, kategorienResult] = await Promise.all([
      supabase
        .from('posts')
        .select('id, titel, inhalt, status, created_at, tag, bild_url, publish_at, rejection_reason, veranstaltung_datum, veranstaltung_ort, post_termine(datum)')
        .eq('author_id', user!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('vereine')
        .select('*')
        .eq('profile_id', user!.id)
        .maybeSingle(),
      supabase
        .from('verein_kategorien')
        .select('id, name, reihenfolge')
        .order('reihenfolge'),
    ])

    const vereinProfil = vereinProfilResult.data ?? null

    // Abonnenten-Stats nur wenn Profil vorhanden
    let abonnentenStats = null
    if (vereinProfil) {
      const vereinService = await createServiceClient()
      const jetzt = new Date()
      const vor7  = new Date(jetzt); vor7.setDate(jetzt.getDate() - 7)
      const vor30 = new Date(jetzt); vor30.setDate(jetzt.getDate() - 30)

      const [gesamtRes, neu7Res, neu30Res] = await Promise.all([
        vereinService.from('verein_abonnements').select('id', { count: 'exact', head: true }).eq('verein_id', vereinProfil.id),
        vereinService.from('verein_abonnements').select('id', { count: 'exact', head: true }).eq('verein_id', vereinProfil.id).gte('created_at', vor7.toISOString()),
        vereinService.from('verein_abonnements').select('id', { count: 'exact', head: true }).eq('verein_id', vereinProfil.id).gte('created_at', vor30.toISOString()),
      ])
      abonnentenStats = {
        gesamt:        gesamtRes.count ?? 0,
        letzter7Tage:  neu7Res.count ?? 0,
        letzter30Tage: neu30Res.count ?? 0,
      }
    }

    const VereinPostVerwaltung = (await import('@/components/dashboard/VereinPostVerwaltung')).default
    return (
      <VereinPostVerwaltung
        posts={(vereinPostsResult.data ?? []) as Parameters<typeof VereinPostVerwaltung>[0]['posts']}
        gemeindeId={profile.gemeinde_id!}
        profileId={user!.id}
        vereinName={profile.verein_name}
        role={profile.role as 'verein' | 'organisation'}
        vereinProfil={vereinProfil}
        kategorien={kategorienResult.data ?? []}
        abonnentenStats={abonnentenStats}
      />
    )
  }

  const gemeindeId = profile.gemeinde_id
  const gemeinde = profile.gemeinden as {
    id: string; name: string; bundesland: string;
    einwohner: number | null; haushalte: number | null; plz: string | null;
    features: Record<string, unknown> | null
    ratsinformation_url: string | null; notfallnummern_url: string | null;
    homepage_url: string | null; mitteilungsblatt_url: string | null;
    warncell_id: string | null;
    primary_color: string | null; accent_color: string | null; logo_url: string | null;
  } | null

  const service = await createServiceClient()

  const wasteFeatureAktiv = isFeatureAktiv(gemeinde, 'abfallkalender')

  const warnmeldungenDaten = profile.role === 'verwaltung'
    ? await ladeWarnmeldungenDaten(service, gemeindeId!)
    : null
  const warnmeldungen = warnmeldungenDaten?.warnmeldungen ?? []
  const warnmeldungenGesamt = warnmeldungenDaten?.gesamt ?? 0
  const warnmeldungenAktiveVerborgen = warnmeldungenDaten?.aktiveVerborgen ?? 0

  const [maengelDaten, fragenDaten, postsDaten, pendingPostsResult, umfragenResult, nutzerResult, abfallEinstellungenResult] = await Promise.all([
    ladeMaengelDaten(supabase, gemeindeId!),
    ladeFragenDaten(supabase, gemeindeId!),
    ladePostsDaten(service, gemeindeId!),
    service.from('posts').select('id, titel, inhalt, channel, tag, created_at, publish_at, bild_url, bilder_urls, profiles(display_name, verein_name, role)').eq('gemeinde_id', gemeindeId!).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('umfragen').select('*, umfrage_fragen(*, umfrage_optionen(*))').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }),
    service.from('profiles').select('id, role', { count: 'exact' }).eq('gemeinde_id', gemeindeId!),
    supabase.from('abfallkalender_einstellungen').select('*').eq('gemeinde_id', gemeindeId!).maybeSingle(),
  ])

  const abfallEinstellungen = abfallEinstellungenResult.data ?? null
  const maengel = maengelDaten.maengel
  const maengelGesamt = maengelDaten.gesamt
  const offeneMaengel = maengelDaten.offen
  const inBearbeitung = maengelDaten.inBearbeitung
  const erledigteMaengel = maengelDaten.erledigt
  const maengelOffeneVerborgen = maengelDaten.offeneVerborgen
  const fragen = fragenDaten.fragen
  const fragenGesamt = fragenDaten.gesamt
  const offeneFragen = fragenDaten.offen
  const fragenOffeneVerborgen = fragenDaten.offeneVerborgen
  const posts = postsDaten.posts
  const postsGesamt = postsDaten.gesamt
  const pendingPosts = pendingPostsResult.data ?? []
  const umfragen = umfragenResult.data ?? []
  const nutzerAnzahl = nutzerResult.count ?? 0

  // Umfragen-Ergebnisse — aggregierte RPC-Funktionen, eine pro Umfrage
  type ErgebnisZeile = { frage_id: string; option_id: string | null; antwort_text: string | null; anzahl: number }

  const umfragenMitErgebnissen = await Promise.all(
    umfragen.map(async (umfrage) => {
      const [ergebnisResult, teilnehmerResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('umfrage_ergebnisse', { p_umfrage_id: umfrage.id }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('umfrage_teilnehmer_anzahl', { p_umfrage_id: umfrage.id }),
      ])

      const antworten: ErgebnisZeile[] = ergebnisResult.data ?? []
      const teilnehmer: number = teilnehmerResult.data ?? 0

      const ergebnisse: FrageErgebnis[] = (umfrage.umfrage_fragen ?? []).map((frage: {
        id: string; frage_text: string; typ: string;
        umfrage_optionen?: { id: string; option_text: string; reihenfolge: number }[]
      }) => {
        const fa = antworten.filter(a => a.frage_id === frage.id)
        if (frage.typ === 'ja_nein') {
          const ja   = fa.filter(a => a.antwort_text === 'ja').reduce((s, a) => s + a.anzahl, 0)
          const nein = fa.filter(a => a.antwort_text === 'nein').reduce((s, a) => s + a.anzahl, 0)
          const g = ja + nein || 1
          return { frage_id: frage.id, frage_text: frage.frage_text, typ: 'ja_nein' as const, gesamt_antworten: ja + nein,
            optionen: [{ label: 'Ja', anzahl: ja, prozent: Math.round((ja/g)*100) }, { label: 'Nein', anzahl: nein, prozent: Math.round((nein/g)*100) }] }
        }
        if (frage.typ === 'bewertung') {
          const sumAnzahl    = fa.reduce((s, a) => s + a.anzahl, 0)
          const sumGewichtet = fa.reduce((s, a) => s + parseInt(a.antwort_text ?? '0') * a.anzahl, 0)
          const avg = sumAnzahl ? sumGewichtet / sumAnzahl : 0
          return { frage_id: frage.id, frage_text: frage.frage_text, typ: 'bewertung' as const,
            gesamt_antworten: sumAnzahl, durchschnitt: avg,
            optionen: [1,2,3,4,5].map(v => {
              const row = fa.find(a => parseInt(a.antwort_text ?? '') === v)
              const a = row?.anzahl ?? 0
              return { label: String(v), anzahl: a, prozent: Math.round((a / (sumAnzahl || 1)) * 100) }
            }) }
        }
        const opts = (frage.umfrage_optionen ?? []).sort((a: {reihenfolge:number}, b: {reihenfolge:number}) => a.reihenfolge - b.reihenfolge)
        const gesamt = fa.reduce((s, a) => s + a.anzahl, 0)
        const g = gesamt || 1
        return { frage_id: frage.id, frage_text: frage.frage_text, typ: frage.typ as 'einzelauswahl'|'mehrfachauswahl', gesamt_antworten: gesamt,
          optionen: opts.map((o: {id:string; option_text:string}) => {
            const row = fa.find(x => x.option_id === o.id)
            const a = row?.anzahl ?? 0
            return { label: o.option_text, anzahl: a, prozent: Math.round((a/g)*100), option_id: o.id }
          }) }
      })
      return { umfrage, ergebnisse, teilnehmer }
    })
  )

  const reichweite = gemeinde?.haushalte
    ? Math.min(100, Math.round((nutzerAnzahl / gemeinde.haushalte) * 100))
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {/* pt-safe-header statt pt-8: viewportFit 'cover' legt den Inhalt sonst
          unter Statusleiste/Dynamic Island. Gleiches Muster wie in
          VereinPostVerwaltung und PageHeader. */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8 pt-safe-header pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">
              {gemeinde?.name ?? 'Gemeinde'} · {gemeinde?.bundesland}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            {gemeindeId && (
              <GemeindeEinstellungen
                gemeindeId={gemeindeId}
                initialEinwohner={gemeinde?.einwohner ?? null}
                initialHaushalte={gemeinde?.haushalte ?? null}
                initialRatsinformationUrl={gemeinde?.ratsinformation_url ?? null}
                initialNotfallnummernUrl={gemeinde?.notfallnummern_url ?? null}
                initialHomepageUrl={gemeinde?.homepage_url ?? null}
                initialMitteilungsblattUrl={gemeinde?.mitteilungsblatt_url ?? null}
                initialWarncellId={gemeinde?.warncell_id ?? null}
                initialPrimaryColor={gemeinde?.primary_color ?? null}
                initialAccentColor={gemeinde?.accent_color ?? null}
                initialLogoUrl={gemeinde?.logo_url ?? null}
              />
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6 space-y-6">

        {/* KPI-Reihe — vorher grid-cols-3 bis xl: auf dem Handy drei gequetschte
            Spalten, auf dem iPad (1024px) immer noch dieselben drei. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard icon={<Users className="w-5 h-5 text-indigo-500" />} value={nutzerAnzahl} label="Registrierte Nutzer" color="indigo" />
          <KpiCard icon={<Home className="w-5 h-5 text-sky-500" />} value={gemeinde?.haushalte ?? '–'} label="Haushalte gesamt" color="sky" />
          <KpiCard icon={<TrendingUp className="w-5 h-5 text-primary-500" />} value={reichweite !== null ? `${reichweite}%` : '–'} label="Haushalte erreicht" color="emerald" />
          <KpiCard icon={<AlertTriangle className="w-5 h-5 text-red-500" />} value={offeneMaengel} label="Offene Mängel" color="red" />
          <KpiCard icon={<Clock className="w-5 h-5 text-amber-500" />} value={inBearbeitung} label="In Bearbeitung" color="amber" />
          <KpiCard icon={<MessageCircleQuestion className="w-5 h-5 text-blue-500" />} value={offeneFragen} label="Offene Fragen" color="blue" />
        </div>

        {/* Beiträge zur Freigabe */}
        <PostFreigabe pendingPosts={pendingPosts as unknown as Parameters<typeof PostFreigabe>[0]['pendingPosts']} />

        {/* Hauptinhalt */}
        <div className="space-y-6">

          <MaengelSection
            maengel={maengel as unknown as Parameters<typeof MaengelSection>[0]['maengel']}
            gesamt={maengelGesamt}
            offeneMaengel={offeneMaengel}
            inBearbeitung={inBearbeitung}
            erledigteMaengel={erledigteMaengel}
            offeneVerborgen={maengelOffeneVerborgen}
          />

          <BuergerfrageSection
            fragen={fragen as unknown as Parameters<typeof BuergerfrageSection>[0]['fragen']}
            gesamt={fragenGesamt}
            offeneVerborgen={fragenOffeneVerborgen}
          />

          {gemeindeId && user && (
            <PostVerwaltungSection
              posts={posts as unknown as Parameters<typeof PostVerwaltungSection>[0]['posts']}
              gesamt={postsGesamt}
              gemeindeId={gemeindeId}
              profileId={user.id}
              canPin={['verwaltung', 'super_admin'].includes(profile.role)}
              canPush={['verwaltung', 'super_admin'].includes(profile.role)}
            />
          )}

          {gemeindeId && (
            <UmfragenSection
              umfragen={umfragenMitErgebnissen as unknown as Parameters<typeof UmfragenSection>[0]['umfragen']}
              gemeindeId={gemeindeId}
              haushalte={gemeinde?.haushalte ?? null}
            />
          )}

          {wasteFeatureAktiv && (
            <AbfallkalenderSection einstellungen={abfallEinstellungen} />
          )}

          {profile.role === 'verwaltung' && (
            <WarnmeldungenSection
              warnmeldungen={warnmeldungen as unknown as Parameters<typeof WarnmeldungenSection>[0]['warnmeldungen']}
              gesamt={warnmeldungenGesamt}
              aktiveVerborgen={warnmeldungenAktiveVerborgen}
            />
          )}

        </div>

        {/* Nutzer & Rollen */}
        <EinladungenSection />

      </div>
    </div>
  )
}

function KpiCard({ icon, value, label, color }: {
  icon: React.ReactNode
  value: string | number
  label: string
  color: 'indigo' | 'sky' | 'emerald' | 'red' | 'amber' | 'blue'
}) {
  const bg: Record<string, string> = {
    indigo: 'bg-indigo-50', sky: 'bg-sky-50', emerald: 'bg-primary-50',
    red: 'bg-red-50', amber: 'bg-amber-50', blue: 'bg-blue-50',
  }
  return (
    <div className={`${bg[color]} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 font-medium mt-0.5 leading-tight">{label}</p>
    </div>
  )
}

