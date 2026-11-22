import { redirect } from 'next/navigation'
import SocialStudio from '@/components/studio/SocialStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function SocialPage(){
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user) redirect('/login')
 return <SocialStudio userId={data.user.id}/>
}
