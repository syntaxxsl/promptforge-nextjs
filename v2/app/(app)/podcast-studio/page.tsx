import { redirect } from 'next/navigation'
import SpecialistStudio from '@/components/studio/SpecialistStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  return <SpecialistStudio kind="podcast" userId={data.user.id} />
}
