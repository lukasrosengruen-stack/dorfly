'use client'

import { useEffect } from 'react'

interface Props {
  userId: string
  gemeindeSlug: string
}

export default function PushNotificationInit({ userId, gemeindeSlug }: Props) {
  useEffect(() => {
    const win = window as Window & { OneSignalDeferred?: Array<(os: unknown) => void> }
    win.OneSignalDeferred = win.OneSignalDeferred || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    win.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.login(userId)
      OneSignal.User.addTag('gemeinde_slug', gemeindeSlug)
    })
  }, [userId, gemeindeSlug])

  return null
}
