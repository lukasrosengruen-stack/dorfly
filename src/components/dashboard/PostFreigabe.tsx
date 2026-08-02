'use client'


import { toast } from 'sonner'
import { useState } from 'react'
import { Check, X, Loader2, CalendarClock, Globe, Lock, MessageSquare } from 'lucide-react'

interface PendingPost {
  id: string
  titel: string
  inhalt: string
  channel: string
  tag: string | null
  created_at: string
  publish_at?: string | null
  bild_url?: string | null
  bilder_urls?: string[] | null
  profiles?: { display_name: string | null; verein_name?: string | null; role?: string | null } | null
}

export default function PostFreigabe({ pendingPosts }: { pendingPosts: PendingPost[] }) {
  const [posts, setPosts] = useState(pendingPosts)
  const [loading, setLoading] = useState<string | null>(null)
  const [sichtbarkeit, setSichtbarkeit] = useState<Record<string, 'alle' | 'abonnenten'>>({})
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const isVereinPost = (post: PendingPost) =>
    post.channel === 'verein' || post.profiles?.role === 'verein' || post.profiles?.role === 'organisation'

  async function handle(postId: string, action: 'publish' | 'reject') {
    setLoading(postId)
    try {
      const post = posts.find(p => p.id === postId)
      const body: Record<string, unknown> = { postId, action }
      if (action === 'publish' && post && isVereinPost(post)) {
        body.sichtbarkeit = sichtbarkeit[postId] ?? 'abonnenten'
      }
      if (action === 'reject' && rejectReasons[postId]) {
        body.rejectionReason = rejectReasons[postId]
      }
      const res = await fetch('/api/posts/freigeben', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setPosts(prev => prev.filter(p => p.id !== postId))
      setRejectingId(null)
    } catch (e) {
      toast.error('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'))
    } finally {
      setLoading(null)
    }
  }

  function startReject(postId: string) {
    setRejectingId(postId)
    if (!rejectReasons[postId]) {
      setRejectReasons(prev => ({ ...prev, [postId]: '' }))
    }
  }

  if (posts.length === 0) return null

  return (
    <>
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <h2 className="font-bold text-gray-900">Beiträge zur Freigabe</h2>
        <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{posts.length}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {posts.map(post => {
          const autor = post.profiles?.verein_name ?? post.profiles?.display_name ?? 'Unbekannt'
          const isLoading = loading === post.id
          const isRejecting = rejectingId === post.id
          return (
            <div key={post.id} className="px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      post.profiles?.role === 'organisation' ? 'bg-teal-100 text-teal-700' :
                      post.channel === 'verein' || post.profiles?.role === 'verein' ? 'bg-violet-100 text-violet-700' :
                      post.channel === 'gewerbe' ? 'bg-orange-100 text-orange-700' :
                      post.channel === 'gemeinderat' ? 'bg-blue-100 text-blue-700' :
                      'bg-primary-100 text-primary-700'
                    }`}>
                      {post.profiles?.role === 'organisation' ? 'Organisation' :
                       post.channel === 'verein' || post.profiles?.role === 'verein' ? 'Verein' :
                       post.channel === 'gewerbe' ? 'Gewerbe' :
                       post.channel === 'gemeinderat' ? 'Gemeinderat' : 'Gemeinde'}
                    </span>
                    <span className="text-xs text-gray-400">{autor}</span>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{post.titel}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{post.inhalt}</p>
                  {(() => {
                    const bilder = (post.bilder_urls as string[] | null)?.length
                      ? post.bilder_urls as string[]
                      : post.bild_url ? [post.bild_url] : []
                    return bilder.length > 0 ? (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {bilder.map((url, i) => (
                          <img key={i} src={url} alt="" onClick={() => setLightboxUrl(url)}
                            className="h-16 w-16 object-cover rounded-lg border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity" />
                        ))}
                      </div>
                    ) : null
                  })()}
                  {post.publish_at && new Date(post.publish_at) > new Date() && (
                    <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg mt-1.5 w-fit">
                      <CalendarClock className="w-3 h-3" />
                      Geplant: {new Date(post.publish_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
                    </div>
                  )}
                  {isVereinPost(post) && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => setSichtbarkeit(prev => ({ ...prev, [post.id]: 'abonnenten' }))}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                          (sichtbarkeit[post.id] ?? 'abonnenten') === 'abonnenten'
                            ? 'bg-violet-100 text-violet-700 border-violet-300'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                      >
                        <Lock className="w-3 h-3" /> Nur Abonnenten
                      </button>
                      <button
                        onClick={() => setSichtbarkeit(prev => ({ ...prev, [post.id]: 'alle' }))}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                          sichtbarkeit[post.id] === 'alle'
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                      >
                        <Globe className="w-3 h-3" /> Für Alle
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handle(post.id, 'publish')}
                    disabled={isLoading || isRejecting}
                    className="flex items-center gap-1 bg-primary-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Freigeben
                  </button>
                  {!isRejecting ? (
                    <button
                      onClick={() => startReject(post.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                      Ablehnen
                    </button>
                  ) : (
                    <button
                      onClick={() => setRejectingId(null)}
                      disabled={isLoading}
                      className="flex items-center gap-1 bg-gray-100 text-gray-400 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      Abbrechen
                    </button>
                  )}
                </div>
              </div>

              {isRejecting && (
                <div className="mt-3 pt-3 border-t border-red-100">
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-red-600 font-medium">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Begründung für den Absender (Pflicht)
                  </div>
                  <textarea
                    autoFocus
                    value={rejectReasons[post.id] ?? ''}
                    onChange={e => setRejectReasons(prev => ({ ...prev, [post.id]: e.target.value }))}
                    placeholder="z.B. Inhalt entspricht nicht den Richtlinien der Gemeinde..."
                    rows={3}
                    className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  />
                  <button
                    onClick={() => handle(post.id, 'reject')}
                    disabled={isLoading || !rejectReasons[post.id]?.trim()}
                    className="mt-2 flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    Ablehnen bestätigen
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>

    {lightboxUrl && (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
        <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" />
      </div>
    )}
    </>
  )
}
