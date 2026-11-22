import { redirect } from 'next/navigation'
import MindMapStudio from '@/components/studio/MindMapStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function MindMapPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <MindMapStudio userId={data.user.id} />
}
