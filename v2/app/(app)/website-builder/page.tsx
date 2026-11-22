import { redirect } from 'next/navigation'
import WebsiteBuilderStudio from '@/components/studio/WebsiteBuilderStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function WebsiteBuilderPage(){
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user) redirect('/login')
 return <WebsiteBuilderStudio/>
}
