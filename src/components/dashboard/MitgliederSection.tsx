'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import type { MitgliedRolle, TeamDaten, ZielTyp } from '@/lib/mitgliedschaft'

interface Props {
  /** Nur für die Verwaltung. Mitglieder lassen das weg — es gilt ihr eigener Verein. */
  ziel?: { verein_id?: string; organisation_id?: string }
  /** Nach jedem Laden, z.B. um Zähler in der Verwaltungsliste zu aktualisieren. */
  onGeladen?: (daten: TeamDaten) => void
  /** Nach dem Löschen des Vereins. Ohne Angabe: Weiterleitung in den Feed. */
  onGeloescht?: () => void
}

const ROLLEN_LABEL: Record<MitgliedRolle, string> = { verwalter: 'Verwalter', autor: 'Autor' }
const TYP_LABEL: Record<ZielTyp, string> = { verein: 'Verein', organisation: 'Organisation', gewerbe: 'Betrieb' }

const hinzufuegenSchema = z.object({
  email: z.email('Bitte eine gültige E-Mail-Adresse eingeben.'),
  rolle: z.enum(['verwalter', 'autor']),
})
type HinzufuegenWerte = z.infer<typeof hinzufuegenSchema>

const loeschenSchema = z.object({ bestaetigung: z.string() })
type LoeschenWerte = z.infer<typeof loeschenSchema>

async function senden(method: string, url: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Die Aktion ist fehlgeschlagen.')
  return json
}

