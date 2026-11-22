import { redirect } from 'next/navigation'
import KnowledgeStudio from '@/components/studio/KnowledgeStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function KnowledgePage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <KnowledgeStudio userId={data.user.id} />
}
