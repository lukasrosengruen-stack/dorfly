import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, User, MapPin, Shield, Store, Users, AlertTriangle, BarChart2 } from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const ROLE_LABELS: Record<string, string> = {
  buerger: 'Bürger', verein: 'Verein', organisation: 'Organisation',
  verwaltung: 'Verwaltung', super_admin: 'Super-Admin', gewerbe: 'Gewerbe', gemeinderat: 'Gemeinderat',
}

const MAENGEL_STATUS: Record<string, string> = {
  offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erledigt: 'Erledigt',
}

export default async function MeineDatenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: posts },
    { data: gewerbeAbo },
    { data: vereinAbo },
    { data: maengel },
    { data: teilnahmen },
  ] = await Promise.all([
    supabase.from('profiles').select('*, gemeinden(name)').eq('id', user.id).single(),
    supabase.from('posts').select('id, titel, channel, created_at').eq('author_id', user.id).order('created_at', { ascending: false }),
    supabase.from('gewerbe_abonnements').select('organisationen(name)').eq('user_id', user.id),
    supabase.from('verein_abonnements').select('vereine(verein_name)').eq('user_id', user.id),
    supabase.from('maengel').select('id, titel, status, created_at').eq('melder_id', user.id).order('created_at', { ascending: false }),
    supabase.from('umfrage_teilnahmen').select('umfrage_id, created_at').eq('user_id', user.id),
  ])

  const gemeindeName = (profile?.gemeinden as { name: string } | null)?.name ?? '–'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex items-center gap-3">
        <Link href="/profil/datenschutz-daten" className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Meine Daten</h1>
      </div>

      <div className="p-4 space-y-4 pb-10">
        {/* Persönliche Daten */}
        <Section title="Persönliche Daten">
          <DataRow icon={User} label="Name" value={profile?.display_name ?? '–'} />
          <DataRow icon={User} label="E-Mail" value={user.email ?? '–'} />
          <DataRow icon={Shield} label="Rolle" value={ROLE_LABELS[profile?.role ?? ''] ?? profile?.role ?? '–'} />
          <DataRow icon={MapPin} label="Gemeinde" value={gemeindeName} />
          <DataRow icon={User} label="Registriert am" value={format(new Date(user.created_at), 'd. MMMM yyyy', { locale: de })} />
        </Section>

        {/* Beiträge */}
        <Section title={`Beiträge (${posts?.length ?? 0})`}>
          {posts?.length === 0 && <EmptyState text="Keine Beiträge erstellt" />}
          {posts?.slice(0, 5).map(p => (
            <div key={p.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-800 truncate">{p.titel}</p>
              <p className="text-xs text-gray-400 mt-0.5">{p.created_at ? format(new Date(p.created_at), 'd. MMM yyyy', { locale: de }) : '–'}</p>
            </div>
          ))}
          {(posts?.length ?? 0) > 5 && (
            <p className="px-4 py-2 text-xs text-gray-400">… und {(posts?.length ?? 0) - 5} weitere</p>
          )}
        </Section>

        {/* Abonnements */}
        <Section title="Abonnierte Kanäle">
          {(gewerbeAbo?.length ?? 0) === 0 && (vereinAbo?.length ?? 0) === 0 && (
            <EmptyState text="Keine Abonnements" />
          )}
          {gewerbeAbo?.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <Store className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700">{(a.organisationen as { name: string } | null)?.name ?? '–'}</span>
            </div>
          ))}
          {vereinAbo?.map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <Users className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700">{(a.vereine as { verein_name: string } | null)?.verein_name ?? '–'}</span>
            </div>
          ))}
        </Section>

        {/* Mängel */}
        <Section title={`Gemeldete Mängel (${maengel?.length ?? 0})`}>
          {maengel?.length === 0 && <EmptyState text="Keine Mängel gemeldet" />}
          {maengel?.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{m.titel}</p>
                <p className="text-xs text-gray-400">{m.status ? (MAENGEL_STATUS[m.status] ?? m.status) : '–'}</p>
              </div>
            </div>
          ))}
        </Section>

        {/* Umfragen */}
        <Section title={`Teilgenommene Umfragen (${teilnahmen?.length ?? 0})`}>
          {teilnahmen?.length === 0 && <EmptyState text="An keiner Umfrage teilgenommen" />}
          {teilnahmen?.map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <BarChart2 className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-400">{t.created_at ? format(new Date(t.created_at), 'd. MMM yyyy', { locale: de }) : '–'}</span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  )
}

function DataRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-3 text-sm text-gray-400">{text}</p>
}
