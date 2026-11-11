/**
 * Einziger Weg, über den die App Mails verschickt.
 *
 * In der Produktion liefert mailClient() unverändert den Resend-Client. In einer
 * Testumgebung (Preview oder dorfly-dev, siehe istVersandGesperrt) gehen Mails nur
 * an die Erlaubnisliste. Alle anderen Empfänger werden entfernt und protokolliert;
 * bleibt keiner übrig, wird nichts verschickt.
 */

import { Resend } from 'resend'
import { istVersandGesperrtAktuell } from '@/lib/previewUmgebung'

type SendeDaten = Parameters<Resend['emails']['send']>[0]
type SendeAntwort = Awaited<ReturnType<Resend['emails']['send']>>
export type MailClient = Pick<Resend, 'emails'>

/** Nur lukas.rosengruen+<irgendwas>@dorfly.de. */
const ERLAUBT = /^lukas\.rosengruen\+[^\s@+]+@dorfly\.de$/i

export function istErlaubterTestEmpfaenger(adresse: string): boolean {
  return ERLAUBT.test(adresse.trim())
}

/** Für das Protokoll: echte Adressen nicht im Klartext ablegen. */
export function maskiereAdresse(adresse: string): string {
  const [lokal, domain] = adresse.trim().split('@')
  if (!domain) return '***'
  return `${lokal.slice(0, 1)}***@${domain}`
}

const FELDER = ['to', 'cc', 'bcc'] as const

function alsListe(wert: string | string[] | undefined): string[] {
  if (wert === undefined) return []
  return Array.isArray(wert) ? wert : [wert]
}

/** Entfernt alle nicht erlaubten Empfänger. daten ist null, wenn kein Empfänger in "to" bleibt. */
export function filtereEmpfaenger(daten: SendeDaten): { daten: SendeDaten | null; entfernt: string[] } {
  const entfernt: string[] = []
  const gefiltert = { ...daten } as Record<string, unknown>

  for (const feld of FELDER) {
    const liste = alsListe(daten[feld])
    if (liste.length === 0) continue
    const erlaubt = liste.filter(istErlaubterTestEmpfaenger)
    entfernt.push(...liste.filter(a => !istErlaubterTestEmpfaenger(a)))
    if (erlaubt.length > 0) gefiltert[feld] = erlaubt
    else delete gefiltert[feld]
  }

  if (!gefiltert.to) return { daten: null, entfernt }
  return { daten: gefiltert as unknown as SendeDaten, entfernt }
}

function gesperrterClient(resend: Resend): MailClient {
  const send: Resend['emails']['send'] = async (daten, optionen) => {
    const { daten: erlaubt, entfernt } = filtereEmpfaenger(daten)
    if (entfernt.length > 0) {
      console.info('[mail] Testumgebung: nicht verschickt an', entfernt.map(maskiereAdresse), {
        betreff: daten.subject,
      })
    }
    if (!erlaubt) {
      return { data: { id: 'testumgebung-nicht-verschickt' }, error: null, headers: null } satisfies SendeAntwort
    }
    return resend.emails.send(erlaubt, optionen)
  }

  const emails = new Proxy(resend.emails, {
    get(ziel, name) {
      if (name === 'send' || name === 'create') return send
      const wert = Reflect.get(ziel, name, ziel)
      return typeof wert === 'function' ? wert.bind(ziel) : wert
    },
  })
  return { emails }
}

/**
 * Wirft wie bisher `new Resend()`, wenn kein Schlüssel gesetzt ist.
 * `gesperrt` nur für Tests überschreiben.
 */
export function mailClient(
  apiKey: string | undefined = process.env.RESEND_API_KEY,
  gesperrt: boolean = istVersandGesperrtAktuell(),
): MailClient {
  const resend = new Resend(apiKey)
  return gesperrt ? gesperrterClient(resend) : resend
}
