'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function PasswortZuruecksetzenPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    // Session wurde bereits durch /auth/callback serverseitig gesetzt
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        // Fallback: auf PASSWORD_RECOVERY Event warten
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
        })
        // Nach 3s ohne Session: Fehler zeigen
        const timeout = setTimeout(() => setError('Link ungültig oder abgelaufen. Bitte neuen Reset anfordern.'), 3000)
        return () => { subscription.unsubscribe(); clearTimeout(timeout) }
      }
    })
  }, [])

  async function submit() {
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return }
    if (password.length < 6) { setError('Passwort muss mindestens 6 Zeichen lang sein'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 mb-4">
            <MessageSquare className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Neues Passwort</h1>
          <p className="text-gray-500 text-sm mt-1">Wähle ein neues Passwort für dein Konto</p>
        </div>

        {done ? (
          <div className="text-center text-primary-600 font-medium">
            Passwort erfolgreich geändert. Du wirst weitergeleitet…
          </div>
        ) : error && !ready ? (
          <div className="text-center space-y-4">
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={() => router.push('/login')} className="text-primary-500 text-sm font-medium">
              Zurück zur Anmeldung
            </button>
          </div>
        ) : !ready ? (
          <div className="flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Neues Passwort"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Passwort bestätigen"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={submit}
              disabled={loading || !password || !confirm}
              className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              Passwort speichern
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
