/**
 * Ausnahmen für Vercel-Previews, die gegen dorfly-dev laufen.
 *
 * Preview-Adressen liegen auf *.vercel.app. Dort gibt es keine Gemeinde-Subdomain,
 * Cookies für .dorfly.de werden vom Browser verworfen, und Weiterleitungen auf
 * <slug>.dorfly.de würden das Preview verlassen.
 *
 * Alle Ausnahmen hängen an istPreview(). Das verlangt VERCEL_ENV=preview UND die
 * Supabase-URL von dorfly-dev. Fehlt eines davon, verhält sich alles wie bisher:
 * Auch ein falsch gesetztes VERCEL_ENV schaltet gegen die Produktionsdatenbank
 * also nichts frei. Slug und Projekt stehen bewusst fest im Code und nicht in
 * einer Umgebungsvariable.
 */

export const PREVIEW_GEMEINDE_SLUG = 'testdorf'

const DEV_SUPABASE_HOST = 'vjvnhvwdwxvofwsjcytr.supabase.co'
const PREVIEW_HOST_ENDUNG = '-dorfly-ug.vercel.app'

interface Umgebung {
  vercelEnv: string | undefined
  supabaseUrl: string | undefined
}

function hostVon(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function istPreview({ vercelEnv, supabaseUrl }: Umgebung): boolean {
  return vercelEnv === 'preview' && hostVon(supabaseUrl) === DEV_SUPABASE_HOST
}

export function previewGemeindeSlug(host: string, umgebung: Umgebung): string | null {
  if (!istPreview(umgebung)) return null
  const ohnePort = host.replace(/:\d+$/, '')
  if (ohnePort.length <= PREVIEW_HOST_ENDUNG.length) return null
  return ohnePort.endsWith(PREVIEW_HOST_ENDUNG) ? PREVIEW_GEMEINDE_SLUG : null
}

// Im Browser gibt es nur die NEXT_PUBLIC-Variante; next.config.ts setzt sie beim
// Build aus VERCEL_ENV. Die Zugriffe müssen ausgeschrieben bleiben, sonst kann
// Next die Werte nicht ins Bundle einsetzen.
function aktuelleUmgebung(): Umgebung {
  return {
    vercelEnv: process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }
}

export function istPreviewUmgebung(): boolean {
  return istPreview(aktuelleUmgebung())
}

export function previewGemeindeSlugFuerHost(host: string): string | null {
  return previewGemeindeSlug(host, aktuelleUmgebung())
}

export function authCookieDomain(rootDomain: string): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined
  if (istPreviewUmgebung()) return undefined
  return `.${rootDomain}`
}
