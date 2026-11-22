import { redirect } from 'next/navigation'
import HistoryStudio from '@/components/studio/HistoryStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <HistoryStudio userId={data.user.id} />
}
