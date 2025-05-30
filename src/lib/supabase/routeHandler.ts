// src/lib/supabase/routeHandler.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const createSupabaseRouteHandlerClient = () => {
  const cookieStore = cookies();
  return createRouteHandlerClient( // This function is correct for Route Handlers
    { cookies: () => cookieStore },
    {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  );
};