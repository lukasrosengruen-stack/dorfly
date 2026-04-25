import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Calendar, MapPin, MessageSquare } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getPost(id: string) {
  const { data } = await supabase
    .from('posts')
    .select('id, titel, inhalt, bild_url, bilder_urls, tag, channel, veranstaltung_datum, veranstaltung_ort, published_at, gemeinde_id, profiles(display_name, verein_name), gemeinden(name)')
    .eq('id', id)
    .eq('status', 'published')
    .single()
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
}
const TAG_LABELS: Record<string, string> = {
  nachricht: 'Nachricht', veranstaltung: 'Veranstaltung', bekanntmachung: 'Bekanntmachung',
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()

  const gemeindeName = (post.gemeinden as { name?: string } | null)?.name ?? 'Gemeinde Ehningen'
  const autor = post.profiles as { display_name?: string; verein_name?: string } | null
  const autorName = autor?.verein_name ?? autor?.display_name ?? gemeindeName
  const tag = post.tag ?? 'nachricht'
  const bilder = (post.bilder_urls as string[] | null)?.length
    ? post.bilder_urls as string[]
    : post.bild_url ? [post.bild_url] : []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-white" />
          <span className="text-white font-black text-lg tracking-wide uppercase">Dorfly</span>
        </div>
        <p className="text-primary-200 text-xs font-medium">{gemeindeName}</p>
      </div>

      {/* Beitrag */}
      <div className="max-w-2xl mx-auto">
        {bilder.length > 0 && (
          <img src={bilder[0]} alt={post.titel} className="w-full h-64 object-cover" />
        )}

        <div className="bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${TAG_COLORS[tag] ?? TAG_COLORS.nachricht}`}>
              {TAG_LABELS[tag] ?? tag}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              {format(new Date(post.published_at), 'd. MMMM yyyy', { locale: de })}
            </span>
          </div>

          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide leading-snug mb-3">
            {post.titel}
          </h1>

          {post.veranstaltung_datum && (
            <div className="mb-4 px-3 py-2 bg-purple-50 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="text-sm text-purple-700 font-bold">
                  {format(new Date(post.veranstaltung_datum), 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })} Uhr
                </span>
              </div>
              {post.veranstaltung_ort && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="text-sm text-purple-700">{post.veranstaltung_ort}</span>
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

        {/* CTA */}
        <div className="bg-primary-500 mx-4 my-6 rounded-2xl p-6 text-center">
          <p className="text-white font-black text-lg uppercase tracking-wide leading-snug mb-1">
            Alle Neuigkeiten aus {gemeindeName}
          </p>
          <p className="text-primary-200 text-sm mb-4">
            Bleib informiert – jetzt Dorfly herunterladen
          </p>
          <Link href="/login"
            className="inline-block bg-white text-primary-600 font-bold px-6 py-3 rounded-xl text-sm">
            Jetzt registrieren
          </Link>
        </div>
      </div>
    </div>
  )
}
