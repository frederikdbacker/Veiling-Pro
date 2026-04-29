import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Supabase env vars ontbreken. Maak een .env.local in de project-root met VITE_SUPABASE_URL en VITE_SUPABASE_PUBLISHABLE_KEY (zie .env.example).'
  )
}

export const supabase = createClient(url, key)
