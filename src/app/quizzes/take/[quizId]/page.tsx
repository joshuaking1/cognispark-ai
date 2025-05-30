// src/app/quizzes/take/[quizId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // npx shadcn-ui@latest add radio-group
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, ArrowLeftIcon, ArrowRightIcon, CheckSquare, Info, ChevronLeft, ChevronRight } from "lucide-react";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer"; // For question text

import { getQuizForTakingAction, type QuizForTaking, type QuizQuestionForTaking } from "@/app/actions/quizActions"; // Import types

interface UserAnswer {
  questionId: string;
  selectedAnswer: string; // For MCQ, the text of the option; for T/F, "True" or "False"
}

export default function TakeQuizPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<QuizForTaking | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null); // For current MCQ/TF selection
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quizId) {
      setIsLoading(true); setError(null);
      getQuizForTakingAction(quizId)
        .then(result => {
          if (result.success && result.quiz) {
            setQuiz(result.quiz);
            setCurrentQuestionIndex(0);
            setUserAnswers([]); // Reset answers for a new attempt
            setSelectedOption(null);
          } else {
            setError(result.error || "Could not load quiz.");
            toast.error("Load Failed", { description: result.error });
          }
        })
        .catch(err => {
          setError("An unexpected error occurred.");
          toast.error("Error", { description: err.message });
        })
        .finally(() => setIsLoading(false));
    }
  }, [quizId]);

  const currentQuestion = quiz?.questions[currentQuestionIndex];

  const handleAnswerSelection = (answer: string) => {
    setSelectedOption(answer);
  };

  const handleSubmitAnswerAndNext = () => {
    if (!currentQuestion) return;
    if (selectedOption === null && currentQuestion.question_type !== "short_answer") { // short_answer not yet implemented
        toast.error("Please select an answer before proceeding.");
        return;
    }

    const newAnswer: UserAnswer = {
      questionId: currentQuestion.id,
      selectedAnswer: selectedOption!, // Assert non-null as we checked
    };
    setUserAnswers(prev => [...prev, newAnswer]);
    setSelectedOption(null); // Reset for next question

    if (currentQuestionIndex < quiz!.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Last question answered - quiz finished
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = () => {
    // Store userAnswers in localStorage/sessionStorage to pass to results page
    // Or, if results page is dynamic, it can re-fetch questions & correct answers and compare.
    // For V1, let's pass via query params if short, or localStorage for robustness.
    try {
        sessionStorage.setItem(`quizAnswers_${quizId}`, JSON.stringify(userAnswers));
        sessionStorage.setItem(`quizTitle_${quizId}`, quiz?.title || "Quiz"); // Store title for results page
        router.push(`/quizzes/results/${quizId}`);
    } catch (e) {
        toast.error("Could not proceed to results. Please try again.");
        console.error("Error storing quiz answers for results page:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-red-500">Error Loading Quiz</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/quizzes')}>
              <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to Quizzes
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0 && !isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Quiz Not Found</CardTitle>
            <CardDescription>
              The quiz you're looking for doesn't exist or has no questions.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push('/quizzes')}>
              <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to Quizzes
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Loading Question</CardTitle>
            <CardDescription>
              Please wait while we load your question...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressValue = quiz ? ((currentQuestionIndex + 1) / quiz.questions.length) * 100 : 0;

  return (
    <div className="container mx-auto py-4 md:py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {quiz?.title}
            </h1>
            {quiz?.description && (
              <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
              {quiz?.quiz_type === "multiple_choice" ? "Multiple Choice" : "True/False"}
            </span>
            <span>•</span>
            <span>{currentQuestionIndex + 1} of {quiz?.questions?.length}</span>
          </div>
        </div>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">
              Question {currentQuestionIndex + 1}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="space-y-6">
              <p className="text-base md:text-lg">{currentQuestion?.question_text}</p>
              
              {quiz?.quiz_type === "multiple_choice" ? (
                <div className="space-y-3">
                  {currentQuestion?.options?.map((option, index) => (
                    <Button
                      key={index}
                      variant={userAnswers[currentQuestionIndex] === option ? "default" : "outline"}
                      className={`w-full justify-start text-left h-auto py-3 px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 ${
                        userAnswers[currentQuestionIndex] === option 
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent" 
                          : ""
                      }`}
                      onClick={() => handleAnswerSelection(option)}
                    >
                      <span className="mr-3 text-sm font-medium">{String.fromCharCode(65 + index)}.</span>
                      <span className="text-sm">{option}</span>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant={userAnswers[currentQuestionIndex] === "True" ? "default" : "outline"}
                    className={`flex-1 h-auto py-3 px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 ${
                      userAnswers[currentQuestionIndex] === "True" 
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent" 
                        : ""
                    }`}
                    onClick={() => handleAnswerSelection("True")}
                  >
                    True
                  </Button>
                  <Button
                    variant={userAnswers[currentQuestionIndex] === "False" ? "default" : "outline"}
                    className={`flex-1 h-auto py-3 px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 ${
                      userAnswers[currentQuestionIndex] === "False" 
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white border-transparent" 
                        : ""
                    }`}
                    onClick={() => handleAnswerSelection("False")}
                  >
                    False
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="p-4 md:p-6 pt-0 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="w-full sm:w-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
              onClick={() => {
                if (currentQuestionIndex > 0) {
                  setCurrentQuestionIndex(currentQuestionIndex - 1);
                }
              }}
              disabled={currentQuestionIndex === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
              onClick={handleSubmitAnswerAndNext}
              disabled={selectedOption === null && currentQuestion.question_type !== "short_answer"}
            >
              Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
              onClick={handleFinishQuiz}
              disabled={selectedOption === null && currentQuestion.question_type !== "short_answer"}
            >
              Submit Quiz
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}