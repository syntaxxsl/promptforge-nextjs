import { redirect } from 'next/navigation'
import CanvasStudio from '@/components/studio/CanvasStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function CanvasPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <CanvasStudio userId={data.user.id} />
}
