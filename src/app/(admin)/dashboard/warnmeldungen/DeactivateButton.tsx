// src/app/(admin)/dashboard/warnmeldungen/DeactivateButton.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeactivateButton({ postId }: { postId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDeactivate() {
    if (!confirm('Warnmeldung wirklich deaktivieren?')) return
    setLoading(true)
    await fetch('/api/warnmeldungen/deaktivieren', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleDeactivate}
      disabled={loading}
      className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
    >
      {loading ? '…' : 'Deaktivieren'}
    </button>
  )
}
