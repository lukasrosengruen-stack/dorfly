'use client'

import { useState } from 'react'
import { MessageSquare, X, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trapRef = useFocusTrap(open)

  function handleClose() {
    setOpen(false)
    if (sent) {
      setMessage('')
      setEmail('')
      setSent(false)
    }
    setError(null)
  }

  async function submit() {
    if (!message.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          email: email.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Feedback konnte nicht gesendet werden, bitte versuche es erneut.')
      }
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feedback konnte nicht gesendet werden, bitte versuche es erneut.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setSent(false); setError(null); setOpen(true) }}
        className="w-full text-left bg-[#7c3aed] rounded-[20px] p-4 flex items-center gap-4 shadow-[0_4px_14px_rgba(124,58,237,0.33)] transition-[transform,box-shadow] duration-100 ease-out active:scale-[0.96] active:shadow-none"
      >
        <div className="w-11 h-11 rounded-[14px] bg-white/14 flex items-center justify-center shrink-0">
          <MessageSquare className="w-[22px] h-[22px] text-white" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-white font-bold text-[14.5px]">Feedback</p>
          <p className="text-white/55 text-xs mt-0.5">Hilf uns, Dorfly zu verbessern</p>
        </div>
        <div className="w-[30px] h-[30px] rounded-[9px] bg-gold-500 flex items-center justify-center shrink-0">
          <svg width="15" height="15" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M4 11h14M13 5l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4"
          onClick={handleClose}
          onKeyDown={e => e.key === 'Escape' && handleClose()}
        >
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="bg-white w-full max-w-sm rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="feedback-dialog-title" className="font-bold text-gray-900">Feedback</h2>
              <button onClick={handleClose} aria-label="Dialog schließen" className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {sent ? (
              <div className="space-y-4">
                <p role="status" className="text-sm text-gray-700">Danke für dein Feedback! Wir schauen es uns an.</p>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-medium"
                >
                  Schließen
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Das ist die erste öffentliche Version von Dorfly. Wenn dir etwas auffällt oder etwas
                  unklar ist, kannst du hier Feedback geben. So hilfst du dabei, Dorfly kontinuierlich
                  zu verbessern.
                </p>

                <div>
                  <label htmlFor="feedback-message" className="text-sm font-medium text-gray-700 mb-1 block">
                    Dein Feedback
                  </label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Was ist dir aufgefallen?"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="feedback-email" className="text-sm font-medium text-gray-700 mb-1 block">
                    Deine E-Mail <span className="font-normal text-gray-500">(falls wir antworten sollen, optional)</span>
                  </label>
                  <input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-red-600">{error}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-600"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={submit}
                    disabled={!message.trim() || loading}
                    className={clsx(
                      'flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2',
                      'bg-primary-500 text-white disabled:opacity-50',
                    )}
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    Senden
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}