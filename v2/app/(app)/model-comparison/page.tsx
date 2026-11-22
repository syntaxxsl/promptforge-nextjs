import { redirect } from 'next/navigation'
import ModelComparisonStudio from '@/components/studio/ModelComparisonStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function ModelComparisonPage(){const supabase=await createSupabaseServerClient();const {data}=await supabase.auth.getUser();if(!data.user)redirect('/login');return <ModelComparisonStudio userId={data.user.id}/>}
