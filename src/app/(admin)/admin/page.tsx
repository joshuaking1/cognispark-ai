// src/app/(admin)/admin/page.tsx
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Users, BookCopy, HelpCircle, BarChart3, Newspaper, BookOpenCheck } from "lucide-react"; // Icons
import Link from "next/link";

// Helper function to fetch counts (can be expanded or moved to an action file)
async function getStats() {
    const supabase = createSupabaseServerComponentClient(); // New instance for this scope
    
    const { count: userCount, error: userError } = await supabase
        .from("profiles") // Assuming each profile is a unique user for this count
        .select('*', { count: 'exact', head: true });

    const { count: setCound, error: setError } = await supabase
        .from("flashcard_sets")
        .select('*', { count: 'exact', head: true });
    
    const { count: quizCount, error: quizError } = await supabase
        .from("quizzes")
        .select('*', { count: 'exact', head: true });

    if(userError) console.error("Admin Stats Error (Users):", userError.message);
    if(setError) console.error("Admin Stats Error (Sets):", setError.message);
    if(quizError) console.error("Admin Stats Error (Quizzes):", quizError.message);

    return {
        userCount: userCount ?? 0,
        flashcardSetCount: setCound ?? 0,
        quizCount: quizCount ?? 0,
    };
}


export default async function AdminDashboardPage() {
  const stats = await getStats();

  const statCards = [
    { title: "Total Users", value: stats.userCount, icon: Users, color: "text-blue-500" },
    { title: "Total Flashcard Sets", value: stats.flashcardSetCount, icon: BookCopy, color: "text-green-500" },
    { title: "Total Quizzes Created", value: stats.quizCount, icon: HelpCircle, color: "text-purple-500" },
    // Add more stats as you track more things
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of CogniSpark AI platform activity.</p>
      </section>

      {/* Stats Cards Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              {/* <p className="text-xs text-muted-foreground">+20.1% from last month</p> // Placeholder for trends */}
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Content & User Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/manage-tips" passHref legacyBehavior>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-card">
              <CardHeader><CardTitle className="flex items-center text-lg"><Newspaper className="mr-2 h-5 w-5 text-orange-500"/>Manage Tips</CardTitle></CardHeader>
              <CardContent><CardDescription>Create, edit, or activate the "Tip of the Day" for users.</CardDescription></CardContent>
            </Card>
          </Link>
          <Link href="/admin/manage-knowledge" passHref legacyBehavior>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-card">
              <CardHeader><CardTitle className="flex items-center text-lg"><BookOpenCheck className="mr-2 h-5 w-5 text-teal-500"/>Manage Knowledge Base</CardTitle></CardHeader>
              <CardContent><CardDescription>Upload and process PDFs (curriculum, textbooks) for AI learning.</CardDescription></CardContent>
            </Card>
          </Link>
          {/* Add more management cards here later, e.g., Manage Users */}
        </div>
      </section>

      {/* More sections can be added later: User List, Content Moderation (if any), etc. */}
       <section>
        <h2 className="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Example link - replace with actual admin features later */}
            {/* <Link href="/admin/users" className="p-4 bg-card border rounded-lg hover:shadow-md text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-primary"/>
                <p className="font-medium">Manage Users</p>
            </Link> */}
             <div className="p-4 bg-card border rounded-lg text-center text-muted-foreground">
                <BarChart3 className="mx-auto mb-2 h-8 w-8"/>
                <p className="font-medium">View Analytics (Soon)</p>
            </div>
        </div>
      </section>
    </div>
  );
}