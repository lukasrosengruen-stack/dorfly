'use client'

import { useState } from 'react'
import { Profile } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, Phone, MapPin, Shield, Pencil, X, Check, Loader2, User, Calendar, Trash2, KeyRound, Eye, EyeOff } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  buerger:      'Bürger',
  verein:       'Verein',
  organisation: 'Organisation',
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

export default function ProfilClient({ profile }: { profile: FullProfile | null }) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPwForm, setShowPwForm] = useState(false)
  const [pwForm, setPwForm] = useState({ neu: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwDone, setPwDone] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState({
    vorname:      profile?.vorname ?? '',
    nachname:     profile?.nachname ?? '',
    adresse:      profile?.adresse ?? '',
    geburtsdatum: profile?.geburtsdatum ?? '',
    phone:        profile?.phone ?? '',
  })

  const initials = profile?.vorname && profile?.nachname
    ? `${profile.vorname[0]}${profile.nachname[0]}`.toUpperCase()
    : profile?.display_name?.[0]?.toUpperCase() ?? '?'

  const displayName = [profile?.vorname, profile?.nachname].filter(Boolean).join(' ')
    || profile?.display_name
    || 'Kein Name'

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        vorname:      form.vorname || null,
        nachname:     form.nachname || null,
        display_name: [form.vorname, form.nachname].filter(Boolean).join(' ') || null,
        adresse:      form.adresse || null,
        geburtsdatum: form.geburtsdatum || null,
        phone:        form.phone || null,
      })
      .eq('id', profile?.id ?? '')
    setSaving(false)
    if (!error) { setEditing(false); router.refresh() }
    else alert('Fehler beim Speichern')
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

  async function deleteAccount() {
    if (!confirm('Konto wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return
    const res = await fetch('/api/auth/loeschen', { method: 'DELETE' })
    if (res.ok) {
      await supabase.auth.signOut()
      router.push('/login')
    } else {
      const body = await res.json().catch(() => ({}))
      alert('Fehler: ' + (body.error ?? res.status))
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
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Adresse</label>
                <input
                  value={form.adresse}
                  onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                  placeholder="Straße, PLZ Ort"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Geburtsdatum</label>
                <input
                  type="date"
                  value={form.geburtsdatum}
                  onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Telefon</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+49 151 ..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              <InfoRow icon={User} label="Name" value={displayName !== 'Kein Name' ? displayName : null} placeholder="Nicht angegeben" />
              <InfoRow icon={Calendar} label="Geburtsdatum" value={profile?.geburtsdatum ? new Date(profile.geburtsdatum).toLocaleDateString('de-DE') : null} placeholder="Nicht angegeben" />
              <InfoRow icon={MapPin} label="Adresse" value={profile?.adresse ?? null} placeholder="Nicht angegeben" />
              <InfoRow icon={Phone} label="Telefon" value={profile?.phone || null} placeholder="Nicht angegeben" />
            </div>
          )}
        </div>

        {/* Konto */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Konto</h3>
          </div>
          <div className="divide-y divide-gray-50">
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
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.neu}
                      onChange={e => setPwForm(f => ({ ...f, neu: e.target.value }))}
                      placeholder="Neues Passwort"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <input
                    type="password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Passwort bestätigen"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
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

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 text-red-500 font-medium hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>

        <button
          onClick={deleteAccount}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-400 text-sm font-medium hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Konto löschen
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

