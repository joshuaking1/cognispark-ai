// src/app/(admin)/layout.tsx
import { createSupabaseServerComponentClient } from "@/lib/supabase/server"; // For server-side auth check
import { redirect } from "next/navigation";
import { PropsWithChildren } from "react";

export default async function AdminLayout({ children }: PropsWithChildren) {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?message=Please log in to access this page."); // Or a specific admin login page
  }

  // Fetch profile to check admin status
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "admin") {
    console.warn(
      `AdminLayout: User ${user.id} (role: ${profile?.role}) attempted to access admin area without privileges.`
    );
    // Redirect to a "not authorized" page or the main dashboard
    redirect("/dashboard?error=Not authorized to access admin area.");
  }

  // If admin, render the layout
  return <>{children}</>;
}
