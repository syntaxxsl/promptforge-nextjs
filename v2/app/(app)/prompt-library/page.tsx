import { redirect } from 'next/navigation'
import PromptLibraryStudio from '@/components/studio/PromptLibraryStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function PromptLibraryPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <PromptLibraryStudio />
}
