'use server'

/**
 * Server Actions – Profil
 *
 * Warum Server Action statt API-Route?
 * - Nur die Web-App benutzt Profil-Bearbeitung (kein React-Native-Bedarf)
 * - Kein manuelles fetch() / JSON.stringify nötig
 * - revalidatePath sorgt dafür, dass die Seite nach dem Speichern neu geladen wird
 *
 * Aufgerufen aus: (app)/profil/ProfilClient.tsx
 */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface UpdateProfilInput {
  vorname: string
  nachname: string
}

export interface UpdateProfilResult {
  success: boolean
  error?: string
}

/**
 * updateProfil – Speichert Vor- und Nachname des eingeloggten Nutzers.
 *
 * Gibt { success: true } zurück, oder { success: false, error: '...' }.
 */
export async function updateProfil(input: UpdateProfilInput): Promise<UpdateProfilResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Nicht angemeldet' }
    }

    const displayName = [input.vorname, input.nachname].filter(Boolean).join(' ') || null

    const { error } = await supabase
      .from('profiles')
      .update({
        vorname:      input.vorname || null,
        nachname:     input.nachname || null,
        display_name: displayName,
      })
      .eq('id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/profil')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler' }
  }
}
