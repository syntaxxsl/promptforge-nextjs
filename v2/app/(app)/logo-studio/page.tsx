import { redirect } from 'next/navigation'
import CreativeLabStudio from '@/components/studio/CreativeLabStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function LogoStudioPage() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <CreativeLabStudio userId={data.user.id} tool="logo" />
}
