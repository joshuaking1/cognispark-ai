// src/app/(teacher)/teacher-portal/layout.tsx
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PropsWithChildren } from "react";

export default async function TeacherPortalLayout({
  children,
}: PropsWithChildren) {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?message=Please log in to access the Teacher Portal.");
  }

  // Fetch profile to check teacher or admin status
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role") // We only need the role here
    .eq("id", user.id)
    .single();

  // Allow access if user is 'teacher' OR 'admin' (admins can often access teacher areas)
  if (
    error ||
    !profile ||
    (profile.role !== "teacher" && profile.role !== "admin")
  ) {
    console.warn(
      `TeacherLayout: User ${user.id} (role: ${profile?.role}) attempted to access teacher portal without privileges.`
    );
    redirect("/dashboard?error=Not authorized for Teacher Portal."); // Redirect to student dashboard
  }

  return <>{children}</>;
}
