import { Resend } from 'resend'

const FROM = `Dorfly <noreply@${process.env.RESEND_FROM_DOMAIN ?? 'dorfly.de'}>`

const ROLLEN_LABEL: Record<string, string> = {
  buerger: 'Bürger:in',
  verein: 'Vereinsverantwortliche:r',
  organisation: 'Organisationsverantwortliche:r',
  gewerbe: 'Gewerbetreibende:r',
  gemeinderat: 'Gemeinderat/rätin',
}

function resend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendeEinladungsEmail(params: {
  to: string
  gemeindeName: string
  rolle: string
  organisationName?: string | null
  hinweis?: string | null
  token: string
}) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/login?token=${params.token}`
  const rolleLabel = ROLLEN_LABEL[params.rolle] ?? params.rolle

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a">Einladung zu Dorfly ${params.gemeindeName}</h2>
      <p>Hallo,</p>
      <p>die Gemeindeverwaltung <strong>${params.gemeindeName}</strong> lädt Sie ein, sich bei Dorfly zu registrieren.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Ihre Rolle:</td>
          <td style="padding:4px 0"><strong>${rolleLabel}</strong></td>
        </tr>
        ${params.organisationName ? `
        <tr>
          <td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Für:</td>
          <td style="padding:4px 0"><strong>${params.organisationName}</strong></td>
        </tr>` : ''}
        ${params.hinweis ? `
        <tr>
          <td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Hinweis:</td>
          <td style="padding:4px 0">${params.hinweis}</td>
        </tr>` : ''}
      </table>
      <a href="${link}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:8px 0">
        Jetzt registrieren
      </a>
      <p style="color:#999;font-size:13px;margin-top:24px">
        Diese Einladung ist 7 Tage gültig.<br>
        Falls Sie diese E-Mail nicht erwartet haben, können Sie sie ignorieren.
      </p>
    </div>
  `

  return resend().emails.send({
    from: FROM,
    to: [params.to],
    subject: `Einladung: ${params.gemeindeName} auf Dorfly`,
    html,
  })
}

export async function sendeRollenentzugEmail(params: {
  to: string
  name: string | null
  gemeindeName: string
  alteRolle: string
}) {
  const alteRolleLabel = ROLLEN_LABEL[params.alteRolle] ?? params.alteRolle

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a">Änderung Ihrer Rolle in Dorfly</h2>
      <p>Hallo${params.name ? ` ${params.name}` : ''},</p>
      <p>die Gemeindeverwaltung <strong>${params.gemeindeName}</strong> hat Ihre Rolle in Dorfly geändert.</p>
      <p>Ihre bisherige Rolle als <strong>${alteRolleLabel}</strong> wurde entzogen.</p>
      <p>Sie sind weiterhin als <strong>Bürger:in</strong> in Dorfly registriert und können die App normal nutzen.</p>
      <p style="color:#999;font-size:13px;margin-top:24px">
        Bei Fragen wenden Sie sich bitte an Ihre Gemeindeverwaltung.
      </p>
    </div>
  `

  return resend().emails.send({
    from: FROM,
    to: [params.to],
    subject: `Dorfly ${params.gemeindeName}: Ihre Rolle wurde geändert`,
    html,
  })
}

export async function sendeRollenzuweisungEmail(params: {
  to: string
  name: string | null
  gemeindeName: string
  neueRolle: string
  organisationName?: string | null
}) {
  const neueRolleLabel = ROLLEN_LABEL[params.neueRolle] ?? params.neueRolle

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#1a1a1a">Neue Rolle in Dorfly</h2>
      <p>Hallo${params.name ? ` ${params.name}` : ''},</p>
      <p>die Gemeindeverwaltung <strong>${params.gemeindeName}</strong> hat Ihnen eine neue Rolle zugewiesen.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Ihre neue Rolle:</td>
          <td style="padding:4px 0"><strong>${neueRolleLabel}</strong></td>
        </tr>
        ${params.organisationName ? `
        <tr>
          <td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Für:</td>
          <td style="padding:4px 0"><strong>${params.organisationName}</strong></td>
        </tr>` : ''}
      </table>
      <p>Sie können sich jetzt unter <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">Ihr Dashboard</a> anmelden.</p>
    </div>
  `

  return resend().emails.send({
    from: FROM,
    to: [params.to],
    subject: `Dorfly ${params.gemeindeName}: Neue Rolle zugewiesen`,
    html,
  })
}
