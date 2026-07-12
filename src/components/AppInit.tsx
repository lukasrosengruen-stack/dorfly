'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Capacitor } from '@capacitor/core'

export default function AppInit() {
  const router = useRouter()
  const routerRef = useRef(router)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const init = async () => {
      const { default: OneSignal } = await import('onesignal-cordova-plugin')
      OneSignal.initialize('93b42ea5-8ef7-4c9e-9d26-116cf64ad62d')
      OneSignal.Notifications.addEventListener('click', (event) => {
        const pfad = (event.notification.additionalData as { pfad?: string } | null)?.pfad
        if (pfad) routerRef.current.push(pfad)
      })
    }

    init()
  }, [])

  return null
}
