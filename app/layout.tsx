import './globals.css'
import Script from 'next/script'

export const metadata = {
  title: 'PromptForge',
  description: 'AI Site Üretici',
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
        <Script src="https://js.puter.com/v2/" strategy="beforeInteractive" />
      </body>
    </html>
  )
}
