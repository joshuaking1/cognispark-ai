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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
      <div className="container mx-auto py-6 md:py-12 px-4">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#fd6a3e] via-orange-500 to-[#022e7d] bg-clip-text text-transparent">
              My Quizzes
            </h1>
            <p className="text-slate-600 text-sm md:text-base">
              Test your knowledge with personalized quizzes
            </p>
          </div>
          <Link href="/quizzes/create" className="w-full sm:w-auto">
            <Button className="w-full bg-gradient-to-r from-[#fd6a3e] to-orange-500 hover:from-[#e55a35] hover:to-orange-600 text-white shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.05] border-0 px-6 py-3 text-base font-semibold">
              <PlusCircle className="mr-2 h-5 w-5" /> Create New Quiz
            </Button>
          </Link>
        </div>

        {quizzes && quizzes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {quizzes.map((quiz) => (
              <Link key={quiz.id} href={`/quizzes/take/${quiz.id}`} passHref legacyBehavior>
                <Card className="group hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:-translate-y-1 cursor-pointer overflow-hidden relative">
                  {/* Gradient accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#fd6a3e] to-[#022e7d]"></div>
                  
                  <CardHeader className="p-6 pb-4">
                    <CardTitle className="text-xl md:text-2xl font-bold text-[#022e7d] truncate group-hover:text-[#fd6a3e] transition-colors duration-300">
                      {quiz.title}
                    </CardTitle>
                    {quiz.description && (
                      <CardDescription className="text-slate-600 text-sm leading-relaxed h-12 overflow-hidden text-ellipsis line-clamp-2">
                        {quiz.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  
                  <CardContent className="px-6 pb-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#022e7d]/10 to-[#fd6a3e]/10 text-[#022e7d] font-medium border border-[#022e7d]/20">
                          {quiz.quiz_type === "multiple_choice" ? "Multiple Choice" : "True/False"}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600 font-medium">{quiz.num_questions_generated || 0} questions</span>
                      </div>
                      <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg inline-block w-fit">
                        Created {new Date(quiz.created_at).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="p-6 pt-2">
                    <Button 
                      variant="outline" 
                      className="w-full bg-gradient-to-r from-[#022e7d] to-blue-800 text-white border-0 hover:from-[#fd6a3e] hover:to-orange-500 transition-all duration-300 shadow-md hover:shadow-lg font-semibold py-2.5"
                    >
                      <CheckSquare className="mr-2 h-4 w-4"/> Take Quiz
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="max-w-lg mx-auto space-y-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-0">
              {/* Decorative element */}
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-[#fd6a3e]/20 to-[#022e7d]/20 rounded-full flex items-center justify-center mb-6">
                <PlusCircle className="w-12 h-12 text-[#fd6a3e]" />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-2xl md:text-3xl font-bold text-[#022e7d]">
                  Ready to get started?
                </h3>
                <p className="text-slate-600 text-base leading-relaxed max-w-md mx-auto">
                  Create your first quiz and start testing your knowledge with personalized questions tailored just for you!
                </p>
              </div>
              
              <Link href="/quizzes/create" className="inline-block">
                <Button 
                  variant="default" 
                  size="lg"
                  className="bg-gradient-to-r from-[#fd6a3e] to-orange-500 hover:from-[#e55a35] hover:to-orange-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.05] border-0 px-8 py-4 text-lg font-semibold"
                >
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Your First Quiz
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}