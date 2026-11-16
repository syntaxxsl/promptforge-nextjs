import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ibjzdpsswljcfhdxpyqi.supabase.co'
const supabaseKey = 'sb_publishable_QAEEEiCo64HK6xxvkJo0Aw_SYQk5Qx6'

export const supabase = createClient(supabaseUrl, supabaseKey)
