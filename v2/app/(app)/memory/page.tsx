import { redirect } from 'next/navigation'
import MemoryStudio from '@/components/studio/MemoryStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function MemoryPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <MemoryStudio userId={data.user.id} />
}
