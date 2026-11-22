import { redirect } from 'next/navigation'
import WebSearchStudio from '@/components/studio/WebSearchStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function WebSearchPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <WebSearchStudio userId={data.user.id} />
}
