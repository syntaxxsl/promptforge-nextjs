import { redirect } from 'next/navigation'
import ResumeStudio from '@/components/studio/ResumeStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function ResumePage(){const supabase=createSupabaseServerClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect('/login');return <ResumeStudio/>}