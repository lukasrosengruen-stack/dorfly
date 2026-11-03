import { NextRequest, NextResponse } from 'next/server'
import { withAuth, apiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/server'
import {
  validate, mitgliedHinzufuegenSchema, mitgliedRolleAendernSchema, mitgliedEntfernenSchema,
} from '@/lib/validations'
import { bestimmeZiel, ladeTeam, rpcFehler } from '@/lib/mitgliedschaft'
import { absenderFuer, mitgliedPerEmailHinzufuegen } from '@/lib/mitgliedHinzufuegen'
import { sendeEinladungsEmail, sendeRollenentzugEmail, sendeRollenzuweisungEmail } from '@/lib/email'
import type { UserRole } from '@/types/database'

// Rechte prüfen die SQL-Funktionen (Migration 065). Die Akteur-ID kommt immer aus
// der Session; Mitglieder handeln immer für den eigenen Verein.
const ROLLEN: UserRole[] = ['verein', 'organisation', 'gewerbe', 'verwaltung', 'super_admin']

// GET /api/mitglieder[?verein_id=…|organisation_id=…] — Team des Vereins
export const GET = withAuth(async (req: NextRequest, { profile }) => {
  const service = await createServiceClient()
  const ziel = await bestimmeZiel(service, profile, {
    verein_id: req.nextUrl.searchParams.get('verein_id'),
    organisation_id: req.nextUrl.searchParams.get('organisation_id'),
  })
  if (!ziel.ok) return apiError(ziel.fehler, ziel.status)
  return NextResponse.json(await ladeTeam(service, ziel.ziel, profile.id))
}, { roles: ROLLEN })

// POST /api/mitglieder — Person per E-Mail hinzufügen oder einladen
export const POST = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(mitgliedHinzufuegenSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()
  const ziel = await bestimmeZiel(service, profile, v.data)
  if (!ziel.ok) return apiError(ziel.fehler, ziel.status)
  if (ziel.ziel.recht === 'autor') return apiError('Nur Verwalter können Personen hinzufügen.', 403)

  const { data: gemeinde } = await service.from('gemeinden').select('name, slug').eq('id', ziel.ziel.gemeinde_id).single()
  if (!gemeinde) return apiError('Gemeinde nicht gefunden', 404)

  const ergebnis = await mitgliedPerEmailHinzufuegen(
    { email: v.data.email, rolle: v.data.rolle, ziel: ziel.ziel, akteurId: profile.id, gemeinde },
    {
      profilPerEmail: async email => {
        const { data } = await service.from('profiles').select('id, gemeinde_id, display_name').eq('email', email).maybeSingle()
        return data
      },
      mitgliedHinzufuegen: async args => {
        const { error } = await service.rpc('mitglied_hinzufuegen', args)
        return { error }
      },
      einladungAnlegen: async daten => {
        // Nur offene Einladungen in DIESEN Verein/dieses Gewerbe widerrufen
        const { error: widerrufFehler } = await service
          .from('einladungen')
          .update({ status: 'widerrufen' })
          .eq('email', daten.email)
          .eq('gemeinde_id', daten.gemeinde_id)
          .eq('status', 'offen')
          .eq(daten.verein_id ? 'verein_id' : 'org_id', (daten.verein_id ?? daten.org_id)!)
        if (widerrufFehler) console.error('[mitglieder] Alte Einladungen widerrufen fehlgeschlagen:', widerrufFehler)
        const { data, error } = await service.from('einladungen').insert(daten).select('token').single()
        if (error || !data) {
          console.error('[mitglieder] Einladung anlegen fehlgeschlagen:', error)
          return { fehler: 'Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.' }
        }
        const { error: logFehler } = await service.from('rollen_log').insert({
          gemeinde_id: daten.gemeinde_id,
          aktion: 'eingeladen',
          ziel_email: daten.email,
          neue_rolle: daten.rolle,
          ausgefuehrt_von: profile.id,
        })
        if (logFehler) console.error('[mitglieder] rollen_log (eingeladen) fehlgeschlagen:', logFehler)
        return { token: data.token }
      },
      sendeZuweisung: p => sendeRollenzuweisungEmail(p),
      sendeEinladung: p => sendeEinladungsEmail(p),
    },
  )

  if (!ergebnis.ok) return apiError(ergebnis.fehler, ergebnis.status)
  return NextResponse.json(ergebnis)
}, { roles: ROLLEN })

// PATCH /api/mitglieder — Mitgliedsrolle ändern
export const PATCH = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(mitgliedRolleAendernSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()
  const { error } = await service.rpc('mitglied_rolle_aendern', {
    p_profile_id: v.data.profile_id,
    p_rolle: v.data.rolle,
    p_ausgefuehrt_von: profile.id,
  })
  if (error) {
    const f = rpcFehler(error)
    return apiError(f.meldung, f.status)
  }
  return NextResponse.json({ ok: true })
}, { roles: ROLLEN })

// DELETE /api/mitglieder — Mitglied entfernen; mit der eigenen ID: austreten
export const DELETE = withAuth(async (req: NextRequest, { profile }) => {
  const v = validate(mitgliedEntfernenSchema, await req.json())
  if (!v.success) return v.error

  const service = await createServiceClient()

  // Für die Mail vorher lesen — nach dem Entfernen ist die Zuordnung weg
  const ziel = await bestimmeZiel(service, profile, {})
  const { data: person } = await service
    .from('profiles')
    .select('email, display_name, role, gemeinde_id, gemeinden(name)')
    .eq('id', v.data.profile_id)
    .maybeSingle()

  const { error } = await service.rpc('mitglied_entfernen', {
    p_profile_id: v.data.profile_id,
    p_ausgefuehrt_von: profile.id,
  })
  if (error) {
    const f = rpcFehler(error)
    return apiError(f.meldung, f.status)
  }

  // Wer selbst austritt, bekommt keine Mail
  if (person?.email && v.data.profile_id !== profile.id) {
    const gemeindeName = (person.gemeinden as { name: string } | null)?.name ?? ''
    try {
      await sendeRollenentzugEmail({
        to: person.email,
        name: person.display_name,
        gemeindeName,
        alteRolle: person.role,
        absender: ziel.ok ? absenderFuer(ziel.ziel) : null,
      })
    } catch (e) {
      console.error('[mitglieder] Mail beim Entfernen fehlgeschlagen:', e)
    }
  }

  return NextResponse.json({ ok: true })
}, { roles: ROLLEN })
