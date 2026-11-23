import type { Metadata, Viewport } from 'next'
import './globals.css'
import './workspace-refresh.css'

export const metadata: Metadata = {
  title: 'PromptForge 2.0',
  description: 'Modular AI platform — build, generate, and ship with AI.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}