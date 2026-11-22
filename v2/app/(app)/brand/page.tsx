import { redirect } from 'next/navigation'
import BrandStudio from '@/components/studio/BrandStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function BrandPage(){
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user) redirect('/login')
 return <BrandStudio userId={data.user.id}/>
}
