'use client'


import { toast } from 'sonner'
import { Fragment, useState } from 'react'
import { AlertTriangle, Loader2, MapPin, MessageSquare, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Status = 'offen' | 'in_bearbeitung' | 'erledigt'

const STATUS_LABEL: Record<Status, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearb.',
  erledigt: 'Erledigt',
}

const STATUS_AKTIV_CLS: Record<Status, string> = {
  offen: 'bg-red-100 text-red-600',
  in_bearbeitung: 'bg-amber-100 text-amber-600',
  erledigt: 'bg-primary-100 text-primary-600',
}

interface Mangel {
  id: string
  titel: string
  status: Status
  created_at: string
  beschreibung?: string | null
  adresse?: string | null
  foto_url?: string | null
  lat?: number | null
  lng?: number | null
  nachricht_an_buerger?: string | null
  profiles?: { display_name: string | null } | null
}

export default function MaengelSection({ maengel: initialMaengel, offeneMaengel, inBearbeitung, erledigteMaengel }: {
  maengel: Mangel[]
  offeneMaengel: number
  inBearbeitung: number
  erledigteMaengel: number
}) {
  const [maengel, setMaengel] = useState(initialMaengel)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [nachrichten, setNachrichten] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)

  async function deleteMangel(id: string) {
    if (!confirm('Meldung wirklich löschen?')) return
    setDeleting(id)
    try {
      const res = await fetch('/api/maengel/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      setMaengel(prev => prev.filter(m => m.id !== id))
    } catch { toast.error('Fehler beim Löschen') }
    finally { setDeleting(null) }
  }

  async function updateStatus(id: string, status: Status) {
    setUpdating(id)
    try {
      const res = await fetch('/api/maengel/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mangelId: id, status }),
      })
      if (!res.ok) throw new Error()
      setMaengel(prev => prev.map(m => m.id === id ? { ...m, status } : m))
    } catch {
      toast.error('Fehler beim Aktualisieren')
    } finally {
      setUpdating(null)
    }
  }

  async function sendNachricht(id: string, status: Status) {
    const nachricht = nachrichten[id] ?? ''
    setSending(id)
    try {
      const res = await fetch('/api/maengel/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mangelId: id, status, nachricht: nachricht || undefined }),
      })
      if (!res.ok) throw new Error()
      setMaengel(prev => prev.map(m => m.id === id ? { ...m, nachricht_an_buerger: nachricht || null } : m))
      setExpandedId(null)
      toast.success('Nachricht gespeichert')
    } catch {
      toast.error('Fehler beim Senden')
    } finally {
      setSending(null)
    }
  }

  function toggleExpand(m: Mangel) {
    if (expandedId === m.id) {
      setExpandedId(null)
    } else {
      setNachrichten(prev => ({ ...prev, [m.id]: m.nachricht_an_buerger ?? '' }))
      setExpandedId(m.id)
    }
  }

  function melderName(m: Mangel) {
    return (m.profiles as { display_name: string | null } | null)?.display_name ?? '–'
  }

  function datum(m: Mangel) {
    return new Date(m.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  // Statuswechsel und Zeilenaktionen erscheinen in Karten- und Tabellenansicht
  // identisch — deshalb einmal beschrieben statt zweimal gepflegt.
  function statusButtons(m: Mangel) {
    return (['offen', 'in_bearbeitung', 'erledigt'] as Status[]).map(s => (
      <button key={s}
        onClick={() => m.status !== s && updateStatus(m.id, s)}
        disabled={updating === m.id || m.status === s}
        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
          m.status === s ? STATUS_AKTIV_CLS[s] : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
        }`}>
        {updating === m.id ? <Loader2 className="w-3 h-3 animate-spin inline" aria-hidden="true" /> : null}
        {STATUS_LABEL[s]}
      </button>
    ))
  }

  function zeilenAktionen(m: Mangel) {
    return (
      <>
        <button
          onClick={() => toggleExpand(m)}
          aria-expanded={expandedId === m.id}
          className={`p-1.5 rounded-lg transition-colors relative ${expandedId === m.id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 hover:bg-primary-50 text-gray-500'}`}
          title="Nachricht an Bürger"
        >
          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
          {m.nachricht_an_buerger && expandedId !== m.id && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary-500 rounded-full" />
          )}
        </button>
        <button onClick={() => deleteMangel(m.id)} disabled={deleting === m.id}
          aria-label={`Meldung „${m.titel}“ löschen`}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-red-100 transition-colors disabled:opacity-50">
          {deleting === m.id
            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" aria-hidden="true" />
            : <Trash2 className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />}
        </button>
      </>
    )
  }

  // Detailbereich ohne Tabellen-Wrapper, damit ihn Karte und Tabellenzeile
  // gleichermaßen einbetten können.
  function detail(m: Mangel) {
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        {m.foto_url && (
          <a href={m.foto_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <img src={m.foto_url} alt={m.titel} className="w-32 h-32 object-cover rounded-xl border border-gray-200" />
          </a>
        )}

        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex flex-col gap-1">
            {m.beschreibung && (
              <p className="text-sm text-gray-700">{m.beschreibung}</p>
            )}
            {(m.adresse || (m.lat && m.lng)) && (
              <div className="flex items-center flex-wrap gap-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                {m.adresse && <span>{m.adresse}</span>}
                {m.lat && m.lng && (
                  <a
                    href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:underline ml-1"
                  >
                    Karte öffnen ↗
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={`nachricht-${m.id}`} className="text-xs font-semibold text-primary-700">
              Nachricht an Bürger
            </label>
            <textarea
              id={`nachricht-${m.id}`}
              value={nachrichten[m.id] ?? ''}
              onChange={e => setNachrichten(prev => ({ ...prev, [m.id]: e.target.value }))}
              placeholder="Nachricht an den Melder verfassen …"
              maxLength={2000}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">{(nachrichten[m.id] ?? '').length}/2000</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setExpandedId(null)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => sendNachricht(m.id, m.status)}
                  disabled={sending === m.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {sending === m.id && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                  Senden
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const sichtbare = maengel.slice(0, 10)

  return (
    <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-2 px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" aria-hidden="true" />
          Meldungen
        </h2>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{offeneMaengel} offen</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{inBearbeitung} in Bearb.</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-400 inline-block" />{erledigteMaengel} erledigt</span>
          <Link href="/maengel" className="text-primary-500 font-medium ml-1">Alle →</Link>
        </div>
      </div>

      {/* Schmale Viewports: Karten statt Tabelle.
          Die fünfspaltige Tabelle legt sich mit ~646px aus und wurde vom
          overflow-hidden dieser Section abgeschnitten — der Statusbutton
          „Erledigt“ lag außerhalb des Viewports und war nicht erreichbar. */}
      <ul className="md:hidden divide-y divide-gray-50">
        {sichtbare.map(m => (
          <li key={m.id} className="px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 font-medium break-words">{m.titel}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {melderName(m)} · {datum(m)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">{zeilenAktionen(m)}</div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">{statusButtons(m)}</div>
            {expandedId === m.id && (
              <div className="mt-3 -mx-5 px-5 py-4 border-t border-gray-100 bg-primary-50/40">
                {detail(m)}
              </div>
            )}
          </li>
        ))}
        {sichtbare.length === 0 && (
          <li className="px-5 py-6 text-center text-gray-500 text-sm">Keine Meldungen</li>
        )}
      </ul>

      {/* Ab md die gewohnte Tabelle. overflow-x-auto als Sicherung, damit sie
          auf Zwischenbreiten scrollbar bleibt statt abgeschnitten zu werden. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 text-xs text-gray-500">
              <th className="text-left px-5 py-2.5 font-medium">Titel</th>
              <th className="text-left px-3 py-2.5 font-medium">Melder</th>
              <th className="text-left px-3 py-2.5 font-medium">Status ändern</th>
              <th className="text-right px-5 py-2.5 font-medium">Datum</th>
              <th className="px-3 py-2.5"><span className="sr-only">Aktionen</span></th>
            </tr>
          </thead>
          <tbody>
            {sichtbare.map(m => (
              <Fragment key={m.id}>
                <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-800 max-w-[180px] truncate">{m.titel}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs">
                    {melderName(m)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">{statusButtons(m)}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs text-right whitespace-nowrap">
                    {datum(m)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">{zeilenAktionen(m)}</div>
                  </td>
                </tr>
                {expandedId === m.id && (
                  <tr className="border-b border-gray-100 bg-primary-50/40">
                    <td colSpan={5} className="px-5 py-4">
                      {detail(m)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {sichtbare.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-gray-500 text-sm">Keine Meldungen</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}