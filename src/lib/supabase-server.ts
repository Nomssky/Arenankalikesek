import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Supabase URL and Service Role Key must be set')
    }

    supabaseInstance = createClient(supabaseUrl, serviceKey)
  }
  return supabaseInstance
}
