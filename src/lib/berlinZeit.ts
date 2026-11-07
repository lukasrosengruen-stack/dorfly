/**
 * Datum und Stunde in deutscher Zeit. Vercel-Funktionen und Crons laufen in UTC;
 * über Europe/Berlin stimmen Sommer- und Winterzeit ohne eigene Umrechnung.
 */
const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

export function berlinZeit(zeitpunkt: Date): { datum: string; stunde: number } {
  const teile = Object.fromEntries(FORMAT.formatToParts(zeitpunkt).map(t => [t.type, t.value]))
  return { datum: `${teile.year}-${teile.month}-${teile.day}`, stunde: Number(teile.hour) }
}

/** Folgetag eines Kalenderdatums 'YYYY-MM-DD', unabhängig von Zeitzonen. */
export function naechsterTag(datum: string): string {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  return new Date(Date.UTC(jahr, monat - 1, tag + 1)).toISOString().slice(0, 10)
}
