'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Send, Search, UserCheck, Mail, Clock, CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react'

type EinladungRolle = 'buerger' | 'verein' | 'organisation' | 'gewerbe' | 'gemeinderat' | 'verwaltung'
type EinladungStatus = 'offen' | 'angenommen' | 'abgelaufen' | 'widerrufen'

const ROLLEN: { value: EinladungRolle; label: string }[] = [
  { value: 'verwaltung',   label: 'Verwaltung' },
  { value: 'gemeinderat',  label: 'Gemeinderat/rätin' },
  { value: 'verein',       label: 'Vereinsverantwortliche:r' },
  { value: 'organisation', label: 'Organisationsverantwortliche:r' },
  { value: 'gewerbe',      label: 'Gewerbetreibende:r' },
  { value: 'buerger',      label: 'Bürger:in' },
]

const ROLLEN_LABEL: Record<string, string> = Object.fromEntries(ROLLEN.map(r => [r.value, r.label]))

interface EinladungZeile {
  id: string
  email: string
  rolle: EinladungRolle
  orgName: string
  hinweis: string
}

interface Einladung {
  id: string
  email: string
  rolle: string
  organisation_name: string | null
  hinweis: string | null
  status: EinladungStatus
  erstellt_am: string
  ablauft_am: string
}

interface GefundenerNutzer {
  id: string
  email: string
  display_name: string | null
  vorname: string | null
  nachname: string | null
  role: string
  erstellt_am: string
}

type Props = {
  gemeinden: { id: string; name: string }[]
}

function statusBadge(status: EinladungStatus) {
  const cfg: Record<EinladungStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    offen:      { label: 'Offen',      cls: 'bg-blue-100 text-blue-700',   icon: <Clock className="w-3 h-3" /> },
    angenommen: { label: 'Angenommen', cls: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
    abgelaufen: { label: 'Abgelaufen', cls: 'bg-gray-100 text-gray-500',   icon: <XCircle className="w-3 h-3" /> },
    widerrufen: { label: 'Widerrufen', cls: 'bg-red-100 text-red-600',     icon: <XCircle className="w-3 h-3" /> },
  }
  const { label, cls, icon } = cfg[status] ?? cfg.offen
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon}{label}
    </span>
  )
}

function brauchtOrg(rolle: EinladungRolle) {
  return rolle === 'verein' || rolle === 'organisation' || rolle === 'gewerbe'
}

let zeilenCounter = 0
function neueZeile(): EinladungZeile {
  return { id: String(++zeilenCounter), email: '', rolle: 'verwaltung', orgName: '', hinweis: '' }
}

