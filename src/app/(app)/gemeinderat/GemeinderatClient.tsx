'use client'


import { toast } from 'sonner'
import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { Scale, Users, Send, X, Loader2, MessageCircle, User, CheckCircle, Clock, Mail } from 'lucide-react'
import Link from 'next/link'
import { clsx } from 'clsx'

interface Post {
  id: string
  titel: string
  inhalt: string
  bild_url: string | null
  bilder_urls: string[] | null
  tag: string | null
  published_at: string
  profiles: { display_name: string | null; verein_name: string | null } | null
}

interface Rat {
  id: string
  display_name: string | null
  verein_name: string | null
  fraktion: string | null
  ueber_mich: string | null
  kontakt_email: string | null
}

interface MeineFrage {
  id: string
  frage: string
  antwort: string | null
  status: string
  created_at: string
  gemeinderat_id: string
  profiles: { display_name: string | null } | null
}

interface Props {
  posts: Post[]
  raete: Rat[]
  meineFragen: MeineFrage[]
  profileId: string
  gemeindeId: string
  gemeindeName: string
}

export default function GemeinderatClient({ posts, raete, meineFragen, profileId, gemeindeId, gemeindeName }: Props) {
  const [activeTab, setActiveTab] = useState<'beitraege' | 'raete' | 'meine-fragen'>('beitraege')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedRat, setSelectedRat] = useState<Rat | null>(null)
  const [expandedRat, setExpandedRat] = useState<string | null>(null)

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  const [frage, setFrage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)

  async function sendFrage() {
    if (!frage.trim() || !selectedRat) return
    setSending(true)
    const res = await fetch('/api/gemeinderat/frage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemeinderatId: selectedRat.id, frage, gemeindeId }),
    })
    setSending(false)
    if (res.ok) {
      setSent(selectedRat.id)
      setFrage('')
      setSelectedRat(null)
    } else {
      toast.error('Fehler beim Senden der Frage')
    }
  }

  const TAG_COLORS: Record<string, string> = {
    nachricht: 'bg-primary-50 text-primary-700',
    veranstaltung: 'bg-purple-100 text-purple-700',
    bekanntmachung: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="min-h-screen bg-[#f5f7fc]">
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-10 pb-0 sticky top-0 z-10">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-gold-500 text-[10px] font-bold tracking-[3px] uppercase">{gemeindeName}</p>
            <h1 className="text-white font-extrabold text-[22px] leading-tight mt-0.5">Gemeinderat</h1>
          </div>
          <Link href="/profil" className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-white" />
          </Link>
        </div>
        <div className="flex gap-1.5 pb-3">
          {[
            { id: 'beitraege', label: 'Beiträge' },
            { id: 'raete', label: 'Räte & Fragen' },
            { id: 'meine-fragen', label: meineFragen.length > 0 ? `Meine Fragen (${meineFragen.length})` : 'Meine Fragen' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'beitraege' | 'raete' | 'meine-fragen')}
              className={clsx('px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors',
                activeTab === tab.id ? 'bg-gold-500 text-white' : 'bg-white/15 text-white/75')}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4 pt-4">
        {/* BEITRÄGE TAB */}
        {activeTab === 'beitraege' && (
          <>
            {posts.length === 0 && (
              <div className="text-center text-gray-400 py-16">
                <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-base uppercase tracking-wide">Noch keine Beiträge</p>
              </div>
            )}
            {posts.map(post => {
              const autor = post.profiles
              const autorName = autor?.display_name ?? 'Gemeinderat'
              const bilder = (post.bilder_urls as string[] | null)?.length
                ? post.bilder_urls as string[]
                : post.bild_url ? [post.bild_url] : []
              const tag = post.tag ?? 'nachricht'
              const isExpanded = expanded.has(post.id)

              return (
                <article key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-primary-500 px-4 py-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gold-500">Gemeinderat</span>
                  </div>
                  {bilder.length > 0 && (
                    <img src={bilder[0]} alt={post.titel} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide', TAG_COLORS[tag] ?? TAG_COLORS.nachricht)}>
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de })}
                      </span>
                    </div>
                    <h2 className="font-black text-gray-900 text-base leading-snug uppercase tracking-wide">{post.titel}</h2>
                    <div onClick={() => toggleExpanded(post.id)} className="cursor-pointer">
                      <p className={clsx('text-gray-600 text-sm mt-2 leading-relaxed', !isExpanded && 'line-clamp-3')}>
                        {post.inhalt}
                      </p>
                      {!isExpanded && (
                        <span className="text-xs font-bold text-primary-500 mt-1 inline-block">Mehr lesen</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-black text-primary-700 shrink-0">
                        {autorName[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">{autorName}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </>
        )}

        {/* RÄTE & FRAGEN TAB */}
        {activeTab === 'raete' && (
          <>
            <p className="text-xs text-gray-500 px-1">
              Alle Gemeinderäte in {gemeindeName}. Du kannst ihnen direkt und privat Fragen stellen.
            </p>
            {raete.length === 0 && (
              <div className="text-center text-gray-400 py-16">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-base uppercase tracking-wide">Keine Gemeinderäte</p>
              </div>
            )}
            {raete.map(rat => {
              const name = rat.display_name ?? 'Gemeinderat'
              const hatGesendet = sent === rat.id
              const isExpanded = expandedRat === rat.id
              return (
                <div key={rat.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedRat(isExpanded ? null : rat.id)}
                    className="w-full p-4 flex items-center gap-4 text-left"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-lg font-black text-primary-700 shrink-0">
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {rat.fraktion ? `${rat.fraktion} · ` : ''}{gemeindeName}
                      </p>
                    </div>
                    <MessageCircle className={clsx('w-4 h-4 shrink-0 transition-colors', isExpanded ? 'text-primary-500' : 'text-gray-300')} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-100">
                      {rat.ueber_mich && (
                        <p className="text-sm text-gray-600 leading-relaxed">{rat.ueber_mich}</p>
                      )}
                      {!rat.ueber_mich && (
                        <p className="text-sm text-gray-400 italic">Noch keine Beschreibung hinterlegt.</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {hatGesendet ? (
                          <span className="text-xs text-green-600 font-medium">Frage gesendet ✓</span>
                        ) : (
                          <button
                            onClick={() => setSelectedRat(rat)}
                            className="flex items-center gap-1.5 bg-primary-50 text-primary-600 font-bold text-xs px-3 py-2 rounded-xl"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Frage stellen
                          </button>
                        )}
                        {rat.kontakt_email && (
                          <a
                            href={`mailto:${rat.kontakt_email}`}
                            className="flex items-center gap-1.5 bg-gray-50 text-gray-600 font-bold text-xs px-3 py-2 rounded-xl"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            E-Mail schreiben
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* MEINE FRAGEN TAB */}
        {activeTab === 'meine-fragen' && (
          <>
            {meineFragen.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-bold text-base uppercase tracking-wide">Noch keine Fragen</p>
                <p className="text-sm mt-1">Stelle einem Gemeinderat eine Frage im Tab "Räte & Fragen".</p>
              </div>
            ) : (
              meineFragen.map(frage => {
                const ratName = frage.profiles?.display_name ?? 'Gemeinderat'
                const beantwortet = frage.status === 'beantwortet'
                return (
                  <div key={frage.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Frage an</p>
                        <p className="font-bold text-gray-900 text-sm">{ratName}</p>
                      </div>
                      {beantwortet ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                          <CheckCircle className="w-3.5 h-3.5" /> Beantwortet
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" /> Offen
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Deine Frage</p>
                        <p className="text-sm text-gray-800">{frage.frage}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(frage.created_at), 'd. MMM yyyy', { locale: de })}
                        </p>
                      </div>
                      {frage.antwort && (
                        <div className="bg-primary-50 rounded-xl p-3">
                          <p className="text-xs font-bold text-primary-600 uppercase tracking-wider mb-1">Antwort von {ratName}</p>
                          <p className="text-sm text-gray-800">{frage.antwort}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      {/* Frage-Modal */}
      {selectedRat && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <p className="text-xs text-gray-400">Frage an</p>
                <p className="font-bold text-gray-900">{selectedRat.display_name ?? 'Gemeinderat'}</p>
              </div>
              <button onClick={() => { setSelectedRat(null); setFrage('') }}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-primary-50 rounded-xl px-3 py-2 text-xs text-primary-700 font-medium">
                🔒 Diese Frage ist privat — nur du und der Gemeinderat sehen sie.
              </div>
              <textarea
                value={frage}
                onChange={e => setFrage(e.target.value)}
                placeholder="Deine Frage…"
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={sendFrage}
                disabled={sending || !frage.trim()}
                className="w-full bg-primary-500 text-white font-bold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Frage absenden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
