import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  authCookieDomain,
  istPreview,
  istPreviewUmgebung,
  previewGemeindeSlug,
  previewGemeindeSlugFuerHost,
} from './previewUmgebung'

const DEV_URL = 'https://vjvnhvwdwxvofwsjcytr.supabase.co'
const PROD_URL = 'https://hzptnylfdfibijkgtfhf.supabase.co'
const PREVIEW_HOST = 'dorfly-production-git-feat-preview-testdorf-dorfly-ug.vercel.app'
const PREVIEW = { vercelEnv: 'preview', supabaseUrl: DEV_URL }

describe('previewGemeindeSlug', () => {
  it('liefert testdorf nur im abgesicherten Preview', () => {
    expect(previewGemeindeSlug(PREVIEW_HOST, PREVIEW)).toBe('testdorf')
    expect(previewGemeindeSlug('dorfly-production-abc123-dorfly-ug.vercel.app', PREVIEW)).toBe('testdorf')
  })

  for (const vercelEnv of ['production', 'development', 'PREVIEW', '', undefined]) {
    it(`greift nicht bei VERCEL_ENV=${String(vercelEnv)}`, () => {
      expect(previewGemeindeSlug(PREVIEW_HOST, { vercelEnv, supabaseUrl: DEV_URL })).toBeNull()
    })
  }

  for (const supabaseUrl of [PROD_URL, undefined, '', 'keine-url', `https://evil.de/${DEV_URL}`, 'https://vjvnhvwdwxvofwsjcytr.supabase.co.evil.de']) {
    it(`greift nicht bei Supabase-URL ${String(supabaseUrl)}`, () => {
      expect(previewGemeindeSlug(PREVIEW_HOST, { vercelEnv: 'preview', supabaseUrl })).toBeNull()
    })
  }

  for (const host of [
    'dorfly-production.vercel.app',
    'fremdes-projekt-anderes-team.vercel.app',
    'fremd-dorfly-ug.vercel.app.evil.de',
    '-dorfly-ug.vercel.app',
    'ehningen.dorfly.de',
    'dorfly.de',
    '',
  ]) {
    it(`greift nicht auf Host "${host}"`, () => {
      expect(previewGemeindeSlug(host, PREVIEW)).toBeNull()
    })
  }
})

describe('Umgebungsvariablen', () => {
  afterEach(() => vi.unstubAllEnvs())

  function stub(vercelEnv: string, supabaseUrl: string) {
    vi.stubEnv('VERCEL_ENV', vercelEnv)
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', vercelEnv)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl)
    vi.stubEnv('NODE_ENV', 'production')
  }

  it('Production: keine Ausnahme, Cookie-Domain unverändert', () => {
    stub('production', PROD_URL)
    expect(istPreviewUmgebung()).toBe(false)
    expect(previewGemeindeSlugFuerHost(PREVIEW_HOST)).toBeNull()
    expect(authCookieDomain('dorfly.de')).toBe('.dorfly.de')
  })

  it('Production mit Dev-Datenbank: trotzdem keine Ausnahme', () => {
    stub('production', DEV_URL)
    expect(istPreviewUmgebung()).toBe(false)
    expect(authCookieDomain('dorfly.de')).toBe('.dorfly.de')
  })

  it('Preview mit Produktionsdatenbank: keine Ausnahme', () => {
    stub('preview', PROD_URL)
    expect(istPreviewUmgebung()).toBe(false)
    expect(authCookieDomain('dorfly.de')).toBe('.dorfly.de')
  })

  it('Preview mit dorfly-dev: Ausnahme aktiv, keine Cookie-Domain', () => {
    stub('preview', DEV_URL)
    expect(istPreviewUmgebung()).toBe(true)
    expect(previewGemeindeSlugFuerHost(PREVIEW_HOST)).toBe('testdorf')
    expect(authCookieDomain('dorfly.de')).toBeUndefined()
  })

  it('Browser: die NEXT_PUBLIC-Variante allein reicht', () => {
    stub('', DEV_URL)
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    expect(istPreview({ vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV, supabaseUrl: DEV_URL })).toBe(true)
    expect(istPreviewUmgebung()).toBe(true)
  })

  it('Lokal: keine Ausnahme und keine Cookie-Domain', () => {
    stub('', DEV_URL)
    vi.stubEnv('NODE_ENV', 'development')
    expect(istPreviewUmgebung()).toBe(false)
    expect(authCookieDomain('dorfly.de')).toBeUndefined()
  })
})
