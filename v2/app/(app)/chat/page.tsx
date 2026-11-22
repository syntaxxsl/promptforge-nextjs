import { redirect } from 'next/navigation'
import ChatStudio from '@/components/studio/ChatStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ChatPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <ChatStudio userId={data.user.id} />
}