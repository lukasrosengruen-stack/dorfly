'use client'

import { useState } from 'react'
import { Plus, AlertTriangle, User } from 'lucide-react'
import Link from 'next/link'
import { Mangel, Profile } from '@/types/database'
import { MangelKarte, MangelMeldenForm } from '@/features/maengel'
import { EmptyState } from '@/components/ui'

interface Props {
  maengel: Mangel[]
  profile: Profile | null
}

export default function MaengelClient({ maengel: initialMaengel, profile }: Props) {
  const [maengel, setMaengel] = useState(initialMaengel)
  const [showForm, setShowForm] = useState(false)

  const eigeneMaengel = maengel.filter(m => m.melder_id === profile?.id)

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mängelmelder</h1>
            <p className="text-sm text-gray-500">Schäden und Probleme melden</p>
          </div>
          <Link
            href="/profil"
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
          >
            <User className="w-4 h-4 text-gray-500" />
          </Link>
        </div>
      </div>

      {/* FAB – Neuer Mangel */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-24 right-4 bg-primary-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-20 hover:bg-primary-600 transition-colors"
          aria-label="Schaden melden"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Melden-Formular */}
      {showForm && profile && (
        <MangelMeldenForm
          profile={profile}
          onClose={() => setShowForm(false)}
          onSuccess={neuerMangel => {
            setMaengel(prev => [neuerMangel, ...prev])
            setShowForm(false)
          }}
        />
      )}

      {/* Liste */}
      <div className="p-4 space-y-3">
        {eigeneMaengel.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Noch keine Meldungen"
            description="Tippe auf + um einen Schaden zu melden."
          />
        ) : (
          eigeneMaengel.map(m => (
            <MangelKarte key={m.id} mangel={m} />
          ))
        )}
      </div>
    </div>
  )
}
