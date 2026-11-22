import { redirect } from 'next/navigation'
import DocumentStudio from '@/components/studio/DocumentStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function DocumentPage(){const supabase=await createSupabaseServerClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect('/login');return <DocumentStudio userId={data.user.id}/>}