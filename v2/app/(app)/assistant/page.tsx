import { redirect } from 'next/navigation'
import AssistantBuilder from '@/components/studio/AssistantBuilder'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AssistantPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <AssistantBuilder userId={data.user.id} />
}
