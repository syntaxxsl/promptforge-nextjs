import { redirect } from 'next/navigation'
import VideoStudio from '@/components/studio/VideoStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function VideoPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <VideoStudio userId={data.user.id} />
}