import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export const POST = withAuth(
  async (req: NextRequest) => {
    const body = await req.json()
    const { name, bundesland, plz, slug: customSlug } = body

    if (!name?.trim()) return apiError('Name ist erforderlich', 400)
    if (!bundesland?.trim()) return apiError('Bundesland ist erforderlich', 400)

    const slug = customSlug?.trim() || toSlug(name.trim())
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return apiError('Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten', 400)
    }

    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('gemeinden')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existing) return apiError(`Slug "${slug}" ist bereits vergeben`, 409)

    const { data, error } = await supabase
      .from('gemeinden')
      .insert({
        name: name.trim(),
        bundesland: bundesland.trim(),
        slug,
        plz: plz?.trim() || null,
      })
      .select()
      .single()

    if (error) return apiError(error.message)

    return NextResponse.json({ gemeinde: data })
  },
  { roles: ['super_admin'] },
)
