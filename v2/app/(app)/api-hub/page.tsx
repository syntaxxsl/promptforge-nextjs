import { redirect } from 'next/navigation'
import APIHubStudio from '@/components/studio/APIHubStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function APIHubPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <APIHubStudio />
}
