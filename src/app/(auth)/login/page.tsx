'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, ArrowRight, Loader2, ChevronDown } from 'lucide-react'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [adresse, setAdresse] = useState('')
  const [geburtsdatum, setGeburtsdatum] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function submit() {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        if (data.user) {
          await fetch('/api/auth/registrieren', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id, vorname, nachname, adresse, geburtsdatum }),
          })
        }
      }
      router.push('/feed')
      router.refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      if (msg.includes('Invalid login')) setError('E-Mail oder Passwort falsch')
      else if (msg.includes('already registered')) setError('E-Mail bereits registriert')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 mb-4">
            <MessageSquare className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Dorfly</h1>
          <p className="text-gray-500 text-sm mt-1">Die digitale Heimat deiner Gemeinde</p>
        </div>

        {/* Tab */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setShowOptional(false) }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {m === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-Mail-Adresse"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Passwort"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            onKeyDown={e => e.key === 'Enter' && submit()}
          />

          {/* Optionale Felder nur bei Registrierung */}
          {mode === 'register' && (
            <div>
              <button
                type="button"
                onClick={() => setShowOptional(v => !v)}
                className="flex items-center gap-2 text-sm text-primary-500 font-medium py-1"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-180' : ''}`} />
                Weitere Angaben (optional)
              </button>

              {showOptional && (
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={vorname}
                      onChange={e => setVorname(e.target.value)}
                      placeholder="Vorname"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      value={nachname}
                      onChange={e => setNachname(e.target.value)}
                      placeholder="Nachname"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <input
                    type="text"
                    value={adresse}
                    onChange={e => setAdresse(e.target.value)}
                    placeholder="Adresse"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div>
                    <label className="text-xs text-gray-400 ml-1">Geburtsdatum</label>
                    <input
                      type="date"
                      value={geburtsdatum}
                      onChange={e => setGeburtsdatum(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={submit}
            disabled={loading || !email || !password}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            {mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
          </button>
        </div>
      </div>
    </div>
  )
}

