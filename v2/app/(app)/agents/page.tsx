import { redirect } from 'next/navigation'
import AgentStudio from '@/components/studio/AgentStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AgentsPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <AgentStudio userId={data.user.id} />
}