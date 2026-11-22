import { redirect } from 'next/navigation'
import DatabaseDesignerStudio from '@/components/studio/DatabaseDesignerStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function DatabaseDesignerPage() {
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user)redirect('/login')
 return <DatabaseDesignerStudio userId={data.user.id}/>
}