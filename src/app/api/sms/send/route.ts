import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createServiceClient } from '@/lib/supabase/server'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return '+49' + digits.slice(1)
  if (!digits.startsWith('49')) return '+49' + digits
  return '+' + digits
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone) return NextResponse.json({ error: 'Telefonnummer fehlt' }, { status: 400 })

    const normalized = normalizePhone(phone)
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

    const supabase = await createServiceClient()

    // Alten Code für diese Nummer invalidieren
    await supabase
      .from('sms_verifications')
      .update({ used: true })
      .eq('phone', normalized)
      .eq('used', false)

    await supabase.from('sms_verifications').insert({
      phone: normalized,
      code,
      expires_at: expiresAt,
    })

    await twilioClient.messages.create({
      body: `Dein Dorfly-Code: ${code} (gültig 10 Min.)`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: normalized,
    })

    return NextResponse.json({ success: true, phone: normalized })
  } catch (error) {
    console.error('SMS send error:', error)
    return NextResponse.json({ error: 'SMS konnte nicht gesendet werden' }, { status: 500 })
  }
}
