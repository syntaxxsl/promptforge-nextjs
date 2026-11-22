import { redirect } from 'next/navigation'
import WriterStudio from '@/components/studio/WriterStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function WriterPage() {
 const supabase = createSupabaseServerClient()
 const { data } = await supabase.auth.getUser()
 if (!data.user) redirect('/login')
 return <WriterStudio userId={data.user.id} />
}
