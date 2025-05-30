// src/lib/supabase/server.ts
import {
  createServerActionClient, // Specifically for Server Actions
  createServerComponentClient, // Specifically for Server Components
} from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

// Utility for Server Components
export const createSupabaseServerComponentClient = () => {
  const cookieStore = cookies();
  return createServerComponentClient(
    { cookies: () => cookieStore },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  );
};

// Utility for Server Actions
export const createSupabaseServerActionClient = () => {
  const cookieStore = cookies();
  return createServerActionClient(
    { cookies: () => cookieStore },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  );
};

// Generic function for general server-side use (e.g. in API routes IF you were using pages dir)
// For App Router, prefer the more specific ones above or routeHandlerClient for route handlers.
// Keeping the old `createSupabaseServerClient` name but using `createServerComponentClient`
// as it's the most common use case for a "generic" server client in App Router outside of actions/route handlers.
export const createSupabaseServerClient = () => {
  return createSupabaseServerComponentClient();
};
