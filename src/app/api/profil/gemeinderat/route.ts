import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { z } from 'zod'
import { normalizeSocialUsername } from '@/lib/social'

const usernameField = z
  .string()
  .max(100)
  .nullable()
  .optional()
  .transform(v => normalizeSocialUsername(v))

const schema = z.object({
  fraktion:         z.string().max(100).nullable().optional(),
  ueber_mich:       z.string().max(1000).nullable().optional(),
  kontakt_email:    z.string().email().max(200).nullable().optional(),
  avatar_url:       z.string().url().max(500).nullable().optional(),
  social_x:         usernameField,
  social_facebook:  usernameField,
  social_instagram: usernameField,
  social_tiktok:    usernameField,
})

export const PATCH = withAuth(
  async (req, { user }) => {
    const body = await req.json()
    const v = schema.safeParse(body)
    if (!v.success) return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })

    const supabase = await createClient()
    const { error } = await supabase
      .from('profiles')
      .update({
        fraktion:         v.data.fraktion,
        ueber_mich:       v.data.ueber_mich,
        kontakt_email:    v.data.kontakt_email,
        avatar_url:       v.data.avatar_url,
        social_x:         v.data.social_x ?? null,
        social_facebook:  v.data.social_facebook ?? null,
        social_instagram: v.data.social_instagram ?? null,
        social_tiktok:    v.data.social_tiktok ?? null,
      })
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['gemeinderat'] },
)
