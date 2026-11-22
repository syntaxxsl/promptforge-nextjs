import { redirect } from 'next/navigation'
import APIStudio from '@/components/studio/APIStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function APIStudioPage() {
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user)redirect('/login')
 return <APIStudio userId={data.user.id}/>
}