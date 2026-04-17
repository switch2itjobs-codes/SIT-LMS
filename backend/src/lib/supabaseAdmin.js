import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

export const supabaseAdmin = createClient(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    global: {
      headers: {
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)
