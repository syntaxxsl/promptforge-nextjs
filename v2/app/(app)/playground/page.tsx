import { redirect } from 'next/navigation'
import PlaygroundStudio from '@/components/studio/PlaygroundStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function PlaygroundPage(){const supabase=await createSupabaseServerClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect('/login');return <PlaygroundStudio/>}
