import { redirect } from 'next/navigation'
import VisionToCodeStudio from '@/components/studio/VisionToCodeStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function VisionToCodePage() {
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user)redirect('/login')
 return <VisionToCodeStudio userId={data.user.id}/>
}