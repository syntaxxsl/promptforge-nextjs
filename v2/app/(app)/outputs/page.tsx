import { redirect } from 'next/navigation'
import OutputLibrary from '@/components/studio/OutputLibrary'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function OutputsPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <OutputLibrary userId={data.user.id} />
}
