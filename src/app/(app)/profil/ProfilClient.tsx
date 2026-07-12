'use client'

import { Capacitor } from '@capacitor/core'
import { toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { Profile } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { updateProfil } from '@/app/actions/profil'
import { useRouter } from 'next/navigation'
import { LogOut, Shield, Pencil, X, Check, Loader2, User, MapPin, KeyRound, Eye, EyeOff, Bell, Mail } from 'lucide-react'
import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  buerger:      'Bürger',
  verein:       'Verein',
  organisation: 'Organisation',
  gewerbe:      'Gewerbe',
  gemeinderat:  'Gemeinderat',
  verwaltung:   'Verwaltung',
  super_admin:  'Super-Admin',
}

type FullProfile = Profile & {
  gemeinden?: { name: string; bundesland: string } | null
  vorname?: string | null
  nachname?: string | null
  adresse?: string | null
  geburtsdatum?: string | null
  verein_name?: string | null
}

export default function ProfilClient({ profile, email, gemeindeSlug }: { profile: FullProfile | null; email: string | null; gemeindeSlug: string | null }) {
  const router = useRouter()
  const routerRef = useRef(router)
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm, setPwForm] = useState({ neu: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwDone, setPwDone] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    const initAndCheck = async () => {
      if (Capacitor.isNativePlatform()) {
        const { default: OneSignal } = await import('onesignal-cordova-plugin')
        OneSignal.initialize('93b42ea5-8ef7-4c9e-9d26-116cf64ad62d')
        OneSignal.Notifications.addEventListener('click', (event) => {
          const pfad = (event.notification.additionalData as { pfad?: string } | null)?.pfad
          if (!pfad) return
          routerRef.current.push(pfad)
        })
        const granted = await OneSignal.Notifications.getPermissionAsync()
        setPushPermission(granted ? 'granted' : 'default')
      } else if ('Notification' in window) {
        setPushPermission(Notification.permission)
      }
    }
    initAndCheck()
  }, []) // läuft einmalig beim Mount; routerRef ist eine stabile Ref-Referenz
  const nameParts = (profile?.display_name ?? '').trim().split(/\s+/)
  const [form, setForm] = useState({
    vorname:  nameParts[0] ?? '',
    nachname: nameParts.slice(1).join(' '),
  })

  const displayName = profile?.display_name || 'Kein Name'
  const initials = displayName !== 'Kein Name'
    ? displayName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  async function save() {
    setSaving(true)
    const result = await updateProfil({ vorname: form.vorname, nachname: form.nachname })
    setSaving(false)
    if (result.success) {
      setEditing(false)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Fehler beim Speichern')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function changePassword() {
    if (pwForm.neu !== pwForm.confirm) { setPwError('Passwörter stimmen nicht überein'); return }
    if (pwForm.neu.length < 6) { setPwError('Mindestens 6 Zeichen'); return }
    setPwLoading(true)
    setPwError('')
    const { error } = await supabase.auth.updateUser({ password: pwForm.neu })
    setPwLoading(false)
    if (error) { setPwError(error.message); return }
    setPwDone(true)
    setPwForm({ neu: '', confirm: '' })
    setTimeout(() => { setPwDone(false); setShowPwForm(false) }, 2000)
  }

  async function enablePush() {
    setPushLoading(true)

    if (Capacitor.isNativePlatform()) {
      if (!gemeindeSlug) {
        toast.error('Gemeinde nicht erkannt – Push konnte nicht aktiviert werden')
        setPushLoading(false)
        return
      }
      try {
        const { default: OneSignal } = await import('onesignal-cordova-plugin')
        const granted = await OneSignal.Notifications.requestPermission(true)
        if (granted) {
          if (profile?.id) OneSignal.login(profile.id)
          OneSignal.User.addTag('gemeinde_slug', gemeindeSlug)
          setPushPermission('granted')
          toast.success('Push-Benachrichtigungen aktiviert!')
        } else {
          setPushPermission('denied')
        }
      } catch (e) {
        console.error('[Push]', e)
        toast.error('Push konnte nicht aktiviert werden')
      } finally {
        setPushLoading(false)
      }
      return
    }

    // Web-Pfad — unverändert, Slug aus Prop oder Fallback auf hostname
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any

    const doInit = async (OneSignal: any) => {
      try {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
          notifyButton: { enable: false },
        })

        const granted = await OneSignal.Notifications.requestPermission()

        if (granted) {
          if (profile?.id) await OneSignal.login(profile.id)
          const slug = gemeindeSlug ?? (() => {
            const hostname = window.location.hostname
            const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'
            return hostname.endsWith(`.${rootDomain}`)
              ? hostname.replace(`.${rootDomain}`, '')
              : hostname
          })()
          OneSignal.User.addTag('gemeinde_slug', slug)
          setPushPermission('granted')
          toast.success('Push-Benachrichtigungen aktiviert!')
        } else {
          setPushPermission(Notification.permission)
        }
      } catch (e) {
        console.error('[Push]', e)
        toast.error('Push konnte nicht aktiviert werden')
      } finally {
        setPushLoading(false)
      }
    }

    if (win.OneSignal) {
      doInit(win.OneSignal)
    } else {
      win.OneSignalDeferred = win.OneSignalDeferred || []
      win.OneSignalDeferred.push(doInit)

      if (!document.querySelector('script[src*="OneSignalSDK.page.js"]')) {
        const script = document.createElement('script')
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
        script.onerror = () => {
          toast.error('Push konnte nicht geladen werden')
          setPushLoading(false)
        }
        document.head.appendChild(script)
      }
    }
  }

  return (
    <div>
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Profil</h1>
        {!editing
          ? <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-primary-500 font-medium">
              <Pencil className="w-4 h-4" /> Bearbeiten
            </button>
          : <div className="flex gap-2">
              <button onClick={() => { setEditing(false) }} className="p-2 rounded-xl bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Speichern
              </button>
            </div>
        }
      </div>

      <div className="p-4 space-y-4">
        {/* Avatar */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600 mb-3">
            {initials}
          </div>
          <h2 className="text-lg font-bold text-gray-900">{displayName}</h2>
          <span className="mt-1 px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-sm font-medium">
            {ROLE_LABELS[profile?.role ?? 'buerger']}
            {profile?.verein_name && ` · ${profile.verein_name}`}
          </span>
        </div>

        {/* Persönliche Daten */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Persönliche Daten</h3>
          </div>

          {editing ? (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Vorname</label>
                  <input
                    value={form.vorname}
                    onChange={e => setForm(f => ({ ...f, vorname: e.target.value }))}
                    placeholder="Vorname"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Nachname</label>
                  <input
                    value={form.nachname}
                    onChange={e => setForm(f => ({ ...f, nachname: e.target.value }))}
                    placeholder="Nachname"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              <InfoRow icon={User} label="Name" value={displayName !== 'Kein Name' ? displayName : null} placeholder="Nicht angegeben" />
            </div>
          )}
        </div>

        {/* Konto */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Konto</h3>
          </div>
          <div className="divide-y divide-gray-50">
            <InfoRow icon={Mail} label="E-Mail" value={email} placeholder="Nicht verfügbar" />
            <InfoRow icon={Shield} label="Rolle" value={ROLE_LABELS[profile?.role ?? 'buerger']} />
            <InfoRow icon={MapPin} label="Gemeinde" value={profile?.gemeinden?.name ?? null} placeholder="Keine Gemeinde" />
          </div>
        </div>

        {/* Passwort ändern */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => { setShowPwForm(v => !v); setPwError(''); setPwDone(false) }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
          >
            <KeyRound className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 flex-1">Passwort ändern</span>
            <span className="text-xs text-primary-500">{showPwForm ? 'Schließen' : 'Ändern'}</span>
          </button>
          {showPwForm && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
              {pwDone ? (
                <p className="text-primary-600 text-sm font-medium pt-3">Passwort erfolgreich geändert!</p>
              ) : (
                <>
                  <div className="relative mt-3">
                    <label htmlFor="pw-neu" className="sr-only">Neues Passwort</label>
                    <input
                      id="pw-neu"
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.neu}
                      onChange={e => setPwForm(f => ({ ...f, neu: e.target.value }))}
                      placeholder="Neues Passwort"
                      autoComplete="new-password"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <div>
                    <label htmlFor="pw-confirm" className="sr-only">Passwort bestätigen</label>
                    <input
                      id="pw-confirm"
                      type="password"
                      value={pwForm.confirm}
                      onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                      placeholder="Passwort bestätigen"
                      autoComplete="new-password"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {pwError && <p role="alert" className="text-red-500 text-xs">{pwError}</p>}
                  <button
                    onClick={changePassword}
                    disabled={pwLoading || !pwForm.neu || !pwForm.confirm}
                    className="w-full bg-primary-500 text-white font-medium py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {pwLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Speichern
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Push-Benachrichtigungen */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Benachrichtigungen</h3>
          </div>
          <div className="px-4 py-3.5 flex items-center gap-3">
            <Bell className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Push-Benachrichtigungen</p>
              <p className="text-xs text-gray-400">
                {pushPermission === 'granted'
                  ? 'Aktiviert'
                  : pushPermission === 'denied'
                    ? 'Blockiert – in Browser-Einstellungen aktivieren'
                    : 'Nicht aktiviert'}
              </p>
            </div>
            {pushPermission !== 'granted' && pushPermission !== 'denied' && (
              <button
                onClick={enablePush}
                disabled={pushLoading}
                className="text-xs font-medium text-primary-500 bg-primary-50 px-3 py-1.5 rounded-full disabled:opacity-50 shrink-0"
              >
                {pushLoading ? 'Wird aktiviert…' : 'Aktivieren'}
              </button>
            )}
            {pushPermission === 'granted' && (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full shrink-0">Aktiv</span>
            )}
          </div>
        </div>

        {/* Rechtliches */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Rechtliches</h3>
          </div>
          <div className="divide-y divide-gray-50">
            <a href="/datenschutz" className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
              <Shield className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-700 flex-1">Datenschutzerklärung</span>
              <span className="text-gray-300">›</span>
            </a>
            <a href="/impressum" className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
              <Shield className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-700 flex-1">Impressum</span>
              <span className="text-gray-300">›</span>
            </a>
            <Link href="/barrierefreiheit" className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
              <Shield className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-700 flex-1">Barrierefreiheit</span>
              <span className="text-gray-300">›</span>
            </Link>
            <Link href="/profil/datenschutz-daten" className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
              <Shield className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-700 flex-1">Datenschutz & Daten</span>
              <span className="text-gray-300">›</span>
            </Link>
          </div>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 text-red-500 font-medium hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, placeholder }: {
  icon: React.ElementType
  label: string
  value: string | null
  placeholder?: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm font-medium truncate ${value ? 'text-gray-900' : 'text-gray-300'}`}>
          {value ?? placeholder ?? '–'}
        </p>
      </div>
    </div>
  )
}

