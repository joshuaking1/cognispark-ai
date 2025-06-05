// src/app/(admin)/layout.tsx
import { createSupabaseServerComponentClient } from "@/lib/supabase/server"; // For server-side auth check
import { redirect } from "next/navigation";
import Link from "next/link";
import { PropsWithChildren } from "react";
import Navbar from "@/components/layout/Navbar"; // You might want a different, simpler Navbar for admin

// Simple Admin Navbar (Optional - can also reuse main Navbar or have none)
function AdminNavbar() {
    return (
        <nav className="bg-gray-800 text-white p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
                <Link href="/admin" className="text-xl font-bold">LearnBrigeEdu Admin</Link>
                <div>
                    {/* Add admin-specific nav links here if needed */}
                    <Link href="/" className="text-sm hover:text-gray-300 mr-4">Go to Main App</Link>
                    {/* Sign Out for admin can use the same logic as main app's sign out */}
                </div>
            </div>
        </nav>
    );
}


export default async function AdminLayout({ children }: PropsWithChildren) {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?message=Please log in to access this page."); // Or a specific admin login page
  }

  // Fetch profile to check admin status
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.is_admin) {
    console.warn(`AdminLayout: User ${user.id} attempted to access admin area without privileges or profile error.`);
    // Redirect to a "not authorized" page or the main dashboard
    redirect("/dashboard?error=Not authorized to access admin area.");
  }

  // If admin, render the layout
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <AdminNavbar /> {/* Or your main Navbar */}
      <main className="flex-grow container mx-auto p-4 md:p-8">
        {children}
      </main>
      <footer className="text-center p-4 text-xs text-gray-500 border-t">
        LearnBrigeEdu Admin Panel
      </footer>
    </div>
  );
}