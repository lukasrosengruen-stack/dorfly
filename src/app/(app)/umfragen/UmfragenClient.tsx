'use client'

import { useState } from 'react'
import { Umfrage } from '@/types/umfrage'
import { Profile } from '@/types/database'
import { BarChart2 } from 'lucide-react'
import UmfrageCard from '@/components/umfrage/UmfrageCard'

interface UmfrageMitDaten {
  umfrage: Umfrage
  hatAbgestimmt: boolean
  teilnehmerAnzahl: number
}

interface Props {
  umfragen: UmfrageMitDaten[]
  profile: Profile | null
}

export default function UmfragenClient({ umfragen: initialUmfragen, profile }: Props) {
  const [umfragen, setUmfragen] = useState(initialUmfragen)

  return (
    <div>
      {/* Header */}
      <div className="bg-primary-500 px-4 pt-12 pb-5">
        <p className="text-primary-200 text-xs font-bold tracking-[0.2em] uppercase mb-1">Gemeinde Ehningen</p>
        <h1 className="text-white font-black text-2xl tracking-wide uppercase">Umfragen</h1>
        <p className="text-primary-200 text-sm mt-1">Ihre Meinung zählt</p>
      </div>

      {/* Inhalt */}
      <div className="p-4 space-y-4">
        {umfragen.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Noch keine Umfragen</p>
            </div>
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
