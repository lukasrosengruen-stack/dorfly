import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BarChart2, Star, Users, Home, TrendingUp, AlertTriangle, Clock, MessageCircleQuestion } from 'lucide-react'
import { FrageErgebnis } from '@/types/umfrage'
import GemeindeEinstellungen from '@/components/dashboard/GemeindeEinstellungen'
import PostFreigabe from '@/components/dashboard/PostFreigabe'
import PostErstellenButton from '@/components/dashboard/PostErstellenButton'
import PostVerwaltungSection from '@/components/dashboard/PostVerwaltungSection'
import BuergerfrageSection from '@/components/dashboard/BuergerfrageSection'
import MaengelSection from '@/components/dashboard/MaengelSection'
import UmfrageErstellenButton from '@/components/dashboard/UmfrageErstellenButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, gemeinden(*), verein_name, gemeinde_id')
    .eq('id', user?.id ?? '')
    .single()

  if (!profile || !['verwaltung', 'super_admin', 'verein'].includes(profile.role)) {
    redirect('/feed')
  }

  // Verein sieht nur seine eigenen Beiträge
  if (profile.role === 'verein') {
    const { data: vereinPosts } = await supabase
      .from('posts')
      .select('id, titel, inhalt, status, created_at, tag, bild_url')
      .eq('author_id', user!.id)
      .order('created_at', { ascending: false })

    const VereinPostVerwaltung = (await import('@/components/dashboard/VereinPostVerwaltung')).default
    return (
      <VereinPostVerwaltung
        posts={(vereinPosts ?? []) as Parameters<typeof VereinPostVerwaltung>[0]['posts']}
        gemeindeId={profile.gemeinde_id!}
        profileId={user!.id}
        vereinName={profile.verein_name}
      />
    )
  }

  const gemeindeId = profile.gemeinde_id
  const gemeinde = profile.gemeinden as {
    id: string; name: string; bundesland: string;
    einwohner: number | null; haushalte: number | null; plz: string | null
  } | null

  const service = await createServiceClient()

  const [maengelResult, fragenResult, postsResult, pendingPostsResult, umfragenResult, nutzerResult] = await Promise.all([
    supabase.from('maengel').select('id, titel, status, created_at, profiles(display_name)').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }),
    supabase.from('fragen').select('id, frage, status, created_at').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }),
    supabase.from('posts').select('id, titel, inhalt, tag, channel, pinned, bild_url, veranstaltung_datum, veranstaltung_ort, published_at').eq('gemeinde_id', gemeindeId!).eq('status', 'published').order('published_at', { ascending: false }).limit(50),
    service.from('posts').select('id, titel, inhalt, channel, tag, created_at, profiles(display_name, verein_name)').eq('gemeinde_id', gemeindeId!).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('umfragen').select('*, umfrage_fragen(*, umfrage_optionen(*))').eq('gemeinde_id', gemeindeId!).order('created_at', { ascending: false }),
    service.from('profiles').select('id, role', { count: 'exact' }).eq('gemeinde_id', gemeindeId!),
  ])

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

  // Umfragen-Ergebnisse
  const umfragenMitErgebnissen = await Promise.all(
    umfragen.map(async (umfrage) => {
      const [antwortenResult, teilnahmenResult] = await Promise.all([
        supabase.from('umfrage_antworten').select('frage_id, antwort_text, option_id').eq('umfrage_id', umfrage.id),
        supabase.from('umfrage_teilnahmen').select('*', { count: 'exact', head: true }).eq('umfrage_id', umfrage.id),
      ])
      const antworten = antwortenResult.data ?? []
      const teilnehmer = teilnahmenResult.count ?? 0

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
  )

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
              />
            )}
            {gemeindeId && user && (
              <PostErstellenButton gemeindeId={gemeindeId} profileId={user.id} />
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

        {/* Hauptinhalt: 3 Spalten auf großen Screens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Linke 2 Spalten: Mängel + Fragen + Beiträge */}
          <div className="lg:col-span-2 space-y-6">

            <MaengelSection
              maengel={maengel as unknown as Parameters<typeof MaengelSection>[0]['maengel']}
              offeneMaengel={offeneMaengel}
              inBearbeitung={inBearbeitung}
              erledigteMaengel={erledigteMaengel}
            />

            <BuergerfrageSection fragen={fragen as unknown as Parameters<typeof BuergerfrageSection>[0]['fragen']} />

            <PostVerwaltungSection posts={posts as unknown as Parameters<typeof PostVerwaltungSection>[0]['posts']} />
          </div>

          {/* Rechte Spalte: Umfragen */}
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary-500" />
                  Umfragen
                </h2>
                {gemeindeId && <UmfrageErstellenButton gemeindeId={gemeindeId} />}
              </div>

              {umfragenMitErgebnissen.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm px-5 py-8 text-center text-gray-400 text-sm">
                  Noch keine Umfragen erstellt
                </div>
              )}

              <div className="space-y-5">
                {umfragenMitErgebnissen.map(({ umfrage, ergebnisse, teilnehmer }) => {
                  const abgelaufen = new Date(umfrage.enddatum) < new Date()
                  const beteiligung = gemeinde?.haushalte
                    ? Math.min(100, Math.round((teilnehmer / gemeinde.haushalte) * 100))
                    : null

                  return (
                    <div key={umfrage.id} className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{umfrage.titel}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>{teilnehmer} Teilnehmer</span>
                            {beteiligung !== null && <span className="text-primary-500 font-medium">{beteiligung}% der Haushalte</span>}
                            <span>{new Date(umfrage.enddatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${abgelaufen ? 'bg-gray-100 text-gray-500' : 'bg-primary-100 text-primary-600'}`}>
                          {abgelaufen ? 'Beendet' : 'Aktiv'}
                        </span>
                      </div>

                      {ergebnisse.map(ergebnis => (
                        <div key={ergebnis.frage_id} className="border-t border-gray-100 pt-3">
                          <p className="text-xs font-semibold text-gray-700 mb-2">{ergebnis.frage_text}</p>

                          {ergebnis.typ === 'bewertung' ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(i => (
                                    <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(ergebnis.durchschnitt ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                                  ))}
                                </div>
                                <span className="text-sm font-bold text-gray-700">{ergebnis.durchschnitt?.toFixed(1)} / 5</span>
                                <span className="text-xs text-gray-400">({ergebnis.gesamt_antworten} Antworten)</span>
                              </div>
                              {ergebnis.optionen.map(o => (
                                <div key={o.label} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-4">{o.label}</span>
                                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                    <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${o.prozent}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-500 w-8 text-right">{o.prozent}%</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {ergebnis.optionen.map(o => (
                                <div key={o.label}>
                                  <div className="flex justify-between text-xs mb-0.5">
                                    <span className="text-gray-700">{o.label}</span>
                                    <span className="text-gray-400">{o.anzahl} ({o.prozent}%)</span>
                                  </div>
                                  <div className="bg-gray-100 rounded-full h-2">
                                    <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${o.prozent}%` }} />
                                  </div>
                                </div>
                              ))}
                              <p className="text-xs text-gray-400 pt-0.5">{ergebnis.gesamt_antworten} Antworten gesamt</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
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

