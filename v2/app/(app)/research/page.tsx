import { redirect } from 'next/navigation'
import ResearchStudio from '@/components/studio/ResearchStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ResearchPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <ResearchStudio userId={data.user.id} />
}
