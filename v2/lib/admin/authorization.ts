import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function getSignedInUser() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { supabase, user: null, isAdmin: false }
  return {
    supabase,
    user: data.user,
    // Admin access must come from trusted app_metadata, never editable user_metadata.
    isAdmin: data.user.app_metadata?.role === 'admin'
  }
}
