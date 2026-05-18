'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, ExternalLink, Loader2, Building2, X } from 'lucide-react'
import type { Gemeinde } from './types'

const BUNDESLAENDER = [
  'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen',
  'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
  'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen',
  'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
]

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'dorfly.de'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type Props = { gemeinden: Gemeinde[] }

export default function GemeindenSection({ gemeinden: initial }: Props) {
  const router = useRouter()
  const [gemeinden, setGemeinden] = useState<Gemeinde[]>(initial)
  const [formOffen, setFormOffen] = useState(false)
  const [laden, setLaden] = useState(false)

  const [name, setName] = useState('')
  const [bundesland, setBundesland] = useState('')
  const [plz, setPlz] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuell, setSlugManuell] = useState(false)

  function nameAendern(val: string) {
    setName(val)
    if (!slugManuell) setSlug(toSlug(val))
  }

  function slugAendern(val: string) {
    setSlug(val)
    setSlugManuell(true)
  }

  function formZuruecksetzen() {
    setName(''); setBundesland(''); setPlz(''); setSlug('')
    setSlugManuell(false); setFormOffen(false)
  }

  async function anlegen() {
    if (!name.trim() || !bundesland || !slug.trim()) {
      toast.error('Bitte Name, Bundesland und Slug ausfüllen')
      return
    }
    setLaden(true)
    try {
      const res = await fetch('/api/admin/gemeinden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), bundesland, plz: plz.trim() || null, slug: slug.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setGemeinden(prev => [...prev, data.gemeinde].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success(`Gemeinde "${data.gemeinde.name}" angelegt`)
      formZuruecksetzen()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler beim Anlegen')
    } finally {
      setLaden(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">Gemeinden</h2>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{gemeinden.length}</span>
        </div>
        {!formOffen && (
          <button
            onClick={() => setFormOffen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Neue Gemeinde
          </button>
        )}
      </div>

      <div className="p-6 space-y-5">

        {/* Formular */}
        {formOffen && (
          <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-indigo-900">Neue Gemeinde anlegen</h3>
              <button onClick={formZuruecksetzen} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => nameAendern(e.target.value)}
                  placeholder="z. B. Musterbach"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Bundesland *</label>
                <select
                  value={bundesland}
                  onChange={e => setBundesland(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">Bitte wählen</option>
                  {BUNDESLAENDER.map(bl => (
                    <option key={bl} value={bl}>{bl}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">PLZ</label>
                <input
                  type="text"
                  value={plz}
                  onChange={e => setPlz(e.target.value)}
                  placeholder="z. B. 83714"
                  maxLength={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Slug *
                  <span className="ml-1 text-gray-400 font-normal">(URL-Subdomain)</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={slug}
                    onChange={e => slugAendern(e.target.value)}
                    placeholder="musterbach"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                  />
                </div>
                {slug && (
                  <p className="text-xs text-indigo-600 font-mono">{slug}.{ROOT_DOMAIN}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={formZuruecksetzen}
                className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={anlegen}
                disabled={laden || !name.trim() || !bundesland || !slug.trim()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors"
              >
                {laden ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Anlegen
              </button>
            </div>
          </div>
        )}

        {/* Tabelle */}
        {gemeinden.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Noch keine Gemeinden angelegt</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Subdomain</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Bundesland</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">PLZ</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Einwohner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gemeinden.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://${g.slug}.${ROOT_DOMAIN}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        {g.slug}.{ROOT_DOMAIN}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{g.bundesland}</td>
                    <td className="px-4 py-3 text-gray-500">{g.plz ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {g.einwohner != null ? g.einwohner.toLocaleString('de-DE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
