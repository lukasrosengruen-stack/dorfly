'use client'

import { useState } from 'react'
import { Umfrage } from '@/types/umfrage'
import { Profile } from '@/types/database'
import { Plus, BarChart2 } from 'lucide-react'
import UmfrageCard from '@/components/umfrage/UmfrageCard'
import UmfrageErstellen from '@/components/umfrage/UmfrageErstellen'
import Link from 'next/link'

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
  const [showForm, setShowForm] = useState(false)

  const isVerwaltung = profile?.role === 'verwaltung' || profile?.role === 'super_admin'

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
            {isVerwaltung && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 bg-primary-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
              >
                Erste Umfrage erstellen
              </button>
            )}
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

      {/* FAB für Verwaltung */}
      {isVerwaltung && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-24 right-4 bg-primary-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-primary-600 transition-colors z-20"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Verwaltung Dashboard-Link */}
      {isVerwaltung && (
        <div className="px-4 pb-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-3 border-2 border-primary-500 text-primary-500 font-bold rounded-xl text-sm uppercase tracking-wide"
          >
            <BarChart2 className="w-4 h-4" />
            Ergebnisse im Dashboard
          </Link>
        </div>
      )}

      {showForm && profile?.gemeinde_id && (
        <UmfrageErstellen
          gemeindeId={profile.gemeinde_id}
          onClose={() => setShowForm(false)}
          onCreated={neu => {
            setUmfragen(prev => [{ umfrage: neu, hatAbgestimmt: false, teilnehmerAnzahl: 0 }, ...prev])
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}
