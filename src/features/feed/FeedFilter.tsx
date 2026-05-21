'use client'

/**
 * FeedFilter – Bottom-Sheet-Filter für den Newsfeed
 *
 * Zustandsfrei: alle Werte kommen per Props, Änderungen werden via Callbacks gemeldet.
 */
import { X, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface FeedFilterProps {
  open: boolean
  onClose: () => void
  selectedSenders: Set<string>
  selectedDays: number | null
  onToggleSender: (sender: string) => void
  onSetDays: (days: number | null) => void
  hasVerwaltungPosts: boolean
  vereinNames: string[]
  nurLokaleAngebote: boolean
  onToggleLokaleAngebote: () => void
  hatGewerbeAbonnements: boolean
}

export function FeedFilter({
  open,
  onClose,
  selectedSenders,
  selectedDays,
  onToggleSender,
  onSetDays,
  hasVerwaltungPosts,
  vereinNames,
  nurLokaleAngebote,
  onToggleLokaleAngebote,
  hatGewerbeAbonnements,
}: FeedFilterProps) {
  const trapRef = useFocusTrap(open)

  if (!open) return null

  const activeFilterCount = selectedSenders.size + (selectedDays ? 1 : 0) + (nurLokaleAngebote ? 1 : 0)

  function reset() {
    Array.from(selectedSenders).forEach(s => onToggleSender(s))
    onSetDays(null)
    if (nurLokaleAngebote) onToggleLokaleAngebote()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedfilter-title"
        onKeyDown={onKeyDown}
        className="bg-white w-full max-w-lg rounded-t-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h2 id="feedfilter-title" className="font-black text-gray-900 uppercase tracking-wide text-sm">Feed filtern</h2>
          <div className="flex items-center gap-3">
            {activeFilterCount > 0 && (
              <button onClick={reset} className="text-xs text-primary-500 font-bold">
                Zurücksetzen
              </button>
            )}
            <button onClick={onClose} aria-label="Filter schließen">
              <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6 pb-8">
          {/* Zeitraum */}
          <div>
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Zeitraum</p>
            <div className="flex gap-2">
              {[7, 14, 30].map(days => (
                <button
                  key={days}
                  onClick={() => onSetDays(selectedDays === days ? null : days)}
                  className={clsx(
                    'flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors',
                    selectedDays === days
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'border-gray-200 text-gray-600',
                  )}
                >
                  {days} Tage
                </button>
              ))}
            </div>
          </div>

            {/* Lokale Angebote */}
          {hatGewerbeAbonnements && (
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Lokale Angebote</p>
              <button
                onClick={onToggleLokaleAngebote}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600">
                    G
                  </div>
                  <span className="font-bold text-gray-900 text-sm">Nur abonnierte Betriebe</span>
                </div>
                <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0', nurLokaleAngebote ? 'bg-orange-500' : 'bg-gray-100')}>
                  {nurLokaleAngebote && <Check className="w-3.5 h-3.5 text-white" />}
                </span>
              </button>
            </div>
          )}

          {/* Absender */}
          {(hasVerwaltungPosts || vereinNames.length > 0) && (
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Absender</p>
              <div className="space-y-2">
                {hasVerwaltungPosts && (
                  <SenderRow
                    label="Verwaltung"
                    initial="V"
                    color="bg-primary-100 text-primary-700"
                    selected={selectedSenders.has('__verwaltung__')}
                    onToggle={() => onToggleSender('__verwaltung__')}
                  />
                )}
                {vereinNames.map(name => (
                  <SenderRow
                    key={name}
                    label={name}
                    initial={name[0]?.toUpperCase() ?? '?'}
                    color="bg-violet-100 text-violet-700"
                    selected={selectedSenders.has(name)}
                    onToggle={() => onToggleSender(name)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Hilfkomponente ──────────────────────────────────────────────────────────

function SenderRow({
  label,
  initial,
  color,
  selected,
  onToggle,
}: {
  label: string
  initial: string
  color: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-200 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-xs font-black', color)}>
          {initial}
        </div>
        <span className="font-bold text-gray-900 text-sm">{label}</span>
      </div>
      <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0', selected ? 'bg-primary-500' : 'bg-gray-100')}>
        {selected && <Check className="w-3.5 h-3.5 text-white" />}
      </span>
    </button>
  )
}
