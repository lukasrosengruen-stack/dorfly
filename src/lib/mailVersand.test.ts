import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Resend } from 'resend'
import { filtereEmpfaenger, istErlaubterTestEmpfaenger, mailClient, maskiereAdresse } from './mailVersand'

const ERLAUBT = 'lukas.rosengruen+testdorf@dorfly.de'
const MAIL = { from: 'Dorfly <noreply@dorfly.de>', subject: 'Test', html: '<p>x</p>' }

describe('istErlaubterTestEmpfaenger', () => {
  for (const adresse of [ERLAUBT, 'lukas.rosengruen+musterhausen@dorfly.de', 'Lukas.Rosengruen+X@Dorfly.de', ' lukas.rosengruen+a@dorfly.de ']) {
    it(`erlaubt ${adresse}`, () => expect(istErlaubterTestEmpfaenger(adresse)).toBe(true))
  }

  for (const adresse of [
    'lukas.rosengruen@dorfly.de',
    'lukas.rosengruen+@dorfly.de',
    'lukas.rosengruen+a+b@dorfly.de',
    'lukas.rosengruen+a@dorfly.de.evil.de',
    'lukas.rosengruen+a@evil-dorfly.de',
    'xlukas.rosengruen+a@dorfly.de',
    'lukasXrosengruen+a@dorfly.de',
    'hallo@dorfly.de',
    'buerger@testdorf.invalid',
    'anna@example.de',
    '',
  ]) {
    it(`sperrt "${adresse}"`, () => expect(istErlaubterTestEmpfaenger(adresse)).toBe(false))
  }
})

describe('filtereEmpfaenger', () => {
  it('lässt nur erlaubte Empfänger in to, cc und bcc', () => {
    const { daten, entfernt } = filtereEmpfaenger({
      ...MAIL,
      to: [ERLAUBT, 'anna@example.de'],
      cc: 'bernd@example.de',
      bcc: ['lukas.rosengruen+bcc@dorfly.de'],
    })

    expect(daten).toMatchObject({ to: [ERLAUBT], bcc: ['lukas.rosengruen+bcc@dorfly.de'] })
    expect(daten).not.toHaveProperty('cc')
    expect(entfernt).toEqual(['anna@example.de', 'bernd@example.de'])
  })

  it('verschickt nichts, wenn in to niemand übrig bleibt, auch wenn bcc erlaubt wäre', () => {
    const { daten } = filtereEmpfaenger({ ...MAIL, to: 'anna@example.de', bcc: ERLAUBT })
    expect(daten).toBeNull()
  })
})

it('maskiert Adressen für das Protokoll', () => {
  expect(maskiereAdresse('anna.muster@example.de')).toBe('a***@example.de')
  expect(maskiereAdresse('kaputt')).toBe('***')
})

describe('mailClient', () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'resend-id' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))

  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function gesendeteEmpfaenger(): unknown {
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    return JSON.parse(String(init.body)).to
  }

  it('Production: liefert den unveränderten Resend-Client und verschickt an jeden', async () => {
    const client = mailClient('re_test', false)
    expect(client).toBeInstanceOf(Resend)

    await client.emails.send({ ...MAIL, to: 'anna@example.de' })
    expect(gesendeteEmpfaenger()).toBe('anna@example.de')
  })

  it('Production über die Umgebung: VERCEL_ENV=production ist nie gesperrt, auch mit dorfly-dev', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://vjvnhvwdwxvofwsjcytr.supabase.co')
    expect(mailClient('re_test')).toBeInstanceOf(Resend)
  })

  it('Preview über die Umgebung: gesperrt', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const client = mailClient('re_test')
    expect(client).not.toBeInstanceOf(Resend)

    await client.emails.send({ ...MAIL, to: 'anna@example.de' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Testumgebung: verschickt nichts an fremde Adressen und meldet keinen Fehler', async () => {
    const antwort = await mailClient('re_test', true).emails.send({ ...MAIL, to: ['anna@example.de'] })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(antwort.error).toBeNull()
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('nicht verschickt'), ['a***@example.de'], { betreff: 'Test' })
  })

  it('Testumgebung: verschickt an die erlaubte Adresse und entfernt die übrigen', async () => {
    await mailClient('re_test', true).emails.send({ ...MAIL, to: [ERLAUBT, 'anna@example.de'] })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(gesendeteEmpfaenger()).toEqual([ERLAUBT])
  })

  it('Testumgebung: auch der Alias emails.create ist gesperrt', async () => {
    await mailClient('re_test', true).emails.create({ ...MAIL, to: 'anna@example.de' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Kein Versand an der Sperre vorbei', () => {
  const SRC = path.resolve(__dirname, '..')

  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap(name => {
      const voll = path.join(ordner, name)
      if (statSync(voll).isDirectory()) return dateien(voll)
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [voll] : []
    })
  }

  const quellen = dateien(SRC).map(datei => ({
    datei: path.relative(SRC, datei).replaceAll('\\', '/'),
    text: readFileSync(datei, 'utf8'),
  }))

  it('nur mailVersand.ts importiert resend', () => {
    const treffer = quellen.filter(q => /from ['"]resend['"]/.test(q.text)).map(q => q.datei)
    expect(treffer).toEqual(['lib/mailVersand.ts'])
  })

  it('nur pushKonfig.ts liest die OneSignal-Zugangsdaten und kennt die Versand-URL', () => {
    const treffer = quellen
      .filter(q => /ONESIGNAL_REST_API_KEY|onesignal\.com\/api\/v1\/notifications/.test(q.text))
      .map(q => q.datei)
    expect(treffer).toEqual(['lib/pushKonfig.ts'])
  })
})
