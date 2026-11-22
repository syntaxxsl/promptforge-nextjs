import { redirect } from 'next/navigation'
import DashboardStudio from '@/components/studio/DashboardStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <DashboardStudio />
}
