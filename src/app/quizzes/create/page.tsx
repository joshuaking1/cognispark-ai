// src/app/quizzes/create/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2, Minus, Plus } from "lucide-react"; // Re-using Wand2 for generate

// We will create this server action next
import { generateQuizAction } from "@/app/actions/quizActions";

const quizTypes = [
  { value: "multiple_choice", label: "Multiple Choice (4 options)" },
  { value: "true_false", label: "True/False" },
  // { value: "short_answer", label: "Short Answer (AI will provide ideal answer for comparison)" }, // More complex to grade
];

const questionCounts = [5, 10, 15, 20];

export default function CreateQuizPage() {
  const router = useRouter();
  const [quizTitle, setQuizTitle] = useState("");
  const [sourceType, setSourceType] = useState<"topic" | "text">("topic");
  const [sourceContent, setSourceContent] = useState(""); // Either a topic string or pasted text
  const [selectedQuizType, setSelectedQuizType] = useState<string>(quizTypes[0].value);
  const [selectedNumQuestions, setSelectedNumQuestions] = useState<number>(questionCounts[1]); // Default to 10
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quizTitle.trim() || !sourceContent.trim()) {
      toast.error("Missing Information", { description: "Please provide a title and source topic/text." });
      return;
    }
    setIsLoading(true);
    try {
      const result = await generateQuizAction({
        title: quizTitle,
        sourceType: sourceType,
        sourceContent: sourceContent,
        quizType: selectedQuizType,
        numQuestions: selectedNumQuestions,
      });

      if (result.success && result.quizId) {
        toast.success("Quiz generated successfully!", {
          description: `Redirecting to your new quiz...`,
        });
        router.push(`/quizzes/take/${result.quizId}`); // Page to take the quiz
      } else {
        toast.error("Quiz Generation Failed", { description: result.error || "Could not generate quiz." });
      }
    } catch (error: any) {
      toast.error("An Error Occurred", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-4 md:py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Create New Quiz
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate a quiz based on your study materials
            </p>
          </div>
        </div>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">Quiz Settings</CardTitle>
            <CardDescription>
              Choose your quiz type and number of questions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="quizType" className="text-sm font-medium">
                    Quiz Type
                  </Label>
                  <Select
                    id="quizType"
                    value={selectedQuizType}
                    onValueChange={(value) => setSelectedQuizType(value as "multiple_choice" | "true_false")}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                      <SelectValue placeholder="Select quiz type" />
                    </SelectTrigger>
                    <SelectContent>
                      {quizTypes.map(qt => <SelectItem key={qt.value} value={qt.value}>{qt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="numQuestions" className="text-sm font-medium">
                    Number of Questions
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50"
                      onClick={() => setSelectedNumQuestions(Math.max(1, selectedNumQuestions - 1))}
                      disabled={isLoading || selectedNumQuestions <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      id="numQuestions"
                      type="number"
                      min={1}
                      max={20}
                      value={selectedNumQuestions}
                      onChange={(e) => setSelectedNumQuestions(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-20 text-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50"
                      onClick={() => setSelectedNumQuestions(Math.min(20, selectedNumQuestions + 1))}
                      disabled={isLoading || selectedNumQuestions >= 20}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose between 1 and 20 questions
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="submit"
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Quiz...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Quiz
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                  onClick={() => {
                    setSelectedQuizType("multiple_choice");
                    setSelectedNumQuestions(5);
                  }}
                  disabled={isLoading}
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}