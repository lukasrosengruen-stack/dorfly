'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { Logo } from '@/components/ui'
import RegisterForm, { type EinladungsInfo } from './RegisterForm'

type Mode = 'login' | 'register' | 'forgot'

const ROLLEN_LABEL: Record<string, string> = {
  buerger: 'Bürger:in',
  verein: 'Vereinsverantwortliche:r',
  organisation: 'Organisationsverantwortliche:r',
  gewerbe: 'Gewerbetreibende:r',
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [infoMsg, setInfoMsg] = useState('')
  const [einladungsToken, setEinladungsToken] = useState<string | null>(null)
  const [einladungsInfo, setEinladungsInfo] = useState<EinladungsInfo | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const urlError = searchParams.get('error')
    const urlInfo  = searchParams.get('info')
    if (urlError === 'confirmation_failed') {
      setError('email_not_confirmed')
      setTimeout(() => document.getElementById('login-email')?.focus(), 100)
    }
    // wrong_browser: Legacy-Redirect von einem kurzen Deploymentzeitraum – gleich behandeln wie email_confirmed
    if (urlError === 'wrong_browser' || urlInfo === 'email_confirmed') {
      setInfoMsg('email_confirmed')
    }
    const token = searchParams.get('token')
    if (token) {
      setEinladungsToken(token)
      setMode('register')
      fetch(`/api/einladung/${token}`)
        .then(r => r.json())
        .then(data => {
          if (data.email) {
            setEinladungsInfo(data as EinladungsInfo)
            setEmail(data.email)
          } else {
            setError(
              data.grund === 'bereits_angenommen' ? 'Diese Einladung wurde bereits angenommen.' :
              data.grund === 'abgelaufen'          ? 'Diese Einladung ist abgelaufen. Bitte wende dich an deine Gemeindeverwaltung.' :
              'Diese Einladung ist nicht mehr gültig.'
            )
          }
        })
        .catch(() => setError('Einladung konnte nicht geladen werden.'))
    }
  }, [searchParams])

  async function resendConfirmation() {
    if (!email) {
      document.getElementById('login-email')?.focus()
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setResendSent(true)
  }

  async function sendReset() {
    if (!email) { setError('Bitte E-Mail eingeben'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/passwort-zuruecksetzen`,
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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        let profile = await supabase
          .from('profiles')
          .select('role, gemeinden(slug)')
          .eq('id', data.user?.id ?? '')
          .single()
          .then(r => r.data)

        // Kein Profil: Auth-Callback schlug fehl (PKCE-Fehler), Profil jetzt nachholen
        if (!profile) {
          const res = await fetch('/api/setup-profil', { method: 'POST' })
          if (res.ok) {
            const { slug: gemeindeSlug } = await res.json() as { slug?: string }
            const targetHost = gemeindeSlug ? `${gemeindeSlug}.dorfly.de` : null
            if (targetHost && window.location.hostname !== targetHost) {
              window.location.href = `https://${targetHost}/home`
            } else {
              router.push('/home')
              router.refresh()
            }
            return
          }
          // setup-profil fehlgeschlagen: trotzdem weiterleiten, App-Middleware fängt ab
          profile = await supabase
            .from('profiles')
            .select('role, gemeinden(slug)')
            .eq('id', data.user?.id ?? '')
            .single()
            .then(r => r.data)
        }

        if ((profile as { role?: string } | null)?.role === 'super_admin') {
          router.push('/admin/dashboard')
          router.refresh()
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const slug = (profile as any)?.gemeinden?.slug as string | undefined
          const currentHost = window.location.hostname
          if (slug && currentHost !== `${slug}.dorfly.de`) {
            window.location.href = `https://${slug}.dorfly.de/home`
          } else {
            router.push('/home')
            router.refresh()
          }
        }
        return
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fehler'
      if (msg.includes('Invalid login')) setError('E-Mail oder Passwort falsch')
      else if (msg.includes('email_not_confirmed') || msg.includes('Email not confirmed')) setError('email_not_confirmed')
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
          <Image
            src="/icons/icon-512.png"
            alt=""
            width={64}
            height={64}
            className="rounded-2xl mx-auto mb-4"
          />
          <h1><Logo size={28} /></h1>
          <p className="text-gray-500 text-sm mt-1">Die digitale Heimat deiner Gemeinde</p>
        </div>

        {/* Einladungs-Banner */}
        {einladungsInfo && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4 text-sm">
            <p className="font-semibold text-primary-800">
              Einladung von {einladungsInfo.gemeinde_name}
            </p>
            <p className="text-primary-700 mt-1">
              Rolle: <strong>{ROLLEN_LABEL[einladungsInfo.rolle] ?? einladungsInfo.rolle}</strong>
              {einladungsInfo.organisation_name && (
                <> · {einladungsInfo.organisation_name}</>
              )}
            </p>
          </div>
        )}

        {/* Tab */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {m === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode !== 'register' && (
            <div>
              <label htmlFor="login-email" className="sr-only">E-Mail-Adresse</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="E-Mail-Adresse"
                autoComplete="email"
                readOnly={!!einladungsInfo}
                className={`w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 ${einladungsInfo ? 'bg-gray-50 text-gray-500' : ''}`}
              />
            </div>
          )}
          {mode === 'login' && (
            <div>
              <label htmlFor="login-password" className="sr-only">Passwort</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Passwort"
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
          )}

          {mode === 'register' ? (
            <RegisterForm
              einladungsToken={einladungsToken}
              einladungsInfo={einladungsInfo}
              onRegistered={() => setRegistered(true)}
            />
          ) : (
            <>
              {infoMsg === 'email_confirmed' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                  <p className="text-amber-800 font-medium">Bestätigungslink in anderem Browser geöffnet</p>
                  <p className="text-amber-700 mt-1">
                    Melde dich direkt mit deiner E-Mail und deinem Passwort an — oder fordere einen neuen Bestätigungslink an.
                  </p>
                  {resendSent ? (
                    <p className="text-green-700 mt-2 font-medium">Neue E-Mail gesendet!</p>
                  ) : (
                    <button
                      onClick={resendConfirmation}
                      disabled={!email || loading}
                      className="mt-2 text-amber-900 underline font-medium disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      {loading ? 'Sende...' : 'Neuen Bestätigungslink senden'}
                    </button>
                  )}
                </div>
              ) : error === 'email_not_confirmed' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                  <p className="text-amber-800 font-medium">E-Mail noch nicht bestätigt</p>
                  <p className="text-amber-700 mt-1">
                    Bitte klicke auf den Link in der Bestätigungs-E-Mail.
                    {!email && <> <strong>Gib deine E-Mail-Adresse oben ein</strong> um eine neue anzufordern.</>}
                  </p>
                  {resendSent ? (
                    <p className="text-green-700 mt-2 font-medium">E-Mail erneut gesendet!</p>
                  ) : (
                    <button
                      onClick={resendConfirmation}
                      disabled={!email || loading}
                      className="mt-2 text-amber-900 underline font-medium disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      {loading ? 'Sende...' : 'Bestätigungs-E-Mail erneut senden'}
                    </button>
                  )}
                </div>
              ) : error ? (
                <p role="alert" className="text-red-500 text-sm">{error}</p>
              ) : null}

              {mode === 'login' && (
                <button
                  onClick={submit}
                  disabled={loading || !email || !password}
                  className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                  Anmelden
                </button>
              )}

              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError('') }}
                  className="w-full text-center text-sm text-gray-400 hover:text-primary-500 transition-colors pt-1"
                >
                  Passwort vergessen?
                </button>
              )}
            </>
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

