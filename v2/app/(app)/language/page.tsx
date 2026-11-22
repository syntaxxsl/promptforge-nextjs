import { redirect } from 'next/navigation'
import LanguageStudio from '@/components/studio/LanguageStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function LanguagePage(){const supabase=await createSupabaseServerClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect('/login');return <LanguageStudio userId={data.user.id}/>}