import { redirect } from 'next/navigation'
import ChatbotBuilderStudio from '@/components/studio/ChatbotBuilderStudio'
import { createSupabaseServerClient } from '@/lib/supabase/server'
export default async function ChatbotBuilderPage() {
 const supabase=createSupabaseServerClient()
 const {data}=await supabase.auth.getUser()
 if(!data.user)redirect('/login')
 return <ChatbotBuilderStudio/>
}