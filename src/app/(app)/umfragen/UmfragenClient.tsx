'use client'

import { useState } from 'react'
import { Umfrage } from '@/types/umfrage'
import { Profile } from '@/types/database'
import { BarChart2 } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui'
import UmfrageCard from '@/components/umfrage/UmfrageCard'

interface UmfrageMitDaten {
  umfrage: Umfrage
  hatAbgestimmt: boolean
  teilnehmerAnzahl: number
}

interface Props {
  umfragen: UmfrageMitDaten[]
  profile: Profile | null
  gemeindeName?: string
}

export default function UmfragenClient({ umfragen: initialUmfragen, profile, gemeindeName }: Props) {
  const [umfragen, setUmfragen] = useState(initialUmfragen)

  return (
    <div>
      <PageHeader
        gemeindeName={gemeindeName}
        title="Umfragen"
        subtitle="Ihre Meinung zählt"
      />

      {/* Inhalt */}
      <div className="p-4 space-y-4">
        {umfragen.length === 0 && (
          <EmptyState
            icon={BarChart2}
            title="Noch keine Umfragen"
            description="Sobald eine Umfrage gestartet wird, erscheint sie hier."
          />
        )}

        {umfragen.map(({ umfrage, hatAbgestimmt, teilnehmerAnzahl }) => (
          <UmfrageCard
            key={umfrage.id}
            umfrage={umfrage}
            hatAbgestimmt={hatAbgestimmt}
            teilnehmerAnzahl={teilnehmerAnzahl}
            profile={profile}
            onDelete={id => setUmfragen(prev => prev.filter(u => u.umfrage.id !== id))}
            onUpdate={updated => setUmfragen(prev => prev.map(u => u.umfrage.id === updated.id ? { ...u, umfrage: updated } : u))}
          />
        ))}
      </div>

    </div>
  )
}
