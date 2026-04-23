'use client'

import { useState } from 'react'
import { Mangel, MaengelStatus, Profile } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { Plus, MapPin, Camera, X, Loader2, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { de } from 'date-fns/locale'

const STATUS_META: Record<MaengelStatus, { label: string; color: string; icon: React.ElementType }> = {
  offen:          { label: 'Offen',          color: 'text-red-600 bg-red-50',     icon: AlertTriangle },
  in_bearbeitung: { label: 'In Bearbeitung', color: 'text-amber-600 bg-amber-50', icon: Clock },
  erledigt:       { label: 'Erledigt',       color: 'text-green-600 bg-green-50', icon: CheckCircle2 },
}

const IS_ADMIN: Profile['role'][] = ['verwaltung', 'super_admin']
const IS_BUERGER: Profile['role'][] = ['buerger', 'verein', 'organisation']

interface Props {
  maengel: Mangel[]
  profile: Profile | null
}

export default function MaengelClient({ maengel: initialMaengel, profile }: Props) {
  const [maengel, setMaengel] = useState(initialMaengel)
  const isAdmin = profile?.role && IS_ADMIN.includes(profile.role)

  return (
    <div>
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">
          {isAdmin ? 'Ticket-Übersicht' : 'Mängelmelder'}
        </h1>
        <p className="text-sm text-gray-500">
          {isAdmin ? 'Alle Meldungen der Bürger' : 'Schäden und Probleme melden'}
        </p>
      </div>

      {isAdmin
        ? <AdminView maengel={maengel} setMaengel={setMaengel} />
        : <BuergerView maengel={maengel} setMaengel={setMaengel} profile={profile} />
      }
    </div>
  )
}

// ─── Verwaltungs-Ansicht ──────────────────────────────────────────────────────

function AdminView({ maengel, setMaengel }: {
  maengel: Mangel[]
  setMaengel: React.Dispatch<React.SetStateAction<Mangel[]>>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [nachrichten, setNachrichten] = useState<Record<string, string>>({})

  async function updateStatus(mangel: Mangel, status: MaengelStatus) {
    setUpdating(mangel.id)
    try {
      const res = await fetch('/api/maengel/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mangelId: mangel.id,
          status,
          nachricht: nachrichten[mangel.id] ?? '',
        }),
      })
      if (!res.ok) throw new Error()
      setMaengel(prev => prev.map(m =>
        m.id === mangel.id
          ? { ...m, status, nachricht_an_buerger: nachrichten[mangel.id] ?? null }
          : m
      ))
      setNachrichten(n => ({ ...n, [mangel.id]: '' }))
      setExpandedId(null)
    } catch {
      alert('Fehler beim Aktualisieren')
    } finally {
      setUpdating(null)
    }
  }

  const grouped = {
    offen: maengel.filter(m => m.status === 'offen'),
    in_bearbeitung: maengel.filter(m => m.status === 'in_bearbeitung'),
    erledigt: maengel.filter(m => m.status === 'erledigt'),
  }

  return (
    <div className="p-4 space-y-6">
      {/* Statistik */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(STATUS_META) as [MaengelStatus, typeof STATUS_META[MaengelStatus]][]).map(([key, meta]) => (
          <div key={key} className={clsx('rounded-xl p-3 text-center', meta.color.split(' ')[1] + ' bg-opacity-50')}>
            <p className="text-2xl font-bold">{grouped[key].length}</p>
            <p className={clsx('text-xs font-medium', meta.color.split(' ')[0])}>{meta.label}</p>
          </div>
        ))}
      </div>

      {maengel.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Keine Meldungen vorhanden</p>
        </div>
      )}

      {maengel.map(m => {
        const meta = STATUS_META[m.status]
        const Icon = meta.icon
        const expanded = expandedId === m.id
        const isUpdating = updating === m.id

        return (
          <div key={m.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {m.foto_url && (
              <img src={m.foto_url} alt={m.titel} className="w-full h-36 object-cover" />
            )}
            <div className="p-4">
              {/* Kopfzeile */}
              <button
                onClick={() => setExpandedId(expanded ? null : m.id)}
                className="w-full flex items-start justify-between gap-3 text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full', meta.color)}>
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: de })}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{m.titel}</h3>
                  {m.beschreibung && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{m.beschreibung}</p>
                  )}
                  {(m.adresse || m.lat) && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      {m.adresse ?? `${m.lat?.toFixed(4)}, ${m.lng?.toFixed(4)}`}
                    </div>
                  )}
                </div>
                {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {/* Ticket bearbeiten */}
              {expanded && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <textarea
                    placeholder="Persönliche Nachricht an den Bürger (optional)"
                    value={nachrichten[m.id] ?? ''}
                    onChange={e => setNachrichten(n => ({ ...n, [m.id]: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(STATUS_META) as [MaengelStatus, typeof STATUS_META[MaengelStatus]][]).map(([key, s]) => (
                      <button
                        key={key}
                        onClick={() => updateStatus(m, key)}
                        disabled={isUpdating || m.status === key}
                        className={clsx(
                          'py-2 rounded-xl text-xs font-medium border-2 transition-colors flex items-center justify-center gap-1 disabled:opacity-40',
                          m.status === key
                            ? clsx(s.color, 'border-current')
                            : 'border-gray-200 text-gray-500 hover:border-gray-400'
                        )}
                      >
                        {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <s.icon className="w-3 h-3" />}
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    {nachrichten[m.id] ? 'Nachricht wird mit der Statusänderung per E-Mail versendet.' : 'Bürger wird per E-Mail über die Statusänderung informiert.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Bürger-Ansicht ───────────────────────────────────────────────────────────

function BuergerView({ maengel, setMaengel, profile }: {
  maengel: Mangel[]
  setMaengel: React.Dispatch<React.SetStateAction<Mangel[]>>
  profile: Profile | null
  }) {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ titel: '', beschreibung: '', adresse: '' })
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const supabase = createClient()

  const eigeneMaengel = maengel.filter(m => m.melder_id === profile?.id)

  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  async function getLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false) },
      () => { alert('Standort nicht verfügbar'); setLocating(false) },
      { timeout: 10000 }
    )
  }

  async function submit() {
    if (!form.titel || !profile?.gemeinde_id) return
    setLoading(true)
    try {
      let foto_url: string | null = null
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop()
        const path = `maengel/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('dorfly-media').upload(path, fotoFile)
        if (!uploadErr) {
          const { data } = supabase.storage.from('dorfly-media').getPublicUrl(path)
          foto_url = data.publicUrl
        }
      }

      const { data, error } = await supabase
        .from('maengel')
        .insert({
          gemeinde_id: profile.gemeinde_id!,
          melder_id: profile.id,
          titel: form.titel,
          beschreibung: form.beschreibung || null,
          adresse: form.adresse || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          foto_url,
          status: 'offen',
        })
        .select('*, profiles(display_name)')
        .single()

      if (error) throw error
      setMaengel(prev => [data as Mangel, ...prev])
      setShowForm(false)
      setForm({ titel: '', beschreibung: '', adresse: '' })
      setCoords(null); setFotoFile(null); setFotoPreview(null)
    } catch { alert('Fehler beim Speichern') }
    finally { setLoading(false) }
  }

  return (
    <>
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-24 right-4 bg-primary-500 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-20 hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Formular */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">Schaden melden</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                placeholder="Titel (z. B. Schlagloch Hauptstraße)"
                value={form.titel}
                onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <textarea
                placeholder="Beschreibung (optional)"
                value={form.beschreibung}
                onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Adresse / Ort (optional)"
                value={form.adresse}
                onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={getLocation}
                disabled={locating}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-colors',
                  coords ? 'border-primary-500 text-primary-500 bg-primary-50' : 'border-gray-300 text-gray-600'
                )}
              >
                {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {coords ? `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'GPS-Standort erfassen'}
              </button>
              <input type="file" accept="image/*" capture="environment" className="hidden" id="foto-input" onChange={handleFoto} />
              <button
                onClick={() => document.getElementById('foto-input')?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-gray-300 text-sm font-medium text-gray-600"
              >
                <Camera className="w-4 h-4" />
                {fotoFile ? fotoFile.name : 'Foto aufnehmen'}
              </button>
              {fotoPreview && (
                <div className="relative">
                  <img src={fotoPreview} alt="Vorschau" className="w-full h-40 object-cover rounded-xl" />
                  <button onClick={() => { setFotoFile(null); setFotoPreview(null) }} className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
              <button
                onClick={submit}
                disabled={loading || !form.titel}
                className="w-full bg-primary-500 text-white font-semibold py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Meldung abschicken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eigene Meldungen */}
      <div className="p-4 space-y-3">
        {eigeneMaengel.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Du hast noch keine Meldungen abgegeben</p>
            <p className="text-sm mt-1">Tippe auf + um einen Schaden zu melden</p>
          </div>
        )}

        {eigeneMaengel.map(m => {
          const meta = STATUS_META[m.status]
          const Icon = meta.icon
          return (
            <div key={m.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {m.foto_url && <img src={m.foto_url} alt={m.titel} className="w-full h-36 object-cover" />}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{m.titel}</h3>
                  <span className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded-full shrink-0', meta.color)}>
                    <Icon className="w-3 h-3" />{meta.label}
                  </span>
                </div>
                {m.beschreibung && <p className="text-sm text-gray-500 mt-1">{m.beschreibung}</p>}
                {m.nachricht_an_buerger && (
                  <div className="mt-3 bg-primary-50 border border-primary-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-primary-600 mb-1">Nachricht der Verwaltung</p>
                    <p className="text-sm text-gray-700">{m.nachricht_an_buerger}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: de })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

