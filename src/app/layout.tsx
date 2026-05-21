import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import { Toaster } from 'sonner'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-dm',
})

export const metadata: Metadata = {
  title: 'Dorfly – Deine Gemeinde. Dein Smartphone.',
  description: 'Der direkte, offizielle Kanal zwischen Ihrer Verwaltung und Ihren Bürgern. Lokal vernetzt. Für Kommunen bis 15.000 Einwohner.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/favicon-32.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Dorfly',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f2d6b',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${jakarta.variable} ${dmSans.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
      </head>
      <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
      <Script id="onesignal-init" strategy="afterInteractive">{`
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        OneSignalDeferred.push(async function(OneSignal) {
          await OneSignal.init({ appId: "${process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID}" });
        });
      `}</Script>
      <body className="min-h-full bg-gray-50 font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg focus:text-primary-600 focus:font-bold focus:outline-none"
        >
          Zum Hauptinhalt springen
        </a>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
