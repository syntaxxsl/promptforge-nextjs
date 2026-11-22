import { redirect } from 'next/navigation'
import QuizStudio from '@/components/studio/QuizStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function QuizPage(){const supabase=createSupabaseServerClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect('/login');return <QuizStudio userId={data.user.id}/>}