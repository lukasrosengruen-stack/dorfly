// src/app/(admin)/dashboard/warnmeldungen/DeactivateButton.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeactivateButton({ postId }: { postId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDeactivate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/warnmeldungen/deaktivieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Fehler beim Deaktivieren')
        setConfirming(false)
        return
      }
      router.refresh()
    } catch {
      setError('Netzwerkfehler')
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (error) {
    return (
      <span role="alert" className="text-xs text-red-600 shrink-0">
        {error}
      </span>
    )
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-gray-600">Wirklich deaktivieren?</span>
        <button
          onClick={handleDeactivate}
          disabled={loading}
          aria-busy={loading}
          className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {loading ? 'Wird deaktiviert…' : 'Ja'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Nein
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      aria-label="Warnmeldung deaktivieren"
      className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0"
    >
      Deaktivieren
    </button>
  )
}
