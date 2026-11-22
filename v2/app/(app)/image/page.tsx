import { redirect } from 'next/navigation'
import ImageStudio from '@/components/studio/ImageStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ImagePage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <ImageStudio userId={data.user.id} />
}