import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ermittleScrollContainer, istGanzOben } from './scrollNachOben'

type Fake = {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
  parentElement: Fake | null
  overflowY: string
}

function el(scrollHeight: number, clientHeight: number, overflowY = 'visible', parentElement: Fake | null = null): Fake {
  return { scrollHeight, clientHeight, scrollTop: 0, parentElement, overflowY }
}

function umgebungSetzen(dokument: Fake | null, hauptinhalt: Fake | null) {
  ;(globalThis as { document?: unknown }).document = {
    scrollingElement: dokument,
    getElementById: (id: string) => (id === 'main-content' ? hauptinhalt : null),
  }
  ;(globalThis as { window?: unknown }).window = {
    getComputedStyle: (e: Fake) => ({ overflowY: e.overflowY }),
  }
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document
  delete (globalThis as { window?: unknown }).window
})

describe('istGanzOben', () => {
  it('meldet oben, wenn es gar keinen Container gibt', () => {
    expect(istGanzOben(null)).toBe(true)
  })

  it('duldet ein paar Pixel Toleranz, damit Gummiband-Scrollen nicht stoert', () => {
    expect(istGanzOben({ scrollTop: 0 } as unknown as HTMLElement)).toBe(true)
    expect(istGanzOben({ scrollTop: 8 } as unknown as HTMLElement)).toBe(true)
    expect(istGanzOben({ scrollTop: 40 } as unknown as HTMLElement)).toBe(false)
  })
})

describe('ermittleScrollContainer', () => {
  it('nimmt das Dokument, wenn das Dokument scrollt – der heutige Normalfall', () => {
    const dokument = el(4000, 800)
    umgebungSetzen(dokument, el(4000, 4000))

    expect(ermittleScrollContainer()).toBe(dokument as unknown as HTMLElement)
  })

  it('findet einen eigenen Scroll-Container, wenn das Dokument nicht scrollt', () => {
    const container = el(4000, 800, 'auto')
    const hauptinhalt = el(4000, 4000, 'visible', container)
    umgebungSetzen(el(800, 800), hauptinhalt)

    expect(ermittleScrollContainer()).toBe(container as unknown as HTMLElement)
  })

  it('ueberspringt scrollbar gesetzte Vorfahren ohne Ueberlauf', () => {
    const echterContainer = el(4000, 800, 'scroll')
    const attrappe = el(500, 500, 'auto', echterContainer)
    const hauptinhalt = el(4000, 4000, 'visible', attrappe)
    umgebungSetzen(el(800, 800), hauptinhalt)

    expect(ermittleScrollContainer()).toBe(echterContainer as unknown as HTMLElement)
  })

  it('faellt auf das Dokument zurueck, wenn nichts scrollt', () => {
    const dokument = el(800, 800)
    umgebungSetzen(dokument, el(800, 800))

    expect(ermittleScrollContainer()).toBe(dokument as unknown as HTMLElement)
  })

  it('kommt ohne document klar (Server-Rendering)', () => {
    expect(ermittleScrollContainer()).toBeNull()
  })
})
