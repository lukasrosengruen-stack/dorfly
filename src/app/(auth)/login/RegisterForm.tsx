'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TERMS_VERSION } from '@/lib/constants'
import { registerFormSchema, type RegisterFormValues } from './schema'

export interface EinladungsInfo {
  email: string
  rolle: string
  organisation_name: string | null
  gemeinde_name: string
}

interface RegisterFormProps {
  einladungsToken: string | null
  einladungsInfo: EinladungsInfo | null
  onRegistered: () => void
}

export default function RegisterForm({ einladungsToken, einladungsInfo, onRegistered }: RegisterFormProps) {
  const [showOptional, setShowOptional] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const supabase = createClient()

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: einladungsInfo?.email ?? '',
      password: '',
      vorname: '',
      nachname: '',
      ageConfirmed: false,
      termsAccepted: false,
    },
  })

  useEffect(() => {
    if (einladungsInfo?.email) form.setValue('email', einladungsInfo.email)
  }, [einladungsInfo, form])

  async function onSubmit(values: RegisterFormValues) {
    setSubmitError('')
    const now = new Date().toISOString()
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          vorname: values.vorname || undefined,
          nachname: values.nachname || undefined,
          einladungs_token: einladungsToken || undefined,
          age_confirmed_at: now,
          terms_accepted_at: now,
          terms_version: TERMS_VERSION,
        },
      },
    })
    if (error) {
      setSubmitError(error.message.includes('already registered') ? 'E-Mail bereits registriert' : error.message)
      return
    }
    onRegistered()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div>
        <label htmlFor="register-email" className="sr-only">E-Mail-Adresse</label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          readOnly={!!einladungsInfo}
          placeholder="E-Mail-Adresse"
          className={`w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 ${einladungsInfo ? 'bg-gray-50 text-gray-500' : ''}`}
          aria-invalid={!!form.formState.errors.email}
          aria-describedby={form.formState.errors.email ? 'register-email-error' : undefined}
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p role="alert" id="register-email-error" className="text-red-500 text-xs mt-1">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="register-password" className="sr-only">Passwort</label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="Passwort"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-invalid={!!form.formState.errors.password}
          aria-describedby={form.formState.errors.password ? 'register-password-error' : undefined}
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p role="alert" id="register-password-error" className="text-red-500 text-xs mt-1">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowOptional(v => !v)}
          className="flex items-center gap-2 text-sm text-primary-500 font-medium py-1"
          aria-expanded={showOptional}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-180' : ''}`} />
          Weitere Angaben (optional)
        </button>

        {showOptional && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label htmlFor="register-vorname" className="sr-only">Vorname</label>
              <input
                id="register-vorname"
                type="text"
                autoComplete="given-name"
                placeholder="Vorname"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...form.register('vorname')}
              />
            </div>
            <div>
              <label htmlFor="register-nachname" className="sr-only">Nachname</label>
              <input
                id="register-nachname"
                type="text"
                autoComplete="family-name"
                placeholder="Nachname"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                {...form.register('nachname')}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="register-age-confirmed"
            type="checkbox"
            className="w-4 h-4 mt-0.5 text-primary-500 rounded focus:ring-primary-500"
            aria-invalid={!!form.formState.errors.ageConfirmed}
            aria-describedby={form.formState.errors.ageConfirmed ? 'register-age-confirmed-error' : undefined}
            {...form.register('ageConfirmed')}
          />
          <label htmlFor="register-age-confirmed" className="text-sm text-gray-700">
            Ich bin mindestens 16 Jahre alt.
          </label>
        </div>
        {form.formState.errors.ageConfirmed && (
          <p role="alert" id="register-age-confirmed-error" className="text-red-500 text-xs mt-1">
            {form.formState.errors.ageConfirmed.message}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id="register-terms-accepted"
            type="checkbox"
            className="w-4 h-4 mt-0.5 text-primary-500 rounded focus:ring-primary-500"
            aria-invalid={!!form.formState.errors.termsAccepted}
            aria-describedby={form.formState.errors.termsAccepted ? 'register-terms-accepted-error' : undefined}
            {...form.register('termsAccepted')}
          />
          <label htmlFor="register-terms-accepted" className="text-sm text-gray-700">
            Ich akzeptiere die{' '}
            <a href="/nutzungsbedingungen" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
              Nutzungsbedingungen
            </a>{' '}
            und habe die{' '}
            <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">
              Datenschutzerklärung
            </a>{' '}
            zur Kenntnis genommen.
          </label>
        </div>
        {form.formState.errors.termsAccepted && (
          <p role="alert" id="register-terms-accepted-error" className="text-red-500 text-xs mt-1">
            {form.formState.errors.termsAccepted.message}
          </p>
        )}
      </div>

      {submitError && (
        <p role="alert" className="text-red-500 text-sm">{submitError}</p>
      )}

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
      >
        {form.formState.isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
        Konto erstellen
      </button>
    </form>
  )
}
