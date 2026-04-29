import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: Request) {
  try {
    const { name, gemeinde, email, nachricht } = await req.json()

    if (!name || !gemeinde || !email) {
      return NextResponse.json({ error: 'Pflichtfelder fehlen.' }, { status: 400 })
    }

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Dorfly Demo <noreply@dorfly.de>',
        to: 'lukas.rosengruen@gmail.com',
        replyTo: email,
        subject: `Demo-Anfrage von ${name} – ${gemeinde}`,
        html: `
          <h2 style="font-family:sans-serif;color:#0D1B2A;">Neue Demo-Anfrage</h2>
          <table style="font-family:sans-serif;font-size:15px;border-collapse:collapse;width:100%;">
            <tr><td style="padding:8px 0;color:#64748B;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;color:#0D1B2A;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#64748B;">Gemeinde</td><td style="padding:8px 0;font-weight:600;color:#0D1B2A;">${gemeinde}</td></tr>
            <tr><td style="padding:8px 0;color:#64748B;">E-Mail</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#0057A8;">${email}</a></td></tr>
            ${nachricht ? `<tr><td style="padding:8px 0;color:#64748B;vertical-align:top;">Nachricht</td><td style="padding:8px 0;color:#0D1B2A;">${nachricht.replace(/\n/g, '<br>')}</td></tr>` : ''}
          </table>
        `,
      })
    } else {
      console.log('[Demo-Anfrage]', { name, gemeinde, email, nachricht })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/demo]', err)
    return NextResponse.json({ error: 'Serverfehler.' }, { status: 500 })
  }
}
