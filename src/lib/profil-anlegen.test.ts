/**
 * Test für die Bürger-Willkommensmail beim Anlegen des Profils: Sie geht nur an
 * neue Bürger, nicht an Vereins- und Gewerbe-Teams (die haben ihre eigene Mail),
 * und nur einmal.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeSupabase, hatOp, type Abfrage, type Antwort } from '@/lib/testing/supabaseFake'

const NUTZER = '11111111-1111-4111-8111-111111111111'
const GEMEINDE = '22222222-2222-4222-8222-222222222222'

const hilfen = vi.hoisted(() => ({
  nachAntwort: [] as (() => unknown)[],
  mail: vi.fn(async () => ({ error: null })),
}))

vi.mock('next/server', async original => ({
  ...(await original<typeof import('next/server')>()),
  after: (aufgabe: () => unknown) => { hilfen.nachAntwort.push(aufgabe) },
}))
vi.mock('@/lib/email', () => ({ sendeBuergerWillkommensEmail: hilfen.mail }))
vi.mock('@/lib/gemeinde', () => ({ getGemeindeSlug: async () => 'ehningen' }))

let service: ReturnType<typeof fakeSupabase>
let publicClient: ReturnType<typeof fakeSupabase>
let profilVorhanden: boolean
let einladung: Record<string, unknown> | null

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => service.client,
  createClient: async () => publicClient.client,
}))

function serviceResponder(a: Abfrage): Antwort | undefined {
  if (a.tabelle === 'profiles' && hatOp(a, 'single')) return { data: profilVorhanden ? { id: NUTZER } : null }
  if (a.tabelle === 'einladungen' && hatOp(a, 'single')) {
    return { data: einladung ? { id: 'e1', rolle: einladung.rolle, verein_id: 'v1', org_id: null, organisation_name: null, gemeinde_id: GEMEINDE } : null }
  }
  if (a.tabelle === 'gemeinden') {
    return { data: { name: 'Ehningen', slug: 'ehningen', features: { vereine: true } } }
  }
  return undefined
}

function publicResponder(a: Abfrage): Antwort | undefined {
  if (a.tabelle === 'gemeinden') return { data: { id: GEMEINDE } }
  return undefined
}

async function anlegen(daten: Parameters<typeof import('./profil-anlegen').profilAnlegen>[1]) {
  const { profilAnlegen } = await import('./profil-anlegen')
  await profilAnlegen(NUTZER, daten)
  for (const aufgabe of hilfen.nachAntwort) await aufgabe()
}

beforeEach(() => {
  service = fakeSupabase(serviceResponder)
  publicClient = fakeSupabase(publicResponder, () => ({ data: einladung }))
  profilVorhanden = false
  einladung = null
  hilfen.nachAntwort.length = 0
  hilfen.mail.mockClear()
})

describe('profilAnlegen: Bürger-Willkommensmail', () => {
  it('schickt neuen Buergern die Willkommensmail', async () => {
    await anlegen({ email: 'anna@example.de', vorname: 'Anna', nachname: 'Muster' })

    expect(hilfen.mail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      to: 'anna@example.de',
      vorname: 'Anna',
      hatName: true,
      gemeindeName: 'Ehningen',
      gemeindeSlug: 'ehningen',
      features: { vereine: true },
    }))
  })

  it('weist Buerger ohne Namen darauf hin, ihn einzutragen', async () => {
    await anlegen({ email: 'anna@example.de' })

    expect(hilfen.mail).toHaveBeenCalledWith(expect.objectContaining({ vorname: null, hatName: false }))
  })

  it('verschickt die Mail erst nach der Antwort', async () => {
    const { profilAnlegen } = await import('./profil-anlegen')
    await profilAnlegen(NUTZER, { email: 'anna@example.de' })

    expect(hilfen.mail).not.toHaveBeenCalled()
    expect(hilfen.nachAntwort).toHaveLength(1)
  })

  it('schickt Vereins-Teams keine Buergermail', async () => {
    einladung = { status: 'offen', email: 'anna@example.de', gemeinde_id: GEMEINDE, rolle: 'verein' }

    await anlegen({ email: 'anna@example.de', token: 'abc' })

    expect(hilfen.mail).not.toHaveBeenCalled()
  })

  it('schickt keine zweite Mail, wenn das Profil schon existiert', async () => {
    profilVorhanden = true

    await anlegen({ email: 'anna@example.de' })

    expect(hilfen.mail).not.toHaveBeenCalled()
  })

  it('schickt keine Mail, wenn keine E-Mail-Adresse bekannt ist', async () => {
    await anlegen({})

    expect(hilfen.mail).not.toHaveBeenCalled()
  })
})
