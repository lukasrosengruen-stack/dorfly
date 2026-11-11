import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushKonfig } from './pushKonfig'

const VOLL = { appId: 'app', apiKey: 'key' }

describe('pushKonfig', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('Produktion mit Variablen: an', () => {
    expect(pushKonfig(VOLL, false)).toEqual({ status: 'an', appId: 'app', apiKey: 'key' })
  })

  it('Produktion ohne Variablen: fehlt, wie bisher ein Fehler', () => {
    expect(pushKonfig({ appId: undefined, apiKey: 'key' }, false)).toEqual({ status: 'fehlt' })
    expect(pushKonfig({ appId: 'app', apiKey: '' }, false)).toEqual({ status: 'fehlt' })
  })

  it('Testumgebung: nie an, auch wenn die Variablen gesetzt sind', () => {
    expect(pushKonfig(VOLL, true)).toEqual({ status: 'testumgebung' })
    expect(pushKonfig({ appId: undefined, apiKey: undefined }, true)).toEqual({ status: 'testumgebung' })
  })

  it('liest Umgebung: Preview ist gesperrt, Production nicht', () => {
    vi.stubEnv('NEXT_PUBLIC_ONESIGNAL_APP_ID', 'app')
    vi.stubEnv('ONESIGNAL_REST_API_KEY', 'key')

    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(pushKonfig().status).toBe('testumgebung')

    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://vjvnhvwdwxvofwsjcytr.supabase.co')
    expect(pushKonfig().status).toBe('an')
  })
})
