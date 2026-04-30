'use client'

import { useState } from 'react'
import { Building2, Users, PenLine, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { PageHeader, Card } from '@/components/ui'
import { GewerbeProfilForm, GewerbePostForm, AbonnentenStats } from '@/features/gewerbe'
import type { Organisation, Post, Profile, Gewerbebranche } from '@/types/database'

interface Props {
  profile: Profile & { gemeinden?: { name: string } | null }
  betrieb: Organisation | null
  branchen: Gewerbebranche[]
  abonnentenStats: { gesamt: number; letzter7Tage: number; letzter30Tage: number } | null
  posts: Post[]
  naechsterMontag: string | null
}

export default function GewerbeDashboardClient({ profile, betrieb: initialBetrieb, branchen, abonnentenStats, posts: initialPosts, naechsterMontag: initialNaechsterMontag }: Props) {
  const [betrieb, setBetrieb] = useState(initialBetrieb)
  const [posts, setPosts] = useState(initialPosts)
  const [naechsterMontag, setNaechsterMontag] = useState(initialNaechsterMontag)
  const [tab, setTab] = useState<'posts' | 'profil'>('posts')
  const [profilOpen, setProfilOpen] = useState(!initialBetrieb)

  const gemeindeName = (profile as { gemeinden?: { name: string } | null }).gemeinden?.name ?? ''

  function handlePostCreated(post: Post) {
    setPosts(prev => [post, ...prev])
    if (betrieb?.plan === 'standard') {
      const nextMonday = new Date()
      const day = nextMonday.getDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      nextMonday.setDate(nextMonday.getDate() + diffToMonday + 7)
      nextMonday.setHours(0, 0, 0, 0)
      setNaechsterMontag(nextMonday.toISOString())
    }
  }

  return (
    <div>
      <PageHeader gemeindeName={gemeindeName} title="Mein Gewerbe" />

      <div className="p-4 space-y-4 pt-4">
        {/* Kein Betrieb angelegt */}
        {!betrieb && (
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-black text-gray-900 text-sm uppercase tracking-wide">Profil anlegen</p>
                <p className="text-xs text-gray-500">Ihr Betrieb ist noch nicht eingerichtet</p>
              </div>
            </div>
            <GewerbeProfilForm
              betrieb={{
                id: '', gemeinde_id: profile.gemeinde_id ?? '', profile_id: profile.id,
                name: '', typ: 'gewerbe', beschreibung: null, logo_url: null, website: null,
                verified: false, branche_id: null, adresse: null, oeffnungszeiten: null, plan: 'standard',
                created_at: new Date().toISOString(),
              }}
              branchen={branchen}
              onUpdated={updated => setBetrieb(updated)}
            />
          </Card>
        )}

        {betrieb && (
          <>
            {/* Abonnenten */}
            {abonnentenStats && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-gray-400" />
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Abonnenten</p>
                </div>
                <AbonnentenStats {...abonnentenStats} />
              </div>
            )}

            {/* Tab-Navigation */}
            <div className="flex gap-2">
              <TabButton active={tab === 'posts'} icon={<PenLine className="w-3.5 h-3.5" />} onClick={() => setTab('posts')}>
                Beiträge
              </TabButton>
              <TabButton active={tab === 'profil'} icon={<Building2 className="w-3.5 h-3.5" />} onClick={() => setTab('profil')}>
                Profil
              </TabButton>
            </div>

            {/* Posts Tab */}
            {tab === 'posts' && (
              <div className="space-y-4">
                <Card>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">
                    Neuer Beitrag
                  </p>
                  <GewerbePostForm
                    gewerbeId={betrieb.id}
                    naechsterMontag={naechsterMontag}
                    onCreated={handlePostCreated}
                  />
                </Card>

                {posts.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      Ihre Beiträge
                    </p>
                    {posts.map(post => (
                      <Card key={post.id} padding="none">
                        {post.bild_url && (
                          <img src={post.bild_url} alt={post.titel} className="w-full h-36 object-cover" />
                        )}
                        <div className="p-4">
                          <p className="text-sm text-gray-700 leading-relaxed">{post.inhalt}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de })}
                          </p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Profil Tab */}
            {tab === 'profil' && (
              <Card>
                <button
                  onClick={() => setProfilOpen(o => !o)}
                  className="w-full flex items-center justify-between mb-4"
                >
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    Profil bearbeiten
                  </p>
                  {profilOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </button>
                {profilOpen && (
                  <GewerbeProfilForm betrieb={betrieb} branchen={branchen} onUpdated={setBetrieb} />
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, icon, onClick, children }: {
  active: boolean
  icon: React.ReactNode
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${
        active ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 shadow-[0_2px_8px_rgba(15,45,107,0.08)]'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
