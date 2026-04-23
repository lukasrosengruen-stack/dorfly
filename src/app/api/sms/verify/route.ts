import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json()
    if (!phone || !code) {
      return NextResponse.json({ error: 'Fehlende Parameter' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: verification } = await supabase
      .from('sms_verifications')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!verification) {
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Code' }, { status: 400 })
    }

    // Code als genutzt markieren
    await supabase
      .from('sms_verifications')
      .update({ used: true })
      .eq('id', verification.id)

    // Supabase-User anlegen oder anmelden (phone als Email-Proxy)
    const fakeEmail = `${phone.replace(/\+/g, '')}@dorfly.app`
    const password = `dorfly_${verification.id}` // einmaliges Passwort, wird sofort ersetzt

    // Versuche bestehenden User zu finden
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const found = existingUser?.users?.find(u => u.email === fakeEmail)

    let userId: string

    if (found) {
      userId = found.id
      // Magic-Link Token für sofortige Session
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: fakeEmail,
      })
      return NextResponse.json({ success: true, link: linkData?.properties?.action_link, userId })
    } else {
      // Neuen User anlegen
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password,
        email_confirm: true,
        user_metadata: { phone },
      })
      if (error || !newUser.user) {
        return NextResponse.json({ error: 'User konnte nicht erstellt werden' }, { status: 500 })
      }
      userId = newUser.user.id

      // Profil anlegen
      await supabase.from('profiles').insert({
        id: userId,
        phone,
        phone_verified: true,
        role: 'buerger',
      })

      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: fakeEmail,
      })
      return NextResponse.json({ success: true, link: linkData?.properties?.action_link, userId, isNew: true })
    }
  } catch (error) {
    console.error('SMS verify error:', error)
    return NextResponse.json({ error: 'Verifizierung fehlgeschlagen' }, { status: 500 })
  }
}
