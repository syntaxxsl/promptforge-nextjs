import { redirect } from 'next/navigation'
import AutomationStudio from '@/components/studio/AutomationStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AutomationPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <AutomationStudio userId={data.user.id} />
}
