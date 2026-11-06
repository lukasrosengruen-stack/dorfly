/// <reference types="vite/client" />
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const ladeansichten = import.meta.glob<{ default: ComponentType }>('./**/loading.tsx', { eager: true })

/** Seiten mit eigenem Skelett und ein Text, den die fertige Seite ebenfalls zeigt. */
const SEITEN: [route: string, erkennungstext: string | null][] = [
  ['home', 'Was möchtest du heute tun?'],
  ['feed', 'Neuigkeiten'],
  ['vereine', 'Vereine &amp; Organisationen'],
  ['vereine/[id]', null],
  ['lokale-angebote', 'Lokale Angebote'],
  ['lokale-angebote/[id]', null],
  ['maengel', 'Mängelmelder'],
  ['umfragen', 'Deine Meinung zählt'],
  ['veranstaltungen', 'Veranstaltungen'],
  ['abfallkalender', 'Abfallkalender'],
  ['abfallkalender/einstellungen', 'Abfallkalender · Einstellungen'],
  ['gemeinderat', 'Gemeinderat'],
  ['buergermeister', 'Meine Fragen'],
  ['profil', 'Profil'],
  ['profil/datenschutz-daten', 'Datenschutz &amp; Daten'],
  ['warnmeldungen', 'Warnmeldungen'],
]

function rendern(route: string) {
  const modul = ladeansichten[`./${route}/loading.tsx`]
  expect(modul, `${route}/loading.tsx fehlt`).toBeDefined()
  return renderToStaticMarkup(createElement(modul.default))
}

describe('Ladeansichten', () => {
  it.each(SEITEN)('%s hat ein eigenes Skelett mit passendem Inhalt', (route, erkennungstext) => {
    const html = rendern(route)
    if (erkennungstext) expect(html).toContain(erkennungstext)
  })

  it('unterscheiden sich von Seite zu Seite', () => {
    const inhalte = SEITEN.map(([route]) => rendern(route))
    expect(new Set(inhalte).size).toBe(SEITEN.length)
  })

  it.each(Object.keys(ladeansichten))('%s ist fuer Screenreader als Ladezustand erkennbar', pfad => {
    const html = renderToStaticMarkup(createElement(ladeansichten[pfad].default))

    expect(html).toContain('role="status"')
    expect(html).toContain('Seite wird geladen')
  })

  it.each(Object.keys(ladeansichten))('%s enthaelt nichts Fokussierbares im versteckten Bereich', pfad => {
    const html = renderToStaticMarkup(createElement(ladeansichten[pfad].default))

    expect(html).not.toMatch(/<(a|button|input|textarea|select)[\s>]/)
  })

  it.each(Object.keys(ladeansichten))('%s verzichtet auf Animation bei reduzierter Bewegung', pfad => {
    const html = renderToStaticMarkup(createElement(ladeansichten[pfad].default))

    expect(html).not.toMatch(/(^|[\s"])animate-pulse/)
    expect(html).toContain('motion-safe:animate-pulse')
  })
})
