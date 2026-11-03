import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Toaster } from 'sonner'
import NavigationTracker from '@/components/NavigationTracker'
import HardwareBackHandler from '@/components/HardwareBackHandler'
import { getGemeinde } from '@/lib/gemeinde'
import { buildThemeStyle } from '@/lib/buildThemeStyle'
import './globals.css'

// Lokal statt next/font/google: Der Build lud die Schriften sonst bei jedem Lauf
// von fonts.gstatic.com und scheiterte, wenn Google kurz nicht erreichbar war.
// Variable Schriften aus den Fontsource-Paketen (latin, enthält Umlaute).
const jakarta = localFont({
  src: '../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
  weight: '200 800',
  variable: '--font-jakarta',
})

const dmSans = localFont({
  src: '../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
  weight: '100 1000',
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
  maximumScale: 5,
  userScalable: true,
  // Pflicht für env(safe-area-inset-*): ohne 'cover' liefert die WebView
  // konstant 0 und alle pt-safe-*-Utilities wären wirkungslos.
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const gemeinde = await getGemeinde()
  const themeStyle = buildThemeStyle(gemeinde?.primary_color, gemeinde?.accent_color)

  return (
    <html lang="de" className={`${jakarta.variable} ${dmSans.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        {themeStyle && <style dangerouslySetInnerHTML={{ __html: themeStyle }} />}
      </head>
      <body className="min-h-full bg-gray-50 font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-lg focus:text-primary-600 focus:font-bold focus:outline-none"
        >
          Zum Hauptinhalt springen
        </a>
        {/* Stempelt die Navigationstiefe in jeden History-Eintrag. Im
            Root-Layout, damit auch /impressum & Co. davon profitieren. */}
        <NavigationTracker />
        <HardwareBackHandler />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
