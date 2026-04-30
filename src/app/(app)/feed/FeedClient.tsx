'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { PostMitProfil, Profile } from '@/types/database'
import { PageHeader } from '@/components/ui'
import { FeedCard, FeedFilter } from '@/features/feed'
import UmfrageCard from '@/components/umfrage/UmfrageCard'
import { Umfrage } from '@/types/umfrage'

interface UmfrageMitDaten {
  umfrage: Umfrage
  hatAbgestimmt: boolean
  teilnehmerAnzahl: number
}

interface Props {
  posts: PostMitProfil[]
  profile: (Profile & { gemeinden?: { name: string } | null }) | null
  alleVereine?: string[]
  umfragen: UmfrageMitDaten[]
  gewerbeAbonnements?: string[]
}

export default function FeedClient({ posts: initialPosts, profile, umfragen: initialUmfragen, gewerbeAbonnements = [] }: Props) {
  const [umfragen, setUmfragen] = useState(initialUmfragen)
  const [showFilter, setShowFilter] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set())
  const [selectedDays, setSelectedDays] = useState<number | null>(null)
  const [nurLokaleAngebote, setNurLokaleAngebote] = useState(false)

  const gemeindeName = profile?.gemeinden?.name ?? ''

  // ── Filter-Logik ──────────────────────────────────────────────────────────

  const hasVerwaltungPosts = initialPosts.some(p => {
    const r = (p.profiles as { role?: string } | null)?.role
    return r === 'verwaltung' || r === 'super_admin'
  })

  const vereinNames = [...new Set(
    initialPosts
      .map(p => (p.profiles as { verein_name?: string | null } | null)?.verein_name)
      .filter((v): v is string => !!v),
  )]

  const activeFilterCount = selectedSenders.size + (selectedDays ? 1 : 0) + (nurLokaleAngebote ? 1 : 0)

  const cutoff = selectedDays
    ? new Date(Date.now() - selectedDays * 24 * 60 * 60 * 1000)
    : null

  const filtered = initialPosts.filter(p => {
    if (cutoff && new Date(p.published_at) < cutoff) return false
    // Gewerbe-Posts nur anzeigen wenn abonniert
    if (p.channel === 'gewerbe' && (!p.org_id || !gewerbeAbonnements.includes(p.org_id))) return false
    if (nurLokaleAngebote) {
      if (p.channel !== 'gewerbe' || !p.org_id || !gewerbeAbonnements.includes(p.org_id)) return false
    }
    if (selectedSenders.size > 0) {
      const autor = (p.profiles as { verein_name?: string | null; role?: string } | null)
      const isVerwaltungPost = autor?.role === 'verwaltung' || autor?.role === 'super_admin'
      const vereinName = autor?.verein_name
      if (isVerwaltungPost && !selectedSenders.has('__verwaltung__')) return false
      if (!isVerwaltungPost && vereinName && !selectedSenders.has(vereinName)) return false
    }
    return true
  })

  function toggleSender(sender: string) {
    setSelectedSenders(prev => {
      const s = new Set(prev)
      s.has(sender) ? s.delete(sender) : s.add(sender)
      return s
    })
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        gemeindeName={gemeindeName}
        title="Neuigkeiten"
        actions={
          <button
            onClick={() => setShowFilter(true)}
            className="relative flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtern
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 bg-gold-500 rounded-full text-white text-[10px] flex items-center justify-center font-black">
                {activeFilterCount}
              </span>
            )}
          </button>
        }
      />

      <FeedFilter
        open={showFilter}
        onClose={() => setShowFilter(false)}
        selectedSenders={selectedSenders}
        selectedDays={selectedDays}
        onToggleSender={toggleSender}
        onSetDays={setSelectedDays}
        hasVerwaltungPosts={hasVerwaltungPosts}
        vereinNames={vereinNames}
        nurLokaleAngebote={nurLokaleAngebote}
        onToggleLokaleAngebote={() => setNurLokaleAngebote(v => !v)}
        hatGewerbeAbonnements={gewerbeAbonnements.length > 0}
      />

      <div className="p-4 space-y-4 pt-4">
        {/* Aktive Umfragen oben */}
        {umfragen.map(({ umfrage, hatAbgestimmt, teilnehmerAnzahl }) => (
          <UmfrageCard
            key={umfrage.id}
            umfrage={umfrage}
            hatAbgestimmt={hatAbgestimmt}
            teilnehmerAnzahl={teilnehmerAnzahl}
            profile={profile}
            onDelete={id => setUmfragen(prev => prev.filter(u => u.umfrage.id !== id))}
            onUpdate={updated =>
              setUmfragen(prev =>
                prev.map(u => u.umfrage.id === updated.id ? { ...u, umfrage: updated } : u),
              )
            }
          />
        ))}

        {filtered.length === 0 && umfragen.length === 0 && (
          <div className="text-center text-gray-400 py-16">
            <p className="font-bold text-base uppercase tracking-wide">Keine Beiträge</p>
          </div>
        )}

        {filtered.map(post => (
          <FeedCard
            key={post.id}
            post={post}
            expanded={expanded.has(post.id)}
            onToggleExpand={() => toggleExpanded(post.id)}
            gemeindeName={gemeindeName}
          />
        ))}
      </div>
    </div>
  )
}
