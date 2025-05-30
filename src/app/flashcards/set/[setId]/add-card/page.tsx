"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, PlusCircle, ArrowLeft } from "lucide-react";
import { addManualFlashcardAction } from "@/app/actions/flashcardActions";

export default function AddManualFlashcardPage() {
  const params = useParams();
  const router = useRouter();
  const setId = params.setId as string;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast.error("Missing Fields", { description: "Both question and answer are required." });
      return;
    }
    if (!setId) {
      toast.error("Error", { description: "Set ID is missing. Cannot add card." });
      return;
    }

    setIsLoading(true);
    try {
      const result = await addManualFlashcardAction({ setId, question, answer });
      if (result.success && result.data) {
        toast.success("Flashcard Added!", { description: `"${result.data.question}" has been added to your set.` });
        setQuestion(""); // Clear fields for next card
        setAnswer("");
        // Optionally, navigate back to the set study page or stay to add more
        // router.push(`/flashcards/set/${setId}`);
      } else {
        toast.error("Failed to Add Card", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-4 md:py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/flashcards/set/${setId}`)}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Set
          </Button>
        </div>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Add New Flashcard
            </CardTitle>
            <CardDescription className="text-sm md:text-base">
              Create a new flashcard for your set. Make sure to write clear questions and answers.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="question" className="text-sm md:text-base font-medium">
                    Question
                  </Label>
                  <Textarea
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Enter your question here..."
                    className="mt-2 min-h-[100px] bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="answer" className="text-sm md:text-base font-medium">
                    Answer
                  </Label>
                  <Textarea
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Enter your answer here..."
                    className="mt-2 min-h-[100px] bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:scale-100 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Card...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Card
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuestion("");
                    setAnswer("");
                  }}
                  disabled={isLoading}
                  className="w-full sm:w-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                >
                  Clear Fields
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 