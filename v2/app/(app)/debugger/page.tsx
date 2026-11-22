import { redirect } from 'next/navigation'
import DebuggerStudio from '@/components/studio/DebuggerStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function DebuggerPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <DebuggerStudio />
}
