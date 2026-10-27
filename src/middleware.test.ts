import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import proxy from './middleware'

// Öffentliche Rechtsseiten müssen auf der Hauptdomain ohne Anmeldung und ohne
// Umleitung auf /homepage ausgeliefert werden. /konto-loeschen ist in der
// Google Play Console hinterlegt und darf nie umgeleitet werden.

const HOSTS = ['dorfly.de', 'www.dorfly.de']
const OEFFENTLICH = ['/konto-loeschen', '/datenschutz', '/impressum', '/support']

function anfrage(host: string, pfad: string) {
  return new NextRequest(`https://${host}${pfad}`, { headers: { host } })
}

describe('middleware auf der Hauptdomain', () => {
  for (const host of HOSTS) {
    for (const pfad of OEFFENTLICH) {
      it(`liefert ${host}${pfad} ohne Umleitung aus`, async () => {
        const res = await proxy(anfrage(host, pfad))
        expect(res.status).toBe(200)
        expect(res.headers.get('location')).toBeNull()
        expect(res.headers.get('x-middleware-rewrite')).toBeNull()
        expect(res.headers.get('x-middleware-next')).toBe('1')
      })
    }

    it(`schreibt ${host}/ auf /homepage um`, async () => {
      const res = await proxy(anfrage(host, '/'))
      expect(res.headers.get('x-middleware-rewrite')).toMatch(/\/homepage$/)
    })

    it(`leitet ${host} bei App-Routen auf /homepage um`, async () => {
      const res = await proxy(anfrage(host, '/feed'))
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toMatch(/\/homepage$/)
    })
  }
})
