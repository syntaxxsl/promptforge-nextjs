import { redirect } from 'next/navigation'
import UniversalSearchStudio from '@/components/studio/UniversalSearchStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function SearchPage() { const supabase = await createSupabaseServerClient(); const { data } = await supabase.auth.getUser(); if (!data.user) redirect('/login'); return <UniversalSearchStudio userId={data.user.id}/> }
