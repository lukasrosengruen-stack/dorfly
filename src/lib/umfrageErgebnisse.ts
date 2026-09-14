import type { FrageErgebnis } from '@/types/umfrage'

/** Eine Zeile aus der RPC `umfrage_ergebnisse`. */
export type ErgebnisZeile = {
  frage_id: string
  option_id: string | null
  antwort_text: string | null
  anzahl: number
}

/** Das, was die Auswertung von einer Frage braucht — bewusst schmaler als der DB-Typ. */
export type FrageEingabe = {
  id: string
  frage_text: string
  typ: string
  umfrage_optionen?: { id: string; option_text: string; reihenfolge: number }[]
}

/**
 * Rechnet die von der Datenbank ausgezaehlten Antwortzeilen in Anzeigewerte um.
 *
 * Die Funktion lag vorher inline im Dashboard und war ungetestet. Sie ist die
 * einzige Stelle mit echter Rechenlogik (Prozente, Rundung, gewichteter
 * Durchschnitt), deshalb liegt sie jetzt eigenstaendig und unter Test.
 *
 * Bei null Antworten wird durch 1 statt durch 0 geteilt — so entstehen 0 Prozent
 * statt NaN.
 */
export function berechneErgebnisse(
  fragen: FrageEingabe[],
  antworten: ErgebnisZeile[],
): FrageErgebnis[] {
  return fragen.map(frage => {
    const eigene = antworten.filter(a => a.frage_id === frage.id)

    if (frage.typ === 'ja_nein') {
      const ja = eigene.filter(a => a.antwort_text === 'ja').reduce((s, a) => s + a.anzahl, 0)
      const nein = eigene.filter(a => a.antwort_text === 'nein').reduce((s, a) => s + a.anzahl, 0)
      const teiler = ja + nein || 1
      return {
        frage_id: frage.id,
        frage_text: frage.frage_text,
        typ: 'ja_nein' as const,
        gesamt_antworten: ja + nein,
        optionen: [
          { label: 'Ja', anzahl: ja, prozent: Math.round((ja / teiler) * 100) },
          { label: 'Nein', anzahl: nein, prozent: Math.round((nein / teiler) * 100) },
        ],
      }
    }

    if (frage.typ === 'bewertung') {
      const summeAnzahl = eigene.reduce((s, a) => s + a.anzahl, 0)
      const summeGewichtet = eigene.reduce((s, a) => s + parseInt(a.antwort_text ?? '0') * a.anzahl, 0)
      return {
        frage_id: frage.id,
        frage_text: frage.frage_text,
        typ: 'bewertung' as const,
        gesamt_antworten: summeAnzahl,
        durchschnitt: summeAnzahl ? summeGewichtet / summeAnzahl : 0,
        optionen: [1, 2, 3, 4, 5].map(stufe => {
          const anzahl = eigene.find(a => parseInt(a.antwort_text ?? '') === stufe)?.anzahl ?? 0
          return { label: String(stufe), anzahl, prozent: Math.round((anzahl / (summeAnzahl || 1)) * 100) }
        }),
      }
    }

    // Kopie vor dem Sortieren: Eine reine Funktion soll ihre Eingabe nicht
    // veraendern. Die Fassung im Dashboard sortierte das uebergebene Array
    // direkt.
    const optionen = [...(frage.umfrage_optionen ?? [])].sort((a, b) => a.reihenfolge - b.reihenfolge)
    const gesamt = eigene.reduce((s, a) => s + a.anzahl, 0)
    const teiler = gesamt || 1
    return {
      frage_id: frage.id,
      frage_text: frage.frage_text,
      typ: frage.typ as 'einzelauswahl' | 'mehrfachauswahl',
      gesamt_antworten: gesamt,
      optionen: optionen.map(o => {
        const anzahl = eigene.find(a => a.option_id === o.id)?.anzahl ?? 0
        return { label: o.option_text, anzahl, prozent: Math.round((anzahl / teiler) * 100), option_id: o.id }
      }),
    }
  })
}
