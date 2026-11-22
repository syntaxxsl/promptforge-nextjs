import { redirect } from 'next/navigation'
import SEOStudio from '@/components/studio/SEOStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function SEOPage(){
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user) redirect('/login')
 return <SEOStudio/>
}
