// src/app/quizzes/page.tsx
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, CheckSquare } from "lucide-react";

async function getQuizzesForUser(userId: string) {
    const supabase = createSupabaseServerComponentClient();
    const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, quiz_type, num_questions_generated, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) { console.error("Error fetching quizzes:", error); return []; }
    return data;
}

export default async function QuizzesListPage() {
  const supabase = createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?message=Please login to view your quizzes.");

  const quizzes = await getQuizzesForUser(user.id);

  return (
    <div className="container mx-auto py-4 md:py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          My Quizzes
        </h1>
        <Link href="/quizzes/create" className="w-full sm:w-auto">
          <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]">
            <PlusCircle className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Create New Quiz
          </Button>
        </Link>
      </div>

      {quizzes && quizzes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {quizzes.map((quiz) => (
            <Link key={quiz.id} href={`/quizzes/take/${quiz.id}`} passHref legacyBehavior>
              <Card className="group hover:shadow-lg transition-all duration-200 hover:scale-[1.02] bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="text-lg md:text-xl font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {quiz.title}
                  </CardTitle>
                  {quiz.description && (
                    <CardDescription className="text-sm h-10 overflow-hidden text-ellipsis line-clamp-2">
                      {quiz.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
                        {quiz.quiz_type === "multiple_choice" ? "Multiple Choice" : "True/False"}
                      </span>
                      <span>•</span>
                      <span>{quiz.num_questions_generated || 0} questions</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(quiz.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-4 md:p-6 pt-0">
                  <Button 
                    variant="outline" 
                    className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                  >
                    <CheckSquare className="mr-2 h-4 w-4"/> Take Quiz
                  </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 px-4">
          <div className="max-w-md mx-auto space-y-4">
            <h3 className="text-xl text-muted-foreground">You haven't created any quizzes yet.</h3>
            <p className="text-sm text-muted-foreground">Create your first quiz to start testing your knowledge!</p>
            <Link href="/quizzes/create" className="inline-block">
              <Button 
                variant="default" 
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
              >
                Create Your First Quiz
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}