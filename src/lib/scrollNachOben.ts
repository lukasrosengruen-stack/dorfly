/**
 * Scroll-to-top fuer den Tap auf den bereits aktiven Tab (iOS-/Android-Konvention).
 */

/**
 * Ermittelt, was tatsaechlich scrollt.
 *
 * Heute scrollt in Dorfly das Dokument: die Layouts setzen min-h-screen, aber
 * keinen eigenen Overflow-Container. Das kann sich pro Seite aendern, deshalb
 * wird gemessen statt angenommen — und erst wenn das Dokument nachweislich
 * nicht scrollt, wird der naechste scrollbare Vorfahr des Hauptinhalts gesucht.
 */
export function ermittleScrollContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null

  const dokument = document.scrollingElement as HTMLElement | null
  if (dokument && dokument.scrollHeight > dokument.clientHeight + 1) return dokument

  let el: HTMLElement | null = document.getElementById('main-content')
  while (el) {
    const overflowY = window.getComputedStyle(el).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
      return el
    }
    el = el.parentElement
  }

  return dokument
}

/** true, wenn der Inhalt praktisch schon ganz oben steht. */
export function istGanzOben(container: HTMLElement | null): boolean {
  return !container || container.scrollTop <= 8
}

/**
 * Scrollt nach oben und uebergibt den Fokus an die Seitenueberschrift, damit
 * Screenreader- und Tastaturnutzer den Sprung mitbekommen und nicht weiter
 * unten im Dokument stehen bleiben (SC 2.4.3).
 *
 * prefers-reduce-motion: kein weiches Scrollen, sondern sofort springen.
 */
export function scrollNachOben(container: HTMLElement | null): void {
  if (!container) return

  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  container.scrollTo({ top: 0, behavior: reduziert ? 'auto' : 'smooth' })

  fokusAufSeitenanfang()
}

function fokusAufSeitenanfang(): void {
  const haupt = document.getElementById('main-content')
  // Die Ueberschrift ist das sprechendere Ziel als der Container: der
  // Screenreader liest "Neuigkeiten, Ueberschrift Ebene 1" statt den ganzen
  // Hauptbereich von vorn.
  const ziel = (haupt?.querySelector('h1') as HTMLElement | null) ?? haupt
  if (!ziel) return

  if (!ziel.hasAttribute('tabindex')) ziel.setAttribute('tabindex', '-1')
  // preventScroll: sonst springt der Browser sofort hin und das weiche
  // Scrollen waere nie zu sehen.
  ziel.focus({ preventScroll: true })
}
