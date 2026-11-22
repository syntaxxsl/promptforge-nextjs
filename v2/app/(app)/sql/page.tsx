import { redirect } from 'next/navigation'
import SQLStudio from '@/components/studio/SQLStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function SQLPage() {
 const supabase=await createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user)redirect('/login')
 return <SQLStudio userId={data.user.id}/>
}