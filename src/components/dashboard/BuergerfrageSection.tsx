'use client'


import { toast } from 'sonner'
import { useState } from 'react'
import { MessageCircleQuestion, ChevronDown, ChevronUp, Loader2, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { RichTextEditor, renderRichText } from '@/lib/richText'
import AeltereSuche from '@/components/dashboard/AeltereSuche'

interface Frage {
  id: string
  frage: string
  status: string
  created_at: string
  antwort?: string | null
  profiles?: { display_name: string | null } | null
}

export default function BuergerfrageSection({ fragen: initialFragen, gesamt, offeneVerborgen }: {
  fragen: Frage[]
  gesamt: number
  offeneVerborgen: number
}) {
  const [fragen, setFragen] = useState(initialFragen)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [antworten, setAntworten] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function antwort_speichern(frageId: string) {
    const text = antworten[frageId]?.trim()
    if (!text) return
    setLoading(frageId)
    try {
      const res = await fetch('/api/fragen/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: frageId, antwort: text }),
      })
      if (!res.ok) throw new Error()
      setFragen(prev => prev.map(f => f.id === frageId ? { ...f, antwort: text, status: 'beantwortet' } : f))
      setEditingId(null)
      setExpandedId(null)
    } catch { toast.error('Fehler beim Speichern') }
    finally { setLoading(null) }
  }

  async function frage_loeschen(id: string) {
    if (!confirm('Frage wirklich löschen?')) return
    setDeleting(id)
    try {
      const res = await fetch('/api/fragen/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      setFragen(prev => prev.filter(f => f.id !== id))
    } catch { toast.error('Fehler beim Löschen') }
    finally { setDeleting(null) }
  }

  const offene = fragen.filter(f => f.status === 'offen')
  const beantwortet = fragen.filter(f => f.status !== 'offen')

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4 text-blue-500" />
          Bürgerfragen
          <span className="text-xs text-gray-500 font-normal">
            {fragen.length} von {gesamt}
          </span>
        </h2>
        <Link href="/buergermeister" className="text-sm text-primary-500 font-medium">Alle →</Link>
      </div>
      <div className="divide-y divide-gray-50">
        {fragen.length === 0 && (
          <div className="px-5 py-6 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary-400" /> Keine Fragen vorhanden
          </div>
        )}
        {offene.length === 0 && beantwortet.length > 0 && (
          <div className="px-5 py-3 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary-400" /> Alle Fragen beantwortet
          </div>
        )}
        {[...offene, ...beantwortet].map(f => {
          const expanded = expandedId === f.id
          const isEditing = editingId === f.id
          return (
            <div key={f.id}>
              <div className="px-5 py-3 flex items-center gap-3">
                <button onClick={() => setExpandedId(expanded ? null : f.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{f.frage}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    f.status === 'offen' ? 'bg-blue-50 text-blue-600' : 'bg-primary-50 text-primary-500'
                  }`}>
                    {f.status === 'offen' ? 'Offen' : 'Beantwortet'}
                  </span>
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>
                <button onClick={() => { setEditingId(f.id); setAntworten(prev => ({ ...prev, [f.id]: f.antwort ?? '' })); setExpandedId(f.id) }}
                  className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors shrink-0">
                  <Pencil className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <button onClick={() => frage_loeschen(f.id)} disabled={deleting === f.id}
                  className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 transition-colors shrink-0 disabled:opacity-50">
                  {deleting === f.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                    : <Trash2 className="w-3.5 h-3.5 text-gray-500" />}
                </button>
              </div>

              {expanded && (
                <div className="px-5 pb-4 space-y-2 bg-gray-50">
                  {f.profiles?.display_name && (
                    <p className="text-xs text-gray-400 pt-2">Von: <span className="font-medium text-gray-600">{f.profiles.display_name}</span></p>
                  )}
                  <p className="text-sm text-gray-700 pt-1 italic">„{f.frage}"</p>
                  {f.antwort && !isEditing ? (
                    <div className="bg-primary-50 rounded-xl p-3 border border-primary-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-primary-600">Ihre Antwort</p>
                        <button onClick={() => { setEditingId(f.id); setAntworten(prev => ({ ...prev, [f.id]: f.antwort ?? '' })) }}
                          className="p-1 rounded-lg hover:bg-primary-100 transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-primary-500" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-700">{f.antwort && renderRichText(f.antwort)}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <RichTextEditor
                        value={antworten[f.id] ?? ''}
                        onChange={val => setAntworten(prev => ({ ...prev, [f.id]: val }))}
                        placeholder="Antwort eingeben..."
                        rows={3}
                        compact
                      />
                      <div className="flex gap-2">
                        <button onClick={() => antwort_speichern(f.id)}
                          disabled={loading === f.id || !antworten[f.id]?.trim()}
                          className="bg-primary-500 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50 flex items-center gap-2">
                          {loading === f.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {isEditing ? 'Änderung speichern' : 'Antwort veröffentlichen'}
                        </button>
                        {isEditing && (
                          <button onClick={() => setEditingId(null)}
                            className="text-sm text-gray-500 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50">
                            Abbrechen
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Die "offene"-Abfrage in page.tsx ist auf 50 Zeilen gedeckelt. Bei mehr
          gleichzeitig offenen Fragen faellt sonst kommentarlos ein Teil aus
          der Liste — dieser Hinweis macht das sichtbar statt es
          stillschweigend zu verschlucken. */}
      {offeneVerborgen > 0 && (
        <p className="px-5 py-2 text-xs text-gray-500 border-b border-gray-100">
          {offeneVerborgen} weitere offene Fragen — bitte über die Suche aufrufen
        </p>
      )}

      <AeltereSuche<{ id: string; frage: string; created_at: string }>
        typ="fragen"
        label="Ältere Fragen durchsuchen"
      >
        {treffer => (
          <ul className="divide-y divide-gray-50">
            {treffer.map(f => (
              <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-800 truncate">{f.frage}</span>
                <span className="text-xs text-gray-500 shrink-0">
                  {new Date(f.created_at).toLocaleDateString('de-DE')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AeltereSuche>
    </section>
  )
}
