'use client'

import { useState } from 'react'
import { MessageCircleQuestion, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Frage {
  id: string
  frage: string
  status: string
  created_at: string
  antwort?: string | null
}

export default function BuergerfrageSection({ fragen: initialFragen }: { fragen: Frage[] }) {
  const [fragen, setFragen] = useState(initialFragen)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [antworten, setAntworten] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()

  async function antworten_absenden(frageId: string) {
    const text = antworten[frageId]?.trim()
    if (!text) return
    setLoading(frageId)
    try {
      const { error } = await supabase.from('fragen').update({
        antwort: text, status: 'beantwortet', beantwortet_at: new Date().toISOString()
      }).eq('id', frageId)
      if (error) throw error
      setFragen(prev => prev.map(f => f.id === frageId ? { ...f, antwort: text, status: 'beantwortet' } : f))
      setExpandedId(null)
    } catch {
      alert('Fehler beim Speichern')
    } finally {
      setLoading(null)
    }
  }

  const offene = fragen.filter(f => f.status === 'offen')
  const beantwortet = fragen.filter(f => f.status !== 'offen')

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4 text-blue-500" />
          Bürgerfragen
        </h2>
        <Link href="/buergermeister" className="text-sm text-primary-500 font-medium">Alle →</Link>
      </div>
      <div className="divide-y divide-gray-50">
        {offene.length === 0 && (
          <div className="px-5 py-6 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary-400" /> Alle Fragen beantwortet
          </div>
        )}
        {[...offene, ...beantwortet].slice(0, 8).map(f => {
          const expanded = expandedId === f.id
          return (
            <div key={f.id}>
              <button onClick={() => setExpandedId(expanded ? null : f.id)}
                className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{f.frage}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    f.status === 'offen' ? 'bg-blue-50 text-blue-600' : 'bg-primary-50 text-primary-500'
                  }`}>
                    {f.status === 'offen' ? 'Offen' : 'Beantwortet'}
                  </span>
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
              {expanded && (
                <div className="px-5 pb-4 space-y-2 bg-gray-50">
                  <p className="text-sm text-gray-700 pt-2">{f.frage}</p>
                  {f.antwort ? (
                    <div className="bg-primary-50 rounded-xl p-3 border border-primary-100">
                      <p className="text-xs font-semibold text-primary-600 mb-1">Ihre Antwort</p>
                      <p className="text-sm text-gray-700">{f.antwort}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        placeholder="Antwort eingeben..."
                        value={antworten[f.id] ?? ''}
                        onChange={e => setAntworten(prev => ({ ...prev, [f.id]: e.target.value }))}
                        rows={3}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button onClick={() => antworten_absenden(f.id)}
                        disabled={loading === f.id || !antworten[f.id]?.trim()}
                        className="bg-primary-500 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-2">
                        {loading === f.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Antwort veröffentlichen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
