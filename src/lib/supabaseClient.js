import { createClient } from "@supabase/supabase-js";

// Fill these in your .env file at the frontend root:
//   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-public-key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = () => Boolean(supabase);

export const getAccessToken = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};
