'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import UmfrageErstellen from '@/components/umfrage/UmfrageErstellen'

export default function UmfrageErstellenButton({ gemeindeId }: { gemeindeId: string }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <button onClick={() => setShowForm(true)}
        className="flex items-center gap-2 bg-primary-500 text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary-600 transition-colors">
        <Plus className="w-4 h-4" /> Neue Umfrage
      </button>
      {showForm && (
        <UmfrageErstellen
          gemeindeId={gemeindeId}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); window.location.reload() }}
        />
      )}
    </>
  )
}
