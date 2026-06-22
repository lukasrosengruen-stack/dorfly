import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isFeatureAktiv } from '@/lib/features'
import { Users, Home, TrendingUp, AlertTriangle, Clock, MessageCircleQuestion, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { FrageErgebnis } from '@/types/umfrage'
import AbfallkalenderSection from '@/components/dashboard/AbfallkalenderSection'
import EinladungenSection from '@/components/dashboard/EinladungenSection'
import GemeindeEinstellungen from '@/components/dashboard/GemeindeEinstellungen'
import PostFreigabe from '@/components/dashboard/PostFreigabe'
import PostVerwaltungSection from '@/components/dashboard/PostVerwaltungSection'
import BuergerfrageSection from '@/components/dashboard/BuergerfrageSection'
import MaengelSection from '@/components/dashboard/MaengelSection'
import UmfragenSection from '@/components/dashboard/UmfragenSection'

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
        .select('id, titel, inhalt, status, created_at, tag, bild_url, publish_at, rejection_reason')
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
  } | null

  const service = await createServiceClient()

  const wasteFeatureAktiv = isFeatureAktiv(gemeinde, 'abfallkalender')

  const aktiveWarnungenResult = profile.role === 'verwaltung'
    ? await (service.from('posts') as any)
        .select('id', { count: 'exact', head: true })
        .eq('gemeinde_id', gemeindeId!)
        .eq('channel', 'warnung')
        .eq('is_active', true)
    : null
  const aktiveWarnungenAnzahl: number = aktiveWarnungenResult?.count ?? 0

  const [maengelResult, fragenResult, postsResult, pendingPostsResult, umfragenResult, nutzerResult, abfallEinstellungenResult] = await Promise.all([
    supabase.from('maengel').select('id, titel, status, created_at, beschreibung, adresse, foto_url, lat, lng, nachricht_an_buerger, profiles(display_name)').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }),
    supabase.from('fragen').select('id, frage, antwort, status, created_at, profiles(display_name)').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }),
    service.from('posts').select('id, titel, inhalt, tag, channel, pinned, bild_url, veranstaltung_datum, veranstaltung_ort, published_at, publish_at, profiles(role)').eq('gemeinde_id', gemeindeId!).eq('status', 'published').order('published_at', { ascending: false }).limit(50),
    service.from('posts').select('id, titel, inhalt, channel, tag, created_at, publish_at, bild_url, bilder_urls, profiles(display_name, verein_name, role)').eq('gemeinde_id', gemeindeId!).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('umfragen').select('*, umfrage_fragen(*, umfrage_optionen(*))').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }),
    service.from('profiles').select('id, role', { count: 'exact' }).eq('gemeinde_id', gemeindeId!),
    supabase.from('abfallkalender_einstellungen').select('*').eq('gemeinde_id', gemeindeId!).maybeSingle(),
  ])

  const abfallEinstellungen = abfallEinstellungenResult.data ?? null
  const maengel = maengelResult.data ?? []
  const fragen = fragenResult.data ?? []
  const posts = postsResult.data ?? []
  const pendingPosts = pendingPostsResult.data ?? []
  const umfragen = umfragenResult.data ?? []
  const nutzerAnzahl = nutzerResult.count ?? 0

  const offeneMaengel = maengel.filter(m => m.status === 'offen').length
  const inBearbeitung = maengel.filter(m => m.status === 'in_bearbeitung').length
  const erledigteMaengel = maengel.filter(m => m.status === 'erledigt').length
  const offeneFragen = fragen.filter(f => f.status === 'offen').length

  // Umfragen-Ergebnisse — N+1-Fix: 2 Bulk-Queries statt 2n Einzelabfragen
  const umfragenIds = umfragen.map(u => u.id)
  const [alleAntwortenResult, alleTeilnahmenResult] = umfragenIds.length > 0
    ? await Promise.all([
        supabase.from('umfrage_antworten').select('umfrage_id, frage_id, antwort_text, option_id').in('umfrage_id', umfragenIds),
        supabase.from('umfrage_teilnahmen').select('umfrage_id').in('umfrage_id', umfragenIds),
      ])
    : [{ data: [] as { umfrage_id: string; frage_id: string; antwort_text: string | null; option_id: string | null }[] },
       { data: [] as { umfrage_id: string }[] }]

  const alleAntworten = alleAntwortenResult.data ?? []
  const alleTeilnahmen = alleTeilnahmenResult.data ?? []

  const umfragenMitErgebnissen = umfragen.map((umfrage) => {
      const antworten = alleAntworten.filter(a => a.umfrage_id === umfrage.id)
      const teilnehmer = alleTeilnahmen.filter(t => t.umfrage_id === umfrage.id).length

      const ergebnisse: FrageErgebnis[] = (umfrage.umfrage_fragen ?? []).map((frage: {
        id: string; frage_text: string; typ: string;
        umfrage_optionen?: { id: string; option_text: string; reihenfolge: number }[]
      }) => {
        const fa = antworten.filter(a => a.frage_id === frage.id)
        if (frage.typ === 'ja_nein') {
          const ja = fa.filter(a => a.antwort_text === 'ja').length
          const nein = fa.filter(a => a.antwort_text === 'nein').length
          const g = ja + nein || 1
          return { frage_id: frage.id, frage_text: frage.frage_text, typ: 'ja_nein' as const, gesamt_antworten: ja + nein,
            optionen: [{ label: 'Ja', anzahl: ja, prozent: Math.round((ja/g)*100) }, { label: 'Nein', anzahl: nein, prozent: Math.round((nein/g)*100) }] }
        }
        if (frage.typ === 'bewertung') {
          const werte = fa.map(a => parseInt(a.antwort_text ?? '0')).filter(v => v > 0)
          const avg = werte.length ? werte.reduce((s, v) => s + v, 0) / werte.length : 0
          return { frage_id: frage.id, frage_text: frage.frage_text, typ: 'bewertung' as const,
            gesamt_antworten: werte.length, durchschnitt: avg,
            optionen: [1,2,3,4,5].map(v => { const a = werte.filter(w=>w===v).length; return { label: String(v), anzahl: a, prozent: Math.round((a/(werte.length||1))*100) } }) }
        }
        const opts = (frage.umfrage_optionen ?? []).sort((a: {reihenfolge:number}, b: {reihenfolge:number}) => a.reihenfolge - b.reihenfolge)
        const g = fa.length || 1
        return { frage_id: frage.id, frage_text: frage.frage_text, typ: frage.typ as 'einzelauswahl'|'mehrfachauswahl', gesamt_antworten: fa.length,
          optionen: opts.map((o: {id:string; option_text:string}) => { const a = fa.filter(x=>x.option_id===o.id).length; return { label: o.option_text, anzahl: a, prozent: Math.round((a/g)*100), option_id: o.id } }) }
      })
      return { umfrage, ergebnisse, teilnehmer }
    })

  const reichweite = gemeinde?.haushalte
    ? Math.min(100, Math.round((nutzerAnzahl / gemeinde.haushalte) * 100))
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
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
              />
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">

        {/* KPI-Reihe */}
        <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
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
            offeneMaengel={offeneMaengel}
            inBearbeitung={inBearbeitung}
            erledigteMaengel={erledigteMaengel}
          />

          <BuergerfrageSection fragen={fragen as unknown as Parameters<typeof BuergerfrageSection>[0]['fragen']} />

          {gemeindeId && user && (
            <PostVerwaltungSection
              posts={posts as unknown as Parameters<typeof PostVerwaltungSection>[0]['posts']}
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
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${aktiveWarnungenAnzahl > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <ShieldAlert className={`w-5 h-5 ${aktiveWarnungenAnzahl > 0 ? 'text-red-600' : 'text-gray-400'}`} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Warnmeldungen</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {aktiveWarnungenAnzahl > 0
                        ? `${aktiveWarnungenAnzahl} aktive Warnung${aktiveWarnungenAnzahl !== 1 ? 'en' : ''}`
                        : 'Keine aktiven Warnmeldungen'}
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/warnmeldungen"
                  className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                >
                  Verwalten →
                </Link>
              </div>
            </div>
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

