import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Calendar, Eye, MapPin, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { PUBLIC_POST_SELECT } from '@/lib/publicPostQuery'
import { shareCtaZiele } from '@/lib/shareCta'
import { getGemeindeSlug } from '@/lib/gemeinde'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getPost(id: string) {
  const { data, error } = await supabase
    .from('posts')
    .select(PUBLIC_POST_SELECT)
    .eq('id', id)
    .eq('status', 'published')
    .single()

  // PGRST116 heisst "keine Zeile" — das ist ein echtes 404. Jeder andere Fehler
  // muss sichtbar werden: Ein fehlendes Leserecht (42501) hat sich hier lange als
  // "Beitrag nicht gefunden" getarnt, weil der Fehler verschluckt wurde.
  if (error && error.code !== 'PGRST116') throw error

  return data
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const post = await getPost(id)
  if (!post) return { title: 'Dorfly' }

  const gemeindeName = (post.gemeinden as { name?: string } | null)?.name ?? 'Gemeinde'
  const description = post.inhalt.slice(0, 160)
  const image = post.bild_url ?? 'https://dorfly.vercel.app/og-default.png'

  return {
    title: `${post.titel} – ${gemeindeName}`,
    description,
    openGraph: {
      title: post.titel,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: post.titel }],
      siteName: 'Dorfly',
      locale: 'de_DE',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.titel,
      description,
      images: [image],
    },
  }
}

const TAG_COLORS: Record<string, string> = {
  nachricht:      'bg-primary-100 text-primary-700',
  veranstaltung:  'bg-purple-100 text-purple-700',
  bekanntmachung: 'bg-amber-100 text-amber-700',
  sammlung:       'bg-emerald-100 text-emerald-700',
}
const TAG_LABELS: Record<string, string> = {
  nachricht: 'Nachricht', veranstaltung: 'Veranstaltung', bekanntmachung: 'Bekanntmachung', sammlung: 'Sammlung',
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()

  const ziele = shareCtaZiele(await getGemeindeSlug())
  const gemeindeName = (post.gemeinden as { name?: string } | null)?.name ?? 'Gemeinde Ehningen'
  const autor = post.profiles as { display_name?: string; verein_name?: string } | null
  const autorName = autor?.verein_name ?? autor?.display_name ?? gemeindeName
  const tag = post.tag ?? 'nachricht'
  const bilder = (post.bilder_urls as string[] | null)?.length
    ? post.bilder_urls as string[]
    : post.bild_url ? [post.bild_url] : []
  const alleTermine = post.veranstaltung_datum
    ? [post.veranstaltung_datum, ...(post.post_termine ?? []).map(t => t.datum)].sort()
    : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Kopf in der Bildsprache der App: offizielle Wortmarke in der weissen
          Variante (Markenblau waere auf primary-500 nicht lesbar), Gemeindename
          als Gold-Eyebrow wie im PageHeader. pt-safe-header haelt ihn aus der Notch. */}
      <header className="bg-primary-500 px-4 pt-safe-header pb-5">
        <Image
          src="/logo_dorfly_weiss.png"
          alt="Dorfly"
          width={71}
          height={22}
          priority
        />
        <p className="text-gold-500 text-[10px] font-bold tracking-[3px] uppercase mt-3">
          {gemeindeName}
        </p>
      </header>

      {/* Beitrag */}
      <div className="max-w-2xl mx-auto">
        {/* Gleiche Bildregeln wie im Newsfeed statt fester h-64: sonst werden
            Hochkant-Plakate hier beschnitten, obwohl sie in der Liste passen. */}
        {bilder.length > 0 && (
          <span className="feed-bild-rahmen block">
            <img src={bilder[0]} alt={post.titel} className="feed-bild" />
          </span>
        )}

        <div className="bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${TAG_COLORS[tag] ?? TAG_COLORS.nachricht}`}>
              {TAG_LABELS[tag] ?? tag}
            </span>
            {/* text-gray-400 erreicht auf Weiss nur 2.8:1 (Checkliste: mind. 4.5:1) */}
            <span className="text-xs text-gray-500 ml-auto">
              {format(new Date(post.published_at), 'd. MMMM yyyy', { locale: de })}
            </span>
          </div>

          <h1 className="text-[26px] font-extrabold text-gray-900 tracking-[-0.02em] leading-tight mb-3">
            {post.titel}
          </h1>

          {alleTermine.length > 0 && (
            <div className="mb-4 px-3 py-2 bg-purple-50 rounded-xl space-y-1.5">
              {alleTermine.map(datum => {
                const vergangen = new Date(datum) < new Date()
                return (
                  <div key={datum} className={`flex items-center gap-1.5 ${vergangen ? 'opacity-50' : ''}`}>
                    <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="text-sm text-purple-700 font-bold">
                      {format(new Date(datum), 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })} Uhr
                    </span>
                  </div>
                )
              })}
              {post.veranstaltung_ort && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="text-sm text-purple-700">{post.veranstaltung_ort}</span>
                </div>
              )}
            </div>
          )}

          {post.sammlung_datum && (
            <div className="mb-4 px-3 py-2 bg-emerald-50 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-700 font-bold">
                  {format(new Date(post.sammlung_datum), 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })} Uhr
                </span>
              </div>
              {post.sammlung_organisator && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm text-emerald-700">{post.sammlung_organisator}</span>
                </div>
              )}
            </div>
          )}

          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{post.inhalt}</p>

          {bilder.length > 1 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {bilder.slice(1).map((url, i) => (
                <img key={i} src={url} alt="" className="w-full h-40 object-cover rounded-xl" />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-gray-100">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-black text-primary-700 shrink-0">
              {autorName[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-500 font-medium">{autorName}</span>
          </div>
        </div>

        {/* CTA in der Kartensprache der App: weiche Ecken, getragener Schatten,
            Sekundaertext aus dem Vordergrund getoent statt in primary-200. */}
        <div className="bg-primary-500 mx-4 my-6 rounded-[20px] p-6 text-center shadow-[0_4px_14px_rgba(15,45,107,0.33)]">
          {/* Wortmarke statt App-Icon: Die Karte nennt die Marke, nach der man
              sucht — der Name gehoert hierher, nicht das Kachel-Symbol. */}
          <Image
            src="/logo_dorfly_weiss.png"
            alt=""
            width={97}
            height={30}
            className="mx-auto mb-4"
          />
          <p className="text-white font-extrabold text-xl leading-tight mb-1.5">
            Alle Neuigkeiten aus {gemeindeName}
          </p>
          <p className="text-white/70 text-sm mb-5">
            Bleib informiert – jetzt Dorfly herunterladen
          </p>
          <Link href={ziele.primaer}
            className="block bg-white text-primary-600 font-semibold px-6 py-3.5 rounded-2xl text-sm transition-all duration-150 ease-out active:scale-[0.97]">
            Dorfly für {gemeindeName} holen
          </Link>

          {/* Seit dem Gastzugang ist Registrierung nicht mehr der einzige Weg:
              Wer hier ankommt, soll auch ohne Anmeldung weiterlesen koennen. */}
          {ziele.sekundaer && (
            <Link href={ziele.sekundaer}
              className="mt-3 flex items-center justify-center gap-2 border-2 border-white/60 text-white font-semibold px-6 py-3.5 rounded-2xl text-sm transition-all duration-150 ease-out active:scale-[0.97]">
              <Eye className="w-4 h-4" aria-hidden="true" />
              Ohne Anmeldung ansehen
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
