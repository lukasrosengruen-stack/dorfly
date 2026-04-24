'use client'

import { useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'

interface PendingPost {
  id: string
  titel: string
  inhalt: string
  channel: string
  tag: string | null
  created_at: string
  profiles?: { display_name: string | null; verein_name?: string | null } | null
}

export default function PostFreigabe({ pendingPosts }: { pendingPosts: PendingPost[] }) {
  const [posts, setPosts] = useState(pendingPosts)
  const [loading, setLoading] = useState<string | null>(null)

  async function handle(postId: string, action: 'publish' | 'reject') {
    setLoading(postId)
    try {
      const res = await fetch('/api/posts/freigeben', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action }),
      })
      if (!res.ok) throw new Error()
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch {
      alert('Fehler beim Verarbeiten')
    } finally {
      setLoading(null)
    }
  }

  if (posts.length === 0) return null

  return (
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
          return (
            <div key={post.id} className="px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    post.channel === 'verein' ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {post.channel === 'verein' ? 'Verein' : 'Gewerbe'}
                  </span>
                  <span className="text-xs text-gray-400">{autor}</span>
                </div>
                <p className="font-semibold text-gray-900 text-sm">{post.titel}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{post.inhalt}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handle(post.id, 'publish')}
                  disabled={isLoading}
                  className="flex items-center gap-1 bg-primary-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Freigeben
                </button>
                <button
                  onClick={() => handle(post.id, 'reject')}
                  disabled={isLoading}
                  className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  Ablehnen
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
