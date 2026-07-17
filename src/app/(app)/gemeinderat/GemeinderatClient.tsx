'use client'


import { toast } from 'sonner'
import { useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { Scale, Users, Send, X, Loader2, MessageCircle, User, CheckCircle, Clock, Mail } from 'lucide-react'
import { buildSocialUrl } from '@/lib/social'
import { useFocusTrap } from '@/hooks/useFocusTrap'
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
  profiles: { display_name: string | null; verein_name: string | null; avatar_url: string | null } | null
}

interface Rat {
  id: string | null
  display_name: string | null
  verein_name: string | null
  fraktion: string | null
  ueber_mich: string | null
  kontakt_email: string | null
  avatar_url: string | null
  social_x: string | null
  social_facebook: string | null
  social_instagram: string | null
  social_tiktok: string | null
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
  profileDisplayName: string | null
  gemeindeId: string
  gemeindeName: string
}

export default function GemeinderatClient({ posts, raete, meineFragen, gemeindeId, gemeindeName, profileDisplayName }: Props) {
  const [activeTab, setActiveTab] = useState<'beitraege' | 'raete' | 'meine-fragen'>('beitraege')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedRat, setSelectedRat] = useState<Rat | null>(null)
  const trapRef = useFocusTrap(!!selectedRat)
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
    if (!frage.trim() || !selectedRat || !profileDisplayName) return
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
        <div role="tablist" aria-label="Gemeinderat Bereiche" className="flex gap-1.5 pb-3">
          {[
            { id: 'beitraege', label: 'Beiträge' },
            { id: 'raete', label: 'Räte & Fragen' },
            { id: 'meine-fragen', label: meineFragen.length > 0 ? `Meine Fragen (${meineFragen.length})` : 'Meine Fragen' },
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`gr-panel-${tab.id}`}
              id={`gr-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as 'beitraege' | 'raete' | 'meine-fragen')}
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
          <div role="tabpanel" id="gr-panel-beitraege" aria-labelledby="gr-tab-beitraege" className="space-y-4">
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
                    <button onClick={() => toggleExpanded(post.id)} className="w-full text-left" aria-expanded={isExpanded}>
                      <p className={clsx('text-gray-600 text-sm mt-2 leading-relaxed', !isExpanded && 'line-clamp-3')}>
                        {post.inhalt}
                      </p>
                      {!isExpanded && (
                        <span className="text-xs font-bold text-primary-500 mt-1 inline-block">Mehr lesen</span>
                      )}
                    </button>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      {autor?.avatar_url ? (
                        <img src={autor.avatar_url} alt="" loading="lazy" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-black text-primary-700 shrink-0">
                          {autorName[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-gray-500 font-medium">{autorName}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* RÄTE & FRAGEN TAB */}
        {activeTab === 'raete' && (
          <div role="tabpanel" id="gr-panel-raete" aria-labelledby="gr-tab-raete" className="space-y-4">
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
                <div key={rat.id ?? ''} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 flex items-center gap-3">
                    <button
                      onClick={() => setExpandedRat(isExpanded ? null : rat.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`rat-detail-${rat.id}`}
                      aria-label={`${name} – Profil anzeigen`}
                      className="flex items-center gap-4 text-left flex-1 min-w-0"
                    >
                      {rat.avatar_url ? (
                        <img src={rat.avatar_url} alt="" loading="lazy" className="w-12 h-12 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-lg font-black text-primary-700 shrink-0">
                          {name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {rat.fraktion ? `${rat.fraktion} · ` : ''}{gemeindeName}
                        </p>
                      </div>
                    </button>
                    {(rat.social_x || rat.social_facebook || rat.social_instagram || rat.social_tiktok) && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {rat.social_x && (
                          <a href={buildSocialUrl('x', rat.social_x)} target="_blank" rel="noopener noreferrer" aria-label={`X-Profil von ${name}`} className="text-gray-400 hover:text-gray-700 transition-colors">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                          </a>
                        )}
                        {rat.social_facebook && (
                          <a href={buildSocialUrl('facebook', rat.social_facebook)} target="_blank" rel="noopener noreferrer" aria-label={`Facebook-Profil von ${name}`} className="text-gray-400 hover:text-gray-700 transition-colors">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          </a>
                        )}
                        {rat.social_instagram && (
                          <a href={buildSocialUrl('instagram', rat.social_instagram)} target="_blank" rel="noopener noreferrer" aria-label={`Instagram-Profil von ${name}`} className="text-gray-400 hover:text-gray-700 transition-colors">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                          </a>
                        )}
                        {rat.social_tiktok && (
                          <a href={buildSocialUrl('tiktok', rat.social_tiktok)} target="_blank" rel="noopener noreferrer" aria-label={`TikTok-Profil von ${name}`} className="text-gray-400 hover:text-gray-700 transition-colors">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.27 8.27 0 004.84 1.54V6.83a4.85 4.85 0 01-1.07-.14z"/></svg>
                          </a>
                        )}
                      </div>
                    )}
                    {hatGesendet ? (
                      <MessageCircle className="w-4 h-4 shrink-0 text-green-500" aria-label="Frage gesendet" />
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedRat(rat) }}
                        aria-label={`Frage an ${name} stellen`}
                        className={clsx('shrink-0 transition-colors hover:text-primary-500', isExpanded ? 'text-primary-500' : 'text-gray-300')}
                      >
                        <MessageCircle className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div id={`rat-detail-${rat.id}`} className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-100">
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
          </div>
        )}

        {/* MEINE FRAGEN TAB */}
        {activeTab === 'meine-fragen' && (
          <div role="tabpanel" id="gr-panel-meine-fragen" aria-labelledby="gr-tab-meine-fragen" className="space-y-4">
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
          </div>
        )}
      </div>

      {/* Frage-Modal */}
      {selectedRat && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onKeyDown={e => e.key === 'Escape' && setSelectedRat(null)}>
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rat-frage-title"
            className="bg-white w-full max-w-lg rounded-2xl shadow-xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div id="rat-frage-title">
                <p className="text-xs text-gray-400">Frage an</p>
                <p className="font-bold text-gray-900">{selectedRat.display_name ?? 'Gemeinderat'}</p>
              </div>
              <button onClick={() => { setSelectedRat(null); setFrage('') }} aria-label="Frage abbrechen">
                <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-primary-50 rounded-xl px-3 py-2 text-xs text-primary-700 font-medium">
                🔒 Diese Frage ist privat — nur du und der Gemeinderat sehen sie.
              </div>
              {!profileDisplayName && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-700">
                  Bitte fülle zuerst deinen <Link href="/profil" className="font-bold underline">Namen im Profil</Link> aus, bevor du eine Frage stellst.
                </div>
              )}
              <label htmlFor="gr-frage-text" className="sr-only">Deine Frage (Pflichtfeld)</label>
              <textarea
                id="gr-frage-text"
                value={frage}
                onChange={e => setFrage(e.target.value)}
                placeholder="Deine Frage…"
                rows={4}
                required
                aria-required="true"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={sendFrage}
                disabled={sending || !frage.trim() || !profileDisplayName}
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
