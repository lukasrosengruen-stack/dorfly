'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Link from 'next/link'

type Status = 'offen' | 'in_bearbeitung' | 'erledigt'

interface Mangel {
  id: string
  titel: string
  status: Status
  created_at: string
  profiles?: { display_name: string | null } | null
}

export default function MaengelSection({ maengel: initialMaengel, offeneMaengel, inBearbeitung, erledigteMaengel }: {
  maengel: Mangel[]
  offeneMaengel: number
  inBearbeitung: number
  erledigteMaengel: number
}) {
  const [maengel, setMaengel] = useState(initialMaengel)
  const [updating, setUpdating] = useState<string | null>(null)

  async function updateStatus(id: string, status: Status) {
    setUpdating(id)
    try {
      const res = await fetch('/api/maengel/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maengelId: id, status }),
      })
      if (!res.ok) throw new Error()
      setMaengel(prev => prev.map(m => m.id === id ? { ...m, status } : m))
    } catch {
      alert('Fehler beim Aktualisieren')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Meldungen
        </h2>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{offeneMaengel} offen</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{inBearbeitung} in Bearb.</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-400 inline-block" />{erledigteMaengel} erledigt</span>
          <Link href="/maengel" className="text-primary-500 font-medium ml-1">Alle →</Link>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50 text-xs text-gray-400">
            <th className="text-left px-5 py-2.5 font-medium">Titel</th>
            <th className="text-left px-3 py-2.5 font-medium">Melder</th>
            <th className="text-left px-3 py-2.5 font-medium">Status ändern</th>
            <th className="text-right px-5 py-2.5 font-medium">Datum</th>
          </tr>
        </thead>
        <tbody>
          {maengel.slice(0, 10).map(m => (
            <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="px-5 py-3 text-gray-800 max-w-[180px] truncate">{m.titel}</td>
              <td className="px-3 py-3 text-gray-500 text-xs">
                {(m.profiles as { display_name: string | null } | null)?.display_name ?? '–'}
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  {(['offen', 'in_bearbeitung', 'erledigt'] as Status[]).map(s => (
                    <button key={s}
                      onClick={() => m.status !== s && updateStatus(m.id, s)}
                      disabled={updating === m.id || m.status === s}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                        m.status === s
                          ? s === 'offen' ? 'bg-red-100 text-red-600' : s === 'in_bearbeitung' ? 'bg-amber-100 text-amber-600' : 'bg-primary-100 text-primary-600'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}>
                      {updating === m.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null}
                      {s === 'offen' ? 'Offen' : s === 'in_bearbeitung' ? 'In Bearb.' : 'Erledigt'}
                    </button>
                  ))}
                </div>
              </td>
              <td className="px-5 py-3 text-gray-400 text-xs text-right whitespace-nowrap">
                {new Date(m.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </td>
            </tr>
          ))}
          {maengel.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-6 text-center text-gray-400 text-sm">Keine Meldungen</td></tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
