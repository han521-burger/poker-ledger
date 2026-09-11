import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // This only throws at runtime in the browser/server when actually used,
  // so `next build` won't fail before env vars are configured on Vercel.
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置，请在 Vercel 项目的 Environment Variables 中设置。'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
