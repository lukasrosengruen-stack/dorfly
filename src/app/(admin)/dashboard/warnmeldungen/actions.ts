// src/app/(admin)/dashboard/warnmeldungen/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const warnmeldungSchema = z.object({
  titel: z.string().min(1, 'Titel erforderlich').max(200),
  inhalt: z.string().min(1, 'Beschreibung erforderlich'),
  severity: z.number().int().min(1).max(4),
  sendPush: z.boolean(),
})

export type WarnmeldungFormValues = z.infer<typeof warnmeldungSchema>

export async function createWarnmeldungAction(values: WarnmeldungFormValues): Promise<{ success?: boolean; error?: string }> {
  try {
    const parsed = warnmeldungSchema.safeParse(values)
    if (!parsed.success) return { error: 'Ungültige Eingabe' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Nicht angemeldet' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, gemeinde_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'verwaltung') return { error: 'Keine Berechtigung' }
    if (!profile.gemeinde_id) return { error: 'Keine Gemeinde zugewiesen' }

    const service = await createServiceClient()

    const { error: insertError } = await service.from('posts').insert({
      gemeinde_id: profile.gemeinde_id,
      author_id: user.id,
      channel: 'warnung',
      titel: parsed.data.titel,
      inhalt: parsed.data.inhalt,
      severity: parsed.data.severity,
      is_active: true,
      pinned: true,
      status: 'published',
    } as any)

    if (insertError) {
      console.error('[Warnmeldung] Insert-Fehler:', insertError)
      return { error: `Fehler beim Erstellen: ${insertError.message}` }
    }

    if (parsed.data.sendPush) {
      const { data: gemeinde } = await service
        .from('gemeinden')
        .select('slug')
        .eq('id', profile.gemeinde_id)
        .single()

      if (gemeinde) {
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), 5000)
        await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify({
            app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
            filters: [{ field: 'tag', key: 'gemeinde_slug', relation: '=', value: gemeinde.slug }],
            headings: { de: 'Warnmeldung', en: 'Warnmeldung' },
            contents: { de: parsed.data.titel, en: parsed.data.titel },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/warnmeldungen`,
          }),
          signal: controller.signal,
        }).catch((e) => console.error('[Warnmeldung] Push-Fehler:', e))
          .finally(() => clearTimeout(tid))
      }
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    console.error('[Warnmeldung] Unbekannter Fehler:', e)
    return { error: 'Unbekannter Fehler beim Erstellen der Warnmeldung' }
  }
}