export default function MitgliederSection({ ziel, onGeladen, onGeloescht }: Props) {
  const query = new URLSearchParams(
    Object.entries(ziel ?? {}).filter((e): e is [string, string] => !!e[1]),
  ).toString()

  const [daten, setDaten] = useState<TeamDaten | null>(null)
  const [ladeFehler, setLadeFehler] = useState<string | null>(null)
  const [bestaetigeEntfernen, setBestaetigeEntfernen] = useState<string | null>(null)
  const [beschaeftigt, setBeschaeftigt] = useState(false)

  // onGeladen in einer Ref: Aufrufer duerfen Inline-Funktionen uebergeben, ohne dass
  // laden() sich aendert und einen Refetch-Loop ausloest.
  const onGeladenRef = useRef(onGeladen)
  useEffect(() => { onGeladenRef.current = onGeladen }, [onGeladen])

  const laden = useCallback(async () => {
    try {
      const res = await fetch(`/api/mitglieder${query ? `?${query}` : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Das Team konnte nicht geladen werden.')
      setDaten(json as TeamDaten)
      setLadeFehler(null)
      onGeladenRef.current?.(json as TeamDaten)
    } catch (e) {
      setLadeFehler(e instanceof Error ? e.message : 'Das Team konnte nicht geladen werden.')
    }
  }, [query])

  useEffect(() => { void laden() }, [laden])

  const form = useForm<HinzufuegenWerte>({
    resolver: zodResolver(hinzufuegenSchema),
    defaultValues: { email: '', rolle: 'autor' },
  })
  const loeschForm = useForm<LoeschenWerte>({ resolver: zodResolver(loeschenSchema), defaultValues: { bestaetigung: '' } })
  const eingetippt = loeschForm.watch('bestaetigung')

  async function aktion(fn: () => Promise<unknown>, erfolg: string) {
    setBeschaeftigt(true)
    try {
      await fn()
      toast.success(erfolg)
      await laden()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Aktion ist fehlgeschlagen.')
      return false
    } finally {
      setBeschaeftigt(false)
      setBestaetigeEntfernen(null)
    }
  }

  if (ladeFehler) return <p role="alert" className="text-sm text-red-700">{ladeFehler}</p>
  if (!daten) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> Team wird geladen …
      </p>
    )
  }

  const darfVerwalten = daten.recht !== 'autor'
  const istVerwaltung = daten.recht === 'verwaltung'
  const verwalterAnzahl = daten.mitglieder.filter(m => m.rolle === 'verwalter').length
  const ich = daten.mitglieder.find(m => m.ich)
  const ichLetzterVerwalter = ich?.rolle === 'verwalter' && verwalterAnzahl === 1
  const zielBody = { verein_id: ziel?.verein_id, organisation_id: ziel?.organisation_id }
  const idPrefix = `team-${daten.ziel.verein_id ?? daten.ziel.organisation_id}`

  const hinzufuegen = form.handleSubmit(async werte => {
    setBeschaeftigt(true)
    try {
      const res = await senden('POST', '/api/mitglieder', { ...zielBody, ...werte })
      toast.success(res.art === 'eingeladen'
        ? `Einladung an ${werte.email} verschickt.`
        : `${werte.email} wurde hinzugefügt.`)
      form.reset({ email: '', rolle: werte.rolle })
      await laden()
    } catch (e) {
      form.setError('email', { message: e instanceof Error ? e.message : 'Hinzufügen fehlgeschlagen.' })
    } finally {
      setBeschaeftigt(false)
    }
  })

  const loeschen = loeschForm.handleSubmit(async werte => {
    setBeschaeftigt(true)
    try {
      await senden('DELETE', '/api/mitglieder/verein', { ...zielBody, bestaetigung: werte.bestaetigung })
      toast.success(`„${daten.ziel.name}“ wurde gelöscht.`)
      if (onGeloescht) onGeloescht()
      else window.location.href = '/feed'
    } catch (e) {
      loeschForm.setError('bestaetigung', { message: e instanceof Error ? e.message : 'Löschen fehlgeschlagen.' })
    } finally {
      setBeschaeftigt(false)
    }
  })

  return (
    <div className="space-y-6">
      {/* Mitglieder */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-2">Mitglieder</h3>
        {daten.mitglieder.length === 0 && (
          <p className="text-sm text-gray-600">Noch keine Mitglieder. Fügen Sie unten eine Person als Verwalter hinzu.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {daten.mitglieder.map(m => (
            <li key={m.profile_id} className="py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{m.name}{m.ich && ' (Sie)'}</p>
                {m.email && <p className="text-xs text-gray-600 truncate">{m.email}</p>}
              </div>

              {darfVerwalten ? (
                <>
                  <label htmlFor={`${idPrefix}-rolle-${m.profile_id}`} className="sr-only">Rolle von {m.name}</label>
                  <select
                    id={`${idPrefix}-rolle-${m.profile_id}`}
                    value={m.rolle}
                    disabled={beschaeftigt}
                    onChange={e => aktion(
                      () => senden('PATCH', '/api/mitglieder', { profile_id: m.profile_id, rolle: e.target.value }),
                      'Rolle geändert.',
                    )}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
                  >
                    <option value="verwalter">Verwalter</option>
                    <option value="autor">Autor</option>
                  </select>
                </>
              ) : (
                <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">{ROLLEN_LABEL[m.rolle]}</span>
              )}

              {darfVerwalten && !m.ich && (
                bestaetigeEntfernen === m.profile_id ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-gray-700">Wirklich entfernen?</span>
                    <button type="button" disabled={beschaeftigt}
                      onClick={() => aktion(() => senden('DELETE', '/api/mitglieder', { profile_id: m.profile_id }), `${m.name} wurde entfernt.`)}
                      className="font-bold text-red-700">Ja</button>
                    <button type="button" onClick={() => setBestaetigeEntfernen(null)} className="text-gray-700">Abbrechen</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setBestaetigeEntfernen(m.profile_id)}
                    className="text-sm font-medium text-red-700">Entfernen</button>
                )
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Offene Einladungen */}
      {daten.einladungen.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-2">Offene Einladungen</h3>
          <ul className="divide-y divide-gray-100">
            {daten.einladungen.map(e => (
              <li key={e.id} className="py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate text-gray-900">{e.email}</span>
                <span className="text-xs text-gray-600">{ROLLEN_LABEL[e.mitglied_rolle]}</span>
                {darfVerwalten && (
                  <button type="button" disabled={beschaeftigt}
                    onClick={() => aktion(() => senden('DELETE', '/api/mitglieder/einladung', { ...zielBody, einladung_id: e.id }), 'Einladung zurückgezogen.')}
                    className="font-medium text-red-700">Zurückziehen</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hinzufügen */}
      {darfVerwalten && (
        <form onSubmit={hinzufuegen} noValidate className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Person hinzufügen</h3>
          <p className="text-xs text-gray-600">
            Hat die Person schon ein Konto in Ihrer Gemeinde, wird sie sofort hinzugefügt. Sonst bekommt sie eine Einladung per E-Mail.
            Eine Person kann nur einem Verein oder Betrieb angehören.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label htmlFor={`${idPrefix}-email`} className="block text-xs font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
              <input id={`${idPrefix}-email`} type="email" autoComplete="off" {...form.register('email')}
                aria-invalid={!!form.formState.errors.email}
                aria-describedby={form.formState.errors.email ? `${idPrefix}-email-fehler` : undefined}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-neu-rolle`} className="block text-xs font-medium text-gray-700 mb-1">Rolle</label>
              <select id={`${idPrefix}-neu-rolle`} {...form.register('rolle')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="autor">Autor (schreibt Beiträge)</option>
                <option value="verwalter">Verwalter (auch Profil und Team)</option>
              </select>
            </div>
            <div className="sm:self-end">
              <button type="submit" disabled={beschaeftigt}
                className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                <UserPlus aria-hidden="true" className="w-4 h-4" /> Hinzufügen
              </button>
            </div>
          </div>
          {form.formState.errors.email && (
            <p id={`${idPrefix}-email-fehler`} role="alert" className="text-sm text-red-700">{form.formState.errors.email.message}</p>
          )}
        </form>
      )}

      {/* Verlassen */}
      {ich && (
        <div>
          <button type="button" disabled={beschaeftigt || ichLetzterVerwalter}
            aria-describedby={ichLetzterVerwalter ? `${idPrefix}-verlassen-hinweis` : undefined}
            onClick={async () => {
              if (await aktion(() => senden('DELETE', '/api/mitglieder', { profile_id: ich.profile_id }), 'Sie haben das Team verlassen.')) {
                window.location.href = '/feed'
              }
            }}
            className="text-sm font-medium text-red-700 disabled:text-gray-500">
            {TYP_LABEL[daten.ziel.typ]} verlassen
          </button>
          {ichLetzterVerwalter && (
            <p id={`${idPrefix}-verlassen-hinweis`} className="text-xs text-gray-600 mt-1">
              Lege zuerst eine andere Person als Verwalter fest.
            </p>
          )}
        </div>
      )}

      {/* Gefahrenbereich */}
      {darfVerwalten && (
        <form onSubmit={loeschen} noValidate className="border border-red-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-red-700">{TYP_LABEL[daten.ziel.typ]} löschen</h3>
          <p className="text-sm text-gray-700">
            Gelöscht werden endgültig: {daten.umfang.beitraege} Beiträge, {daten.umfang.abonnenten} Abonnements
            und das Profil. {daten.mitglieder.length} {daten.mitglieder.length === 1 ? 'Mitglied verliert' : 'Mitglieder verlieren'} den Zugang
            {istVerwaltung ? '' : ', auch Sie'}.
          </p>
          <div>
            <label htmlFor={`${idPrefix}-bestaetigung`} className="block text-xs font-medium text-gray-700 mb-1">
              Zum Bestätigen „{daten.ziel.name}“ eintippen
            </label>
            <input id={`${idPrefix}-bestaetigung`} type="text" autoComplete="off" {...loeschForm.register('bestaetigung')}
              aria-invalid={!!loeschForm.formState.errors.bestaetigung}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          {loeschForm.formState.errors.bestaetigung && (
            <p role="alert" className="text-sm text-red-700">{loeschForm.formState.errors.bestaetigung.message}</p>
          )}
          <button type="submit" disabled={beschaeftigt || eingetippt.trim() !== daten.ziel.name.trim()}
            className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-40">
            Endgültig löschen
          </button>
        </form>
      )}
    </div>
  )
}
