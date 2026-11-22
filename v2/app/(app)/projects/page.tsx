import { redirect } from 'next/navigation'
import ProjectManager from '@/components/studio/ProjectManager'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function ProjectsPage() {
  const supabase = createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  return <ProjectManager userId={data.user.id} />
}