import type { Metadata, Viewport } from 'next'
import './globals.css'
import Script from 'next/script'
import KvkkBanner from '../components/KvkkBanner'

export const metadata: Metadata = {
  title: {
    default: 'PromptForge — Hayal Et, Koda.',
    template: '%s · PromptForge',
  },
  description:
    'PromptForge, fikirlerini saniyeler içinde çalışan web sitelerine dönüştüren AI stüdyosu.',
  applicationName: 'PromptForge',
  openGraph: {
    title: 'PromptForge — Hayal Et, Koda.',
    description:
      'Fikirlerini saniyeler içinde çalışan web sitelerine dönüştüren AI stüdyosu.',
    type: 'website',
    locale: 'tr_TR',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#090b10',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>
        {children}
        <KvkkBanner />
        <Script src="https://js.puter.com/v2/" strategy="beforeInteractive" />
      </body>
    </html>
  )
}
