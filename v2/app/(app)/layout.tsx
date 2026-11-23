import AppShell from '@/components/AppShell'
import StudioWorkspaceFrame from '@/components/studio/StudioWorkspaceFrame'

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <StudioWorkspaceFrame>{children}</StudioWorkspaceFrame>
    </AppShell>
  )
}
