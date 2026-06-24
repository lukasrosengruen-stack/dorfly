'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

export default function PushRegisterPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'denied' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const userId = params.get('userId') ?? ''
    const slug = params.get('slug') ?? ''

    const returnUrl = params.get('return') ?? ''

    function finish(permission: 'granted' | 'denied' | 'error') {
      if (window.opener) {
        window.opener.postMessage({ type: 'PUSH_REGISTERED', permission }, '*')
        if (permission === 'granted') setTimeout(() => window.close(), 1500)
        // Bei Fehler: Fenster bleibt offen für Diagnose
      } else if (returnUrl) {
        const url = new URL(returnUrl)
        url.searchParams.set('push_result', permission)
        window.location.href = url.toString()
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doInit = async (OneSignal: any) => {
      try {
        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
          notifyButton: { enable: false },
        })
        const granted = await OneSignal.Notifications.requestPermission()
        if (granted) {
          if (userId) await OneSignal.login(userId)
          if (slug) OneSignal.User.addTag('gemeinde_slug', slug)
          setStatus('success')
          finish('granted')
        } else {
          setStatus('denied')
          finish('denied')
        }
      } catch (e) {
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        console.error('[PushRegister]', e)
        setErrorMsg(msg)
        setStatus('error')
        finish('error')
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any
    if (win.OneSignal) {
      doInit(win.OneSignal)
    } else {
      win.OneSignalDeferred = win.OneSignalDeferred || []
      win.OneSignalDeferred.push(doInit)
    }
  }, [])

  return (
    <>
      <Script
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />
      <div className="min-h-screen flex items-center justify-center bg-white p-8 text-center">
        {status === 'loading' && (
          <div>
            <p className="text-lg font-semibold text-gray-800">Push-Benachrichtigungen aktivieren</p>
            <p className="text-sm text-gray-400 mt-2">Bitte dem Browser-Dialog zustimmen…</p>
          </div>
        )}
        {status === 'success' && (
          <div>
            <p className="text-lg font-semibold text-green-600">Aktiviert!</p>
            <p className="text-sm text-gray-400 mt-2">Dieses Fenster schließt sich automatisch.</p>
          </div>
        )}
        {status === 'denied' && (
          <div>
            <p className="text-lg font-semibold text-red-500">Berechtigung verweigert</p>
            <p className="text-sm text-gray-400 mt-2">Push-Benachrichtigungen wurden blockiert.</p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <p className="text-lg font-semibold text-red-500">Fehler</p>
            <p className="text-sm text-gray-400 mt-2">Push konnte nicht aktiviert werden.</p>
            {errorMsg && (
              <p className="text-xs text-red-400 mt-3 font-mono break-all">{errorMsg}</p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
