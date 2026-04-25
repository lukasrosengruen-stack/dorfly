'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, ArrowRight, Loader2, ChevronDown, Mail } from 'lucide-react'

type Mode = 'login' | 'register' | 'forgot'

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
  const [registered, setRegistered] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const supabase = createClient()

  async function sendReset() {
    if (!email) { setError('Bitte E-Mail eingeben'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/passwort-zuruecksetzen`,
    })
    setLoading(false)
    if (error) setError(error.message)
    else setResetSent(true)
  }

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
        setRegistered(true)
        return
      }
      router.push('/home')
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

  if (registered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-primary-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 mb-4">
            <Mail className="text-white w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Fast geschafft!</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Wir haben dir eine Bestätigungs-E-Mail geschickt.<br />
            Bitte öffne die Mail und klicke auf den Link, um dein Konto zu aktivieren.
          </p>
          <button
            onClick={() => setRegistered(false)}
            className="text-primary-500 text-sm font-medium"
          >
            Zurück zur Anmeldung
          </button>
        </div>
      </div>
    )
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

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError('') }}
              className="w-full text-center text-sm text-gray-400 hover:text-primary-500 transition-colors pt-1"
            >
              Passwort vergessen?
            </button>
          )}
        </div>

        {/* Passwort vergessen */}
        {mode === 'forgot' && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            {resetSent ? (
              <div className="text-center">
                <p className="text-primary-600 font-medium text-sm">E-Mail gesendet!</p>
                <p className="text-gray-400 text-xs mt-1">Prüfe dein Postfach und klicke den Link.</p>
                <button onClick={() => { setMode('login'); setResetSent(false) }}
                  className="mt-3 text-sm text-primary-500 font-medium">
                  Zurück zur Anmeldung
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Gib deine E-Mail ein – wir schicken dir einen Link zum Zurücksetzen.</p>
                <button
                  onClick={sendReset}
                  disabled={loading || !email}
                  className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Mail className="w-5 h-5" />}
                  Reset-Link senden
                </button>
                <button onClick={() => { setMode('login'); setError('') }}
                  className="w-full text-center text-sm text-gray-400 hover:text-primary-500 transition-colors">
                  Zurück
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

