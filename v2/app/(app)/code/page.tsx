import { redirect } from 'next/navigation'
import CodeStudio from '@/components/studio/CodeStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function CodePage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <CodeStudio userId={data.user.id} />
}