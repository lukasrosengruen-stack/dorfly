export type ShareCtaZiele = {
  primaer: string
  sekundaer: string | null
}

/**
 * Ziele der beiden CTAs auf der oeffentlichen Post-Seite (/posts/[id]).
 *
 * Seit dem Gastzugang ist Registrierung nicht mehr der einzige Weg: Wer den
 * geteilten Link oeffnet, soll auch ohne Anmeldung weiterlesen koennen. Ohne
 * Gemeinde-Slug (Apex-Domain) leitet die Middleware /feed allerdings nach
 * /homepage um — dort entfaellt der Gast-CTA, statt ins Leere zu fuehren.
 */
export function shareCtaZiele(slug: string | null): ShareCtaZiele {
  if (!slug) {
    return { primaer: '/homepage', sekundaer: null }
  }
  return { primaer: '/login', sekundaer: '/feed' }
}
