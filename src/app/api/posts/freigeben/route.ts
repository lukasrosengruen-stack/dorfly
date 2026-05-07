import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api'
import { validate, postFreigebenSchema } from '@/lib/validations'

export const POST = withAuth(
  async (req, { profile }) => {
    const body = await req.json()
    const v = validate(postFreigebenSchema, body)
    if (!v.success) return v.error

    const { postId, action } = v.data
    const service = await createServiceClient()

    let publishedAt = new Date().toISOString()
    if (action === 'publish') {
      const { data: postData } = await service.from('posts').select('publish_at').eq('id', postId).single()
      if (postData?.publish_at && new Date(postData.publish_at) > new Date()) {
        publishedAt = postData.publish_at
      }
    }

    const { error } = await service.from('posts').update({
      status: action === 'publish' ? 'published' : 'rejected',
      published_at: action === 'publish' ? publishedAt : undefined,
      ...(action === 'publish' && v.data.sichtbarkeit
        ? { sichtbarkeit: v.data.sichtbarkeit }
        : {}),
    }).eq('id', postId).eq('gemeinde_id', profile.gemeinde_id!)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  },
  { roles: ['verwaltung', 'super_admin'] },
)