export default function AdminEinladungSection({ gemeinden }: Props) {
  const [selectedGemeindeId, setSelectedGemeindeId] = useState<string>(gemeinden[0]?.id ?? '')
  const [tab, setTab] = useState<'einladen' | 'nutzer' | 'uebersicht'>('einladen')

  // ── Tab: Einladen ──────────────────────────────────────────────────────────
  const [zeilen, setZeilen] = useState<EinladungZeile[]>([neueZeile()])
  const [sending, setSending] = useState(false)

  function zeileFeld(id: string, feld: keyof EinladungZeile, wert: string) {
    setZeilen(prev => prev.map(z => z.id === id ? { ...z, [feld]: wert } : z))
  }

  async function einladungenSenden() {
    if (!selectedGemeindeId) { toast.error('Bitte eine Gemeinde auswählen'); return }
    const gueltig = zeilen.filter(z => z.email.trim())
    if (!gueltig.length) { toast.error('Bitte mindestens eine E-Mail eingeben'); return }

    setSending(true)
    try {
      const res = await fetch('/api/verwaltung/einladungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemeinde_id: selectedGemeindeId,
          einladungen: gueltig.map(z => ({
            email: z.email.trim(),
            rolle: z.rolle,
            organisation_name: z.orgName.trim() || undefined,
            hinweis: z.hinweis.trim() || undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)

      const ok   = data.ergebnisse.filter((e: { ok: boolean }) => e.ok).length
      const fail = data.ergebnisse.filter((e: { ok: boolean }) => !e.ok).length
      if (ok)   toast.success(`${ok} Einladung${ok > 1 ? 'en' : ''} versendet`)
      if (fail) toast.error(`${fail} Einladung${fail > 1 ? 'en' : ''} fehlgeschlagen`)

      setZeilen([neueZeile()])
      if (tab === 'uebersicht') ladeEinladungen()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Versenden')
    } finally {
      setSending(false)
    }
  }

  // ── Tab: Nutzer verwalten ──────────────────────────────────────────────────
  const [suchEmail, setSuchEmail] = useState('')
  const [suchLaden, setSuchLaden] = useState(false)
  const [gefundenerNutzer, setGefundenerNutzer] = useState<GefundenerNutzer | null | 'nicht-gefunden'>(null)
  const [neueRolle, setNeueRolle] = useState<EinladungRolle>('verwaltung')
  const [neueOrgName, setNeueOrgName] = useState('')
  const [speichernLaden, setSpeichernLaden] = useState(false)

  async function nutzerSuchen() {
    if (!suchEmail.trim() || !selectedGemeindeId) return
    setSuchLaden(true)
    setGefundenerNutzer(null)
    try {
      const res = await fetch(
        `/api/verwaltung/nutzer/suche?email=${encodeURIComponent(suchEmail.trim())}&gemeinde_id=${selectedGemeindeId}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setGefundenerNutzer(data.nutzer ?? 'nicht-gefunden')
      if (data.nutzer) setNeueRolle(data.nutzer.role as EinladungRolle)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setSuchLaden(false)
    }
  }

  async function rolleSpeichern() {
    if (!gefundenerNutzer || gefundenerNutzer === 'nicht-gefunden' || !selectedGemeindeId) return
    setSpeichernLaden(true)
    try {
      const res = await fetch('/api/verwaltung/nutzer/rolle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemeinde_id: selectedGemeindeId,
          email: suchEmail.trim(),
          neueRolle,
          organisation_name: neueOrgName.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      toast.success('Rolle erfolgreich gesetzt')
      setSuchEmail('')
      setGefundenerNutzer(null)
      setNeueOrgName('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setSpeichernLaden(false)
    }
  }

  // ── Tab: Übersicht ─────────────────────────────────────────────────────────
  const [einladungen, setEinladungen] = useState<Einladung[]>([])
  const [uebersichtLaden, setUebersichtLaden] = useState(false)
  const [aktionLaden, setAktionLaden] = useState<string | null>(null)

  const ladeEinladungen = useCallback(async () => {
    if (!selectedGemeindeId) return
    setUebersichtLaden(true)
    try {
      const res = await fetch(`/api/verwaltung/einladungen?gemeinde_id=${selectedGemeindeId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEinladungen(data.einladungen ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setUebersichtLaden(false)
    }
  }, [selectedGemeindeId])

  useEffect(() => {
    if (tab === 'uebersicht') ladeEinladungen()
  }, [tab, ladeEinladungen])

  // Reset wenn Gemeinde wechselt
  useEffect(() => {
    setZeilen([neueZeile()])
    setSuchEmail('')
    setGefundenerNutzer(null)
    setEinladungen([])
  }, [selectedGemeindeId])

  async function widerrufen(id: string) {
    setAktionLaden(id)
    try {
      const res = await fetch(`/api/verwaltung/einladungen/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEinladungen(prev => prev.map(e => e.id === id ? { ...e, status: 'widerrufen' } : e))
      toast.success('Einladung widerrufen')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setAktionLaden(null)
    }
  }

  async function erneutSenden(id: string) {
    setAktionLaden(id)
    try {
      const res = await fetch(`/api/verwaltung/einladungen/${id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Einladung erneut gesendet')
      await ladeEinladungen()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setAktionLaden(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">Nutzer & Einladungen</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">Gemeinde:</label>
          <select
            value={selectedGemeindeId}
            onChange={e => setSelectedGemeindeId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {gemeinden.length === 0 && <option value="">Keine Gemeinden</option>}
            {gemeinden.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6 gap-1">
          {([
            { key: 'einladen',   label: 'Einladen' },
            { key: 'nutzer',     label: 'Nutzer verwalten' },
            { key: 'uebersicht', label: 'Übersicht' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Einladen ───────────────────────────────────────────────────── */}
        {tab === 'einladen' && (
          <div className="space-y-4">
            <div className="space-y-3">
              {zeilen.map((z, i) => (
                <div key={z.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={z.email}
                      onChange={e => zeileFeld(z.id, 'email', e.target.value)}
                      placeholder="E-Mail-Adresse"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      value={z.rolle}
                      onChange={e => zeileFeld(z.id, 'rolle', e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      {ROLLEN.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    {zeilen.length > 1 && (
                      <button
                        onClick={() => setZeilen(prev => prev.filter(z2 => z2.id !== z.id))}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {brauchtOrg(z.rolle) && (
                    <input
                      type="text"
                      value={z.orgName}
                      onChange={e => zeileFeld(z.id, 'orgName', e.target.value)}
                      placeholder={
                        z.rolle === 'verein' ? 'Vereinsname (optional)' :
                        z.rolle === 'gewerbe' ? 'Betriebsname (optional)' : 'Organisationsname (optional)'
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}

                  {i === 0 && (
                    <input
                      type="text"
                      value={z.hinweis}
                      onChange={e => zeileFeld(z.id, 'hinweis', e.target.value)}
                      placeholder="Interner Hinweis (erscheint in der E-Mail, optional)"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setZeilen(prev => [...prev, neueZeile()])}
                className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Weitere Person hinzufügen
              </button>
              <button
                onClick={einladungenSenden}
                disabled={sending || !selectedGemeindeId}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {zeilen.filter(z => z.email.trim()).length > 1 ? 'Alle einladen' : 'Einladen'}
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Nutzer verwalten ────────────────────────────────────────────── */}
        {tab === 'nutzer' && (
          <div className="space-y-5">
            <div className="flex gap-2">
              <input
                type="email"
                value={suchEmail}
                onChange={e => { setSuchEmail(e.target.value); setGefundenerNutzer(null) }}
                onKeyDown={e => e.key === 'Enter' && nutzerSuchen()}
                placeholder="E-Mail-Adresse eingeben"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={nutzerSuchen}
                disabled={suchLaden || !suchEmail.trim() || !selectedGemeindeId}
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                {suchLaden ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Suchen
              </button>
            </div>

            {gefundenerNutzer === 'nicht-gefunden' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                Kein Nutzer mit dieser E-Mail in der gewählten Gemeinde gefunden.{' '}
                <button
                  onClick={() => { setTab('einladen'); setSuchEmail(''); setGefundenerNutzer(null) }}
                  className="font-medium underline"
                >
                  Einladen?
                </button>
              </div>
            )}

            {gefundenerNutzer && gefundenerNutzer !== 'nicht-gefunden' && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {gefundenerNutzer.display_name || [gefundenerNutzer.vorname, gefundenerNutzer.nachname].filter(Boolean).join(' ') || '—'}
                    </p>
                    <p className="text-sm text-gray-500">{gefundenerNutzer.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Aktuelle Rolle: <strong>{ROLLEN_LABEL[gefundenerNutzer.role] ?? gefundenerNutzer.role}</strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Neue Rolle</label>
                  <select
                    value={neueRolle}
                    onChange={e => { setNeueRolle(e.target.value as EinladungRolle); setNeueOrgName('') }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {ROLLEN.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {brauchtOrg(neueRolle) && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      {neueRolle === 'verein' ? 'Vereinsname' : neueRolle === 'gewerbe' ? 'Betriebsname' : 'Organisationsname'}
                      {' '}<span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={neueOrgName}
                      onChange={e => setNeueOrgName(e.target.value)}
                      placeholder="z. B. Turnverein 1860"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <button
                  onClick={rolleSpeichern}
                  disabled={speichernLaden || neueRolle === gefundenerNutzer.role}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {speichernLaden ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  Rolle speichern
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Übersicht ──────────────────────────────────────────────────── */}
        {tab === 'uebersicht' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={ladeEinladungen}
                disabled={uebersichtLaden}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${uebersichtLaden ? 'animate-spin' : ''}`} />
                Aktualisieren
              </button>
            </div>

            {uebersichtLaden && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}

            {!uebersichtLaden && einladungen.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Noch keine Einladungen für diese Gemeinde</p>
              </div>
            )}

            {!uebersichtLaden && einladungen.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">E-Mail</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Rolle</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Organisation</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Datum</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {einladungen.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-900">{e.email}</td>
                        <td className="px-4 py-3 text-gray-600">{ROLLEN_LABEL[e.rolle] ?? e.rolle}</td>
                        <td className="px-4 py-3 text-gray-500">{e.organisation_name ?? '—'}</td>
                        <td className="px-4 py-3">{statusBadge(e.status)}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {new Date(e.erstellt_am).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-4 py-3">
                          {e.status === 'offen' && (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => erneutSenden(e.id)}
                                disabled={aktionLaden === e.id}
                                title="Erneut senden"
                                className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                              >
                                {aktionLaden === e.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <RefreshCw className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => widerrufen(e.id)}
                                disabled={aktionLaden === e.id}
                                title="Widerrufen"
                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
