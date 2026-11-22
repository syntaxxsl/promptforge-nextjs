import { redirect } from 'next/navigation'
import PresentationStudio from '@/components/studio/PresentationStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function PresentationPage(){
 const supabase=await createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user) redirect('/login')
 return <PresentationStudio userId={data.user.id}/>
}
