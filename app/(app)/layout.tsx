import AppShell from '../components/AppShell'

/**
 * Panel içi sayfaların ortak yerleşimi.
 * Sol menü, mobil çekmece ve oturum kontrolü burada tek yerde yönetilir.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
