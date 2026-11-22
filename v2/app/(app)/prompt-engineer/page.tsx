import { redirect } from 'next/navigation'
import PromptEngineerStudio from '@/components/studio/PromptEngineerStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function PromptEngineerPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <PromptEngineerStudio userId={data.user.id} />
}
