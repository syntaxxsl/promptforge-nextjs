import { redirect } from 'next/navigation'
import CommunityStudio from '@/components/studio/CommunityStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function CommunityPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <CommunityStudio userId={data.user.id} isAdmin={data.user.app_metadata?.role === 'admin'} />
}
