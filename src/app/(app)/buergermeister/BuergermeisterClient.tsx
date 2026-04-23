'use client'

import { useState } from 'react'
import { Frage, FrageStatus, Profile } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Send, Lock, Globe, ChevronDown, ChevronUp, Loader2, CheckCircle2, Clock, Archive } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

const STATUS_META: Record<FrageStatus, { label: string; color: string; icon: React.ElementType }> = {
  offen:        { label: 'Offen',        color: 'text-blue-600 bg-blue-50',   icon: Clock },
  beantwortet:  { label: 'Beantwortet', color: 'text-green-600 bg-green-50', icon: CheckCircle2 },
  archiviert:   { label: 'Archiviert',  color: 'text-gray-500 bg-gray-100',  icon: Archive },
}

interface Props {
  fragen: Frage[]
  profile: Profile | null
}

export default function BuergermeisterClient({ fragen: initialFragen, profile }: Props) {
  const [fragen, setFragen] = useState(initialFragen)
  const [showForm, setShowForm] = useState(false)
  const [frageText, setFrageText] = useState('')
  const [oeffentlich, setOeffentlich] = useState(true)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'alle' | 'meine'>('alle')
  const supabase = createClient()

  const canAnswer = profile?.role === 'verwaltung' || profile?.role === 'super_admin'

  async function submitFrage() {
    if (!frageText.trim() || !profile?.gemeinde_id) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('fragen')
        .insert({
          gemeinde_id: profile.gemeinde_id!,
          fragesteller_id: profile.id,
          frage: frageText.trim(),
          oeffentlich,
          status: 'offen',
        })
        .select('*, profiles(display_name, avatar_url)')
        .single()

      if (error) throw error
      setFragen([data, ...fragen])
      setFrageText('')
      setShowForm(false)
    } catch (e) {
      console.error(e)
      alert('Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const visibleFragen = fragen.filter(f => {
    if (activeTab === 'meine') return f.fragesteller_id === profile?.id
    return true
  })

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">Frag den Bürgermeister</h1>
        <p className="text-sm text-gray-500">Stelle deine Fragen direkt an die Verwaltung</p>

        <div className="flex gap-2 mt-3">
          {(['alle', 'meine'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeTab === tab ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
              )}
            >
              {tab === 'alle' ? 'Alle Fragen' : 'Meine Fragen'}
            </button>
          ))}
        </div>
      </div>

      {/* Frage stellen */}
      <div className="p-4">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-primary-50 border-2 border-primary-200 border-dashed rounded-2xl p-4 text-primary-500 font-medium flex items-center justify-center gap-2 hover:bg-primary-100 transition-colors"
          >
            <Send className="w-4 h-4" />
            Neue Frage stellen
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Deine Frage</h3>
            <textarea
              placeholder="Was möchtest du wissen?"
              value={frageText}
              onChange={e => setFrageText(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            {/* Sichtbarkeit */}
            <div className="flex gap-2">
              <button
                onClick={() => setOeffentlich(true)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors',
                  oeffentlich ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500'
                )}
              >
                <Globe className="w-4 h-4" />
                Öffentlich
              </button>
              <button
                onClick={() => setOeffentlich(false)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors',
                  !oeffentlich ? 'border-primary-500 bg-primary-50 text-primary-600' : 'border-gray-200 text-gray-500'
                )}
              >
                <Lock className="w-4 h-4" />
                Privat
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setFrageText('') }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={submitFrage}
                disabled={loading || !frageText.trim()}
                className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Absenden
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fragen-Liste */}
      <div className="px-4 pb-4 space-y-3">
        {visibleFragen.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p>Noch keine Fragen</p>
          </div>
        )}

        {visibleFragen.map(f => {
          const meta = STATUS_META[f.status]
          const StatusIcon = meta.icon
          const expanded = expandedId === f.id

          return (
            <div key={f.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : f.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full', meta.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {!f.oeffentlich && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Lock className="w-3 h-3" /> Privat
                        </span>
                      )}
                    </div>
                    <p className={clsx('text-gray-900 font-medium text-sm', !expanded && 'line-clamp-2')}>
                      {f.frage}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {f.profiles?.display_name ?? 'Bürger'} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: de })}
                    </p>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
                </div>
              </button>

              {expanded && f.antwort && (
                <div className="px-4 pb-4">
                  <div className="bg-primary-50 rounded-xl p-3 border border-primary-100">
                    <p className="text-xs font-semibold text-primary-600 mb-1">Antwort der Verwaltung</p>
                    <p className="text-sm text-gray-700">{f.antwort}</p>
                    {f.beantwortet_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(f.beantwortet_at), { addSuffix: true, locale: de })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {expanded && !f.antwort && canAnswer && (
                <AnswerForm frageId={f.id} onAnswer={(antwort) => {
                  setFragen(prev => prev.map(q => q.id === f.id ? { ...q, antwort, status: 'beantwortet', beantwortet_at: new Date().toISOString() } : q))
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnswerForm({ frageId, onAnswer }: { frageId: string; onAnswer: (a: string) => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function submit() {
    if (!text.trim()) return
    setLoading(true)
    const { error } = await supabase
      .from('fragen')
      .update({ antwort: text.trim(), status: 'beantwortet', beantwortet_at: new Date().toISOString() })
      .eq('id', frageId)
    setLoading(false)
    if (!error) onAnswer(text.trim())
  }

  return (
    <div className="px-4 pb-4 space-y-2">
      <textarea
        placeholder="Antwort der Verwaltung …"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <button
        onClick={submit}
        disabled={loading || !text.trim()}
        className="w-full bg-primary-500 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Antwort veröffentlichen
      </button>
    </div>
  )
}

