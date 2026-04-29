'use client'


import { toast } from 'sonner'
import { useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Scale, MessageCircle, CheckCircle2, Clock, Send, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import PostErstellenButton from './PostErstellenButton'

interface Post {
  id: string
  titel: string
  tag: string | null
  status: string
  published_at: string
}

interface Frage {
  id: string
  frage: string
  antwort: string | null
  status: string
  created_at: string
  fragesteller?: { display_name: string | null } | null
}

interface Props {
  posts: Post[]
  fragen: Frage[]
  gemeindeId: string
  profileId: string
}

export default function GemeinderatDashboard({ posts, fragen, gemeindeId, profileId }: Props) {
  const [activeTab, setActiveTab] = useState<'beitraege' | 'fragen'>('fragen')
  const [antworten, setAntworten] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [beantwortet, setBeantwortet] = useState<Set<string>>(new Set())

  async function sendAntwort(frageId: string) {
    const antwort = antworten[frageId]
    if (!antwort?.trim()) return
    setSending(frageId)
    const res = await fetch('/api/gemeinderat/antwort', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frageId, antwort }),
    })
    setSending(null)
    if (res.ok) {
      setBeantwortet(prev => new Set([...prev, frageId]))
      setAntworten(prev => ({ ...prev, [frageId]: '' }))
    } else {
      toast.error('Fehler beim Senden der Antwort')
    }
  }

  const offeneFragen = fragen.filter(f => f.status === 'offen' && !beantwortet.has(f.id))
  const beantworteteFragen = fragen.filter(f => f.status === 'beantwortet' || beantwortet.has(f.id))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 pt-8 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Gemeinderat</p>
            <h1 className="text-2xl font-bold text-gray-900">Mein Dashboard</h1>
          </div>
          <PostErstellenButton gemeindeId={gemeindeId} profileId={profileId} defaultChannel="gemeinderat" />
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-primary-50 rounded-2xl p-4">
            <Scale className="w-5 h-5 text-primary-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{posts.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Beiträge</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4">
            <Clock className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{offeneFragen.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Offene Fragen</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{beantworteteFragen.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Beantwortet</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {[
            { id: 'fragen', label: `Fragen (${offeneFragen.length} offen)` },
            { id: 'beitraege', label: 'Meine Beiträge' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'beitraege' | 'fragen')}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                activeTab === tab.id ? 'bg-primary-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* FRAGEN TAB */}
        {activeTab === 'fragen' && (
          <div className="space-y-4">
            {fragen.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm px-5 py-10 text-center text-gray-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Noch keine Fragen eingegangen</p>
              </div>
            )}

            {offeneFragen.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Offene Fragen</h3>
                {offeneFragen.map(frage => (
                  <div key={frage.id} className="bg-white rounded-2xl shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm leading-relaxed">{frage.frage}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {frage.fragesteller?.display_name ?? 'Bürger'} ·{' '}
                          {format(new Date(frage.created_at), 'dd. MMM yyyy', { locale: de })}
                        </p>
                      </div>
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium shrink-0">Offen</span>
                    </div>
                    <textarea
                      value={antworten[frage.id] ?? ''}
                      onChange={e => setAntworten(prev => ({ ...prev, [frage.id]: e.target.value }))}
                      placeholder="Deine Antwort…"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                    />
                    <button
                      onClick={() => sendAntwort(frage.id)}
                      disabled={sending === frage.id || !antworten[frage.id]?.trim()}
                      className="flex items-center gap-2 bg-primary-500 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
                    >
                      {sending === frage.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Antworten
                    </button>
                  </div>
                ))}
              </div>
            )}

            {beantworteteFragen.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Beantwortet</h3>
                {beantworteteFragen.map(frage => (
                  <div key={frage.id} className="bg-white rounded-2xl shadow-sm p-5 opacity-75">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-medium text-gray-900 text-sm">{frage.frage}</p>
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium shrink-0">Beantwortet</span>
                    </div>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 mt-2">{frage.antwort}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BEITRÄGE TAB */}
        {activeTab === 'beitraege' && (
          <div className="space-y-3">
            {posts.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm px-5 py-10 text-center text-gray-400">
                <Scale className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Noch keine Beiträge verfasst</p>
              </div>
            )}
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{post.titel}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(post.published_at), 'dd. MMM yyyy', { locale: de })}
                    {post.tag && ` · ${post.tag.charAt(0).toUpperCase() + post.tag.slice(1)}`}
                  </p>
                </div>
                <span className={clsx(
                  'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                  post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {post.status === 'published' ? 'Veröffentlicht' : 'Ausstehend'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
