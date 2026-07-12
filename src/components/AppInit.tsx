'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'
import { toast } from 'sonner'

export default function AppInit() {
  const router = useRouter()
  const routerRef = useRef(router)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const init = async () => {
      const { default: OneSignal } = await import('onesignal-cordova-plugin')
      OneSignal.initialize('93b42ea5-8ef7-4c9e-9d26-116cf64ad62d')
      OneSignal.Notifications.addEventListener('click', (event) => {
        const e = event as any
        toast(JSON.stringify(e).slice(0, 300))

        const ad = e?.notification?.additionalData
        const data = e?.notification?.data
        let ziel: string | undefined = ad?.pfad ?? data?.pfad
        if (!ziel) {
          const url: string | undefined = e?.result?.url ?? e?.notification?.launchURL
          if (url) { try { ziel = new URL(url).pathname } catch {} }
        }
        if (ziel) routerRef.current.push(ziel)
      })
    }

    init()
  }, [])

  return null
}
