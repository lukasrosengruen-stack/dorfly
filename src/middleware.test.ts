import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('middleware auf Vercel-Adressen', () => {
  const DEV_URL = 'https://vjvnhvwdwxvofwsjcytr.supabase.co'
  const PROD_URL = 'https://hzptnylfdfibijkgtfhf.supabase.co'
  const HOST = 'dorfly-production-git-feat-preview-testdorf-dorfly-ug.vercel.app'
  const SLUG_HEADER = 'x-middleware-request-x-gemeinde-slug'

  afterEach(() => vi.unstubAllEnvs())

  function umgebung(vercelEnv: string, supabaseUrl: string) {
    vi.stubEnv('VERCEL_ENV', vercelEnv)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)
  }

  it('setzt im Preview gegen dorfly-dev die Testgemeinde', async () => {
    umgebung('preview', DEV_URL)
    const res = await proxy(anfrage(HOST, '/home'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get(SLUG_HEADER)).toBe('testdorf')
  })

  it('setzt in Production auf derselben Adresse keine Gemeinde', async () => {
    umgebung('production', PROD_URL)
    const res = await proxy(anfrage(HOST, '/home'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/\/homepage$/)
    expect(res.headers.get(SLUG_HEADER)).toBeNull()
  })

  it('setzt im Preview gegen die Produktionsdatenbank keine Gemeinde', async () => {
    umgebung('preview', PROD_URL)
    const res = await proxy(anfrage(HOST, '/home'))
    expect(res.headers.get('location')).toMatch(/\/homepage$/)
    expect(res.headers.get(SLUG_HEADER)).toBeNull()
  })

  it('verwirft in Production einen gefälschten Gemeinde-Header', async () => {
    umgebung('production', PROD_URL)
    const res = await proxy(new NextRequest(`https://${HOST}/impressum`, {
      headers: { host: HOST, 'x-gemeinde-slug': 'testdorf' },
    }))
    expect(res.headers.get(SLUG_HEADER)).toBeNull()
  })

  it('lässt echte Subdomains im Preview unverändert', async () => {
    umgebung('preview', DEV_URL)
    const res = await proxy(anfrage('ehningen.dorfly.de', '/home'))
    expect(res.headers.get(SLUG_HEADER)).toBe('ehningen')
  })
})

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
