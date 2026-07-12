'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Globe, MapPin, Clock, Users, Building2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button, Card } from '@/components/ui'
import type { OrganisationMitBranche, Post } from '@/types/database'

interface Props {
  betrieb: OrganisationMitBranche
  posts: Post[]
  istAbonniert: boolean
  abonnentenAnzahl: number
  istEigentümer: boolean
}

export default function GewerbeProfil({ betrieb, posts, istAbonniert: initialAbonniert, abonnentenAnzahl: initialAnzahl }: Props) {
  const brancheName = betrieb.gewerbe_branchen?.name
  const router = useRouter()
  const [abonniert, setAbonniert] = useState(initialAbonniert)
  const [anzahl, setAnzahl] = useState(initialAnzahl)
  const [loading, setLoading] = useState(false)

  async function toggleAbonnement() {
    setLoading(true)
    try {
      const res = await fetch('/api/gewerbe/abonnieren', {
        method: abonniert ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gewerbeId: betrieb.id }),
      })
      if (!res.ok) throw new Error()
      setAbonniert(a => !a)
      setAnzahl(n => abonniert ? n - 1 : n + 1)
      toast.success(abonniert ? 'Abonnement gekündigt' : 'Abonniert')
    } catch {
      toast.error('Fehler beim Aktualisieren')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-primary-500 text-white">
        <div className="px-4 pt-12 pb-6">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-white/70 text-xs font-bold mb-4">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </button>

          <div className="flex items-center gap-4">
            {betrieb.logo_url ? (
              <img src={betrieb.logo_url} alt={betrieb.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <h1 className="font-black text-xl uppercase tracking-wide leading-tight">{betrieb.name}</h1>
              {brancheName && (
                <p className="text-white/70 text-sm mt-0.5">{brancheName}</p>
              )}
              <div className="flex items-center gap-1 mt-1">
                <Users className="w-3 h-3 text-white/60" />
                <span className="text-xs text-white/70 font-semibold">{anzahl} Abonnenten</span>
              </div>
            </div>
          </div>

          <Button
            onClick={toggleAbonnement}
            loading={loading}
            variant={abonniert ? 'secondary' : 'primary'}
            fullWidth
            className={`mt-4 ${abonniert ? 'bg-white text-primary-600 border-white' : 'bg-orange-500 border-orange-500 hover:bg-orange-600'}`}
          >
            {abonniert ? 'Abonniert ✓' : 'Abonnieren'}
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Infos */}
        <Card>
          {betrieb.beschreibung && (
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{betrieb.beschreibung}</p>
          )}
          <div className="space-y-3">
            {betrieb.adresse && (
              <InfoRow icon={<MapPin className="w-4 h-4 text-orange-500 shrink-0" />}>
                {betrieb.adresse}
              </InfoRow>
            )}
            {betrieb.oeffnungszeiten && (
              <InfoRow icon={<Clock className="w-4 h-4 text-orange-500 shrink-0" />}>
                <span className="whitespace-pre-line">{betrieb.oeffnungszeiten}</span>
              </InfoRow>
            )}
            {betrieb.website && (
              <InfoRow icon={<Globe className="w-4 h-4 text-orange-500 shrink-0" />}>
                <a href={betrieb.website} target="_blank" rel="noopener noreferrer" className="text-primary-500 font-semibold underline">
                  {betrieb.website.replace(/^https?:\/\//, '')}
                </a>
              </InfoRow>
            )}
          </div>
        </Card>

        {/* Posts */}
        {posts.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Letzte Beiträge</p>
            {posts.map(post => (
              <Card key={post.id} padding="none">
                {post.bild_url && (
                  <img src={post.bild_url} alt={post.titel} className="w-full h-48 object-cover" />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Angebot
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {post.published_at ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: de }) : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{post.inhalt}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {posts.length === 0 && (
          <Card>
            <p className="text-sm text-gray-400 text-center py-4">Noch keine Beiträge vorhanden.</p>
          </Card>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {icon}
      <span className="text-sm text-gray-700">{children}</span>
    </div>
  )
}
