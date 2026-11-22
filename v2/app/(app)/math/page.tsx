import { redirect } from 'next/navigation'
import MathStudio from '@/components/studio/MathStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function MathPage(){const supabase=createSupabaseServerClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect('/login');return <MathStudio/>}