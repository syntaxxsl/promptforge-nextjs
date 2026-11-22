import { redirect } from 'next/navigation'
import StoryStudio from '@/components/studio/StoryStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function StoryPage(){
 const supabase=await createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user) redirect('/login')
 return <StoryStudio userId={data.user.id}/>
}
