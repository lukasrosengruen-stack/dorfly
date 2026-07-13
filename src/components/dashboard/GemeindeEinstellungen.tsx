'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { Settings, Check, X, Loader2 } from 'lucide-react'
import { getContrastRatio } from '@/lib/contrast'
import { createClient } from '@/lib/supabase/client'

interface Props {
  gemeindeId: string
  initialEinwohner: number | null
  initialHaushalte: number | null
  initialRatsinformationUrl: string | null
  initialNotfallnummernUrl: string | null
  initialHomepageUrl: string | null
  initialMitteilungsblattUrl: string | null
  initialWarncellId: string | null
  initialPrimaryColor: string | null
  initialAccentColor: string | null
  initialLogoUrl: string | null
}

const DIENSTE = [
  { key: 'ratsinformation_url',  label: 'Ratsinformationssystem', placeholder: 'https://ris.gemeinde.de' },
  { key: 'notfallnummern_url',   label: 'Notfallnummern',         placeholder: 'https://...' },
  { key: 'homepage_url',         label: 'Homepage',               placeholder: 'https://www.gemeinde.de' },
  { key: 'mitteilungsblatt_url', label: 'Mitteilungsblatt',       placeholder: 'https://...' },
] as const

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
}

export default function GemeindeEinstellungen({
  gemeindeId,
  initialEinwohner,
  initialHaushalte,
  initialRatsinformationUrl,
  initialNotfallnummernUrl,
  initialHomepageUrl,
  initialMitteilungsblattUrl,
  initialWarncellId,
  initialPrimaryColor,
  initialAccentColor,
  initialLogoUrl,
}: Props) {
  const [open, setOpen] = useState(false)
  const [einwohner, setEinwohner] = useState(String(initialEinwohner ?? ''))
  const [haushalte, setHaushalte] = useState(String(initialHaushalte ?? ''))
  const [warncellId, setWarncellId] = useState(initialWarncellId ?? '')
  const [urls, setUrls] = useState({
    ratsinformation_url:  initialRatsinformationUrl  ?? '',
    notfallnummern_url:   initialNotfallnummernUrl   ?? '',
    homepage_url:         initialHomepageUrl         ?? '',
    mitteilungsblatt_url: initialMitteilungsblattUrl ?? '',
  })
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor ?? '#0f2d6b')
  const [accentColor, setAccentColor] = useState(initialAccentColor ?? '#e8a020')
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error('Nur PNG, JPEG oder SVG erlaubt')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Datei zu groß (max. 2 MB)')
      return
    }

    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const ext = EXT_BY_TYPE[file.type] ?? 'png'
      const path = `gemeinden/${gemeindeId}/logo_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('dorfly-media').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('dorfly-media').getPublicUrl(path)
      setLogoUrl(publicUrl)
    } catch {
      toast.error('Logo-Upload fehlgeschlagen')
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  const primaryContrast = HEX_RE.test(primaryColor) ? getContrastRatio(primaryColor, '#ffffff') : null
  const accentVsPrimaryContrast = (HEX_RE.test(accentColor) && HEX_RE.test(primaryColor))
    ? getContrastRatio(accentColor, primaryColor)
    : null
  const accentVsWhiteContrast = HEX_RE.test(accentColor)
    ? getContrastRatio(accentColor, '#ffffff')
    : null

  async function save() {
    setLoading(true)
    try {
      const res = await fetch('/api/gemeinde/aktualisieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemeindeId,
          einwohner: einwohner ? parseInt(einwohner) : null,
          haushalte: haushalte ? parseInt(haushalte) : null,
          warncell_id: warncellId,
          primary_color: primaryColor,
          accent_color: accentColor,
          logo_url: logoUrl || null,
          ...urls,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Unbekannter Fehler')
      setSaved(true)
      setTimeout(() => { setSaved(false); setOpen(false) }, 1200)
    } catch (e: unknown) {
      toast.error('Fehler beim Speichern: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <Settings className="w-3.5 h-3.5" />
        Gemeinde-Einstellungen
      </button>

      {open && (
        <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          {/* Design */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Design</p>

            <div className="space-y-3">
              <div>
                <label htmlFor="primary-color-hex" className="text-xs text-gray-500 block mb-1">Primärfarbe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={HEX_RE.test(primaryColor) ? primaryColor : '#0f2d6b'}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer"
                    aria-label="Primärfarbe auswählen"
                  />
                  <input
                    id="primary-color-hex"
                    type="text"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    placeholder="#0f2d6b"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {primaryContrast !== null && primaryContrast < 4.5 && (
                  <p role="status" className="text-xs text-amber-700 mt-1">
                    Kontrast zu Weiß ist niedrig ({primaryContrast.toFixed(1)}:1) – heller Text auf dieser Farbe könnte schwer lesbar sein.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="accent-color-hex" className="text-xs text-gray-500 block mb-1">Akzentfarbe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={HEX_RE.test(accentColor) ? accentColor : '#e8a020'}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-gray-300 cursor-pointer"
                    aria-label="Akzentfarbe auswählen"
                  />
                  <input
                    id="accent-color-hex"
                    type="text"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    placeholder="#e8a020"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {accentVsPrimaryContrast !== null && accentVsPrimaryContrast < 4.5 && (
                  <p role="status" className="text-xs text-amber-700 mt-1">
                    Kontrast zur Primärfarbe ist niedrig ({accentVsPrimaryContrast.toFixed(1)}:1) – der Gemeindename-Schriftzug im App-Header könnte schwer lesbar sein.
                  </p>
                )}
                {accentVsWhiteContrast !== null && accentVsWhiteContrast < 4.5 && (
                  <p role="status" className="text-xs text-amber-700 mt-1">
                    Kontrast zu Weiß ist niedrig ({accentVsWhiteContrast.toFixed(1)}:1) – helle Schrift auf dieser Farbe (z.B. in Badges) könnte schwer lesbar sein.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Gemeindewappen / Logo</label>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Wappen-Vorschau" className="w-12 h-12 rounded-lg object-contain border border-gray-200 bg-white" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                      Kein Logo
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <span className="text-xs font-bold text-primary-500 bg-primary-50 px-3 py-2 rounded-lg">
                      {uploadingLogo ? 'Lädt…' : 'Bild auswählen'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoChange}
                      disabled={uploadingLogo}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Statistiken */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Einwohnerzahl</label>
              <input
                type="number"
                value={einwohner}
                onChange={e => setEinwohner(e.target.value)}
                placeholder="z.B. 7500"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Anzahl Haushalte</label>
              <input
                type="number"
                value={haushalte}
                onChange={e => setHaushalte(e.target.value)}
                placeholder="z.B. 3200"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Online-Dienste */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Online-Dienste</p>
            <div className="space-y-2">
              {DIENSTE.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input
                    type="url"
                    value={urls[key]}
                    onChange={e => setUrls(u => ({ ...u, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Leer lassen = Kachel wird nicht angezeigt</p>
          </div>

          {/* DWD Warnmeldungen */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">DWD Warnmeldungen</p>
            <label className="text-xs text-gray-500 block mb-1">Warn-Cell-ID</label>
            <input
              type="text"
              value={warncellId}
              onChange={e => setWarncellId(e.target.value)}
              placeholder="z.B. 808115013"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Numerische ID aus der Bright Sky API (z.B. über <code className="bg-gray-100 px-1 rounded">api.brightsky.dev/alerts?lat=…&lon=…</code>). Leer lassen = keine DWD-Warnungen.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={loading || saved}
              className="flex items-center gap-1.5 bg-primary-500 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
              {saved ? 'Gespeichert' : 'Speichern'}
            </button>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
