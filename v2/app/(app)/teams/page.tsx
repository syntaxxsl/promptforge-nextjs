import { redirect } from 'next/navigation'
import TeamStudio from '@/components/studio/TeamStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function TeamsPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <TeamStudio userId={data.user.id} />
}
