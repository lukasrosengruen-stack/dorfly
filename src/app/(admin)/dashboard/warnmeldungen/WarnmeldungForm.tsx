// src/app/(admin)/dashboard/warnmeldungen/WarnmeldungForm.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { warnmeldungSchema, type WarnmeldungFormValues, createWarnmeldungAction } from './actions'
import { SEVERITY_LABEL } from '@/features/warnmeldungen/types'

export default function WarnmeldungForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<WarnmeldungFormValues>({
    resolver: zodResolver(warnmeldungSchema),
    defaultValues: { titel: '', inhalt: '', severity: 2, sendPush: true },
  })

  async function onSubmit(values: WarnmeldungFormValues) {
    setServerError(null)
    const result = await createWarnmeldungAction(values)
    if (result?.error) setServerError(result.error)
    // Bei Erfolg redirected die Server Action automatisch
  }

  const severityOptions = ([1, 2, 3, 4] as const).map((s) => ({
    value: s,
    label: SEVERITY_LABEL[s],
  }))

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 max-w-xl">
      {serverError && (
        <div role="alert" aria-live="assertive" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="titel" className="block text-sm font-medium text-gray-700">
          Titel
        </label>
        <input
          id="titel"
          type="text"
          placeholder="z.B. Unwetterwarnung: Starkregen"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          {...form.register('titel')}
        />
        {form.formState.errors.titel && (
          <p role="alert" className="text-xs text-red-600">{form.formState.errors.titel.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="inhalt" className="block text-sm font-medium text-gray-700">
          Beschreibung
        </label>
        <textarea
          id="inhalt"
          rows={4}
          placeholder="Details zur Warnmeldung..."
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          {...form.register('inhalt')}
        />
        {form.formState.errors.inhalt && (
          <p role="alert" className="text-xs text-red-600">{form.formState.errors.inhalt.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="severity" className="block text-sm font-medium text-gray-700">
          Schweregrad
        </label>
        <select
          id="severity"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
          {...form.register('severity')}
        >
          {severityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="sendPush"
          type="checkbox"
          className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
          {...form.register('sendPush')}
        />
        <label htmlFor="sendPush" className="text-sm text-gray-700">
          Push-Benachrichtigung an alle Nutzer senden
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors"
        >
          {form.formState.isSubmitting ? 'Wird erstellt…' : 'Warnmeldung erstellen'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}
