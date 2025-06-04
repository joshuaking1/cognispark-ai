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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
        <div className="container mx-auto py-8 px-4 md:px-0">
          <div className="max-w-2xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gradient-to-r from-orange-200 to-blue-200 rounded-lg w-1/4"></div>
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8">
                  <div className="h-32 bg-gradient-to-r from-orange-100 to-blue-100 rounded-lg mb-6"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gradient-to-r from-orange-100 to-blue-100 rounded w-3/4"></div>
                    <div className="h-4 bg-gradient-to-r from-orange-100 to-blue-100 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
        <div className="container mx-auto py-8 px-4 md:px-0">
          <Card className="max-w-2xl mx-auto border-0 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-red-500 flex items-center justify-center gap-2">
                <Info className="h-6 w-6" />
                Error Loading Quiz
              </CardTitle>
              <CardDescription className="text-gray-600 text-base">{error}</CardDescription>
            </CardHeader>
            <CardFooter className="justify-center pt-4">
              <Button 
                onClick={() => router.push('/quizzes')}
                className="bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] hover:from-[#e55a36] hover:to-[#fd6a3e] text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to Quizzes
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
        <div className="container mx-auto py-8 px-4 md:px-0">
          <Card className="max-w-2xl mx-auto border-0 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-[#022e7d] flex items-center justify-center gap-2">
                <Info className="h-6 w-6" />
                Quiz Not Found
              </CardTitle>
              <CardDescription className="text-gray-600 text-base">
                The quiz you're looking for doesn't exist or has no questions.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center pt-4">
              <Button 
                onClick={() => router.push('/quizzes')}
                className="bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] hover:from-[#e55a36] hover:to-[#fd6a3e] text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to Quizzes
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
        <div className="container mx-auto py-8 px-4 md:px-0">
          <Card className="max-w-2xl mx-auto border-0 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-[#022e7d]">Loading Question</CardTitle>
              <CardDescription className="text-gray-600 text-base">
                Please wait while we load your question...
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#fd6a3e]" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const progressValue = quiz ? ((currentQuestionIndex + 1) / quiz.questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
      <div className="container mx-auto py-6 md:py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#022e7d] via-[#1e4a8c] to-[#fd6a3e] bg-clip-text text-transparent mb-3">
              {quiz?.title}
            </h1>
            {quiz?.description && (
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">{quiz.description}</p>
            )}
          </div>

          {/* Progress Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-[#022e7d]">
                Question {currentQuestionIndex + 1} of {quiz?.questions?.length}
              </span>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#fd6a3e]/10 to-[#022e7d]/10 text-sm font-medium text-[#022e7d] border border-[#022e7d]/20">
                {quiz?.quiz_type === "multiple_choice" ? "Multiple Choice" : "True/False"}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${progressValue}%` }}
              ></div>
            </div>
          </div>

          {/* Question Card */}
          <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm mb-6 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#fd6a3e] via-[#ff8c6b] to-[#022e7d]"></div>
            
            <CardHeader className="p-6 md:p-8 pb-4">
              <CardTitle className="text-xl md:text-2xl font-bold text-[#022e7d] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] flex items-center justify-center text-white font-bold shadow-lg">
                  {currentQuestionIndex + 1}
                </div>
                Question {currentQuestionIndex + 1}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-6 md:p-8 pt-0">
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-[#fd6a3e]/5 to-[#022e7d]/5 p-6 rounded-xl border border-[#fd6a3e]/10">
                  <p className="text-lg md:text-xl font-medium text-gray-800 leading-relaxed">
                    {currentQuestion?.question_text}
                  </p>
                </div>
                
                {quiz?.quiz_type === "multiple_choice" ? (
                  <div className="space-y-4">
                    {currentQuestion?.options?.map((option, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className={`w-full justify-start text-left h-auto py-4 px-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                          selectedOption === option
                            ? "bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] text-white border-[#fd6a3e] shadow-xl hover:shadow-2xl"
                            : "bg-white/80 hover:bg-gradient-to-r hover:from-[#fd6a3e]/5 hover:to-[#022e7d]/5 border-gray-200 hover:border-[#fd6a3e]/30 text-gray-700 hover:text-[#022e7d] shadow-md hover:shadow-lg"
                        }`}
                        onClick={() => handleAnswerSelection(option)}
                      >
                        <div className="flex items-center gap-4 w-full">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            selectedOption === option 
                              ? "bg-white/20 text-white" 
                              : "bg-gradient-to-r from-[#fd6a3e]/10 to-[#022e7d]/10 text-[#022e7d]"
                          }`}>
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="text-base font-medium flex-1">{option}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className={`h-auto py-6 px-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                        selectedOption === "True"
                          ? "bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] text-white border-[#fd6a3e] shadow-xl hover:shadow-2xl"
                          : "bg-white/80 hover:bg-gradient-to-r hover:from-[#fd6a3e]/5 hover:to-[#022e7d]/5 border-gray-200 hover:border-[#fd6a3e]/30 text-gray-700 hover:text-[#022e7d] shadow-md hover:shadow-lg"
                      }`}
                      onClick={() => handleAnswerSelection("True")}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <CheckSquare className="h-5 w-5" />
                        <span className="text-lg font-semibold">True</span>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className={`h-auto py-6 px-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                        selectedOption === "False"
                          ? "bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] text-white border-[#fd6a3e] shadow-xl hover:shadow-2xl"
                          : "bg-white/80 hover:bg-gradient-to-r hover:from-[#fd6a3e]/5 hover:to-[#022e7d]/5 border-gray-200 hover:border-[#fd6a3e]/30 text-gray-700 hover:text-[#022e7d] shadow-md hover:shadow-lg"
                      }`}
                      onClick={() => handleAnswerSelection("False")}
                    >
                      <div className="flex items-center justify-center gap-3">
                        <Info className="h-5 w-5" />
                        <span className="text-lg font-semibold">False</span>
                      </div>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="p-6 md:p-8 pt-4 bg-gradient-to-r from-gray-50/50 to-blue-50/30">
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none bg-white/80 hover:bg-white text-[#022e7d] border-[#022e7d]/20 hover:border-[#022e7d]/40 font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                  onClick={() => {
                    if (currentQuestionIndex > 0) {
                      setCurrentQuestionIndex(currentQuestionIndex - 1);
                      setSelectedOption(userAnswers[currentQuestionIndex - 1]?.selectedAnswer || null);
                    }
                  }}
                  disabled={currentQuestionIndex === 0}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                
                {currentQuestionIndex < quiz!.questions.length - 1 ? (
                  <Button
                    className="flex-1 bg-gradient-to-r from-[#022e7d] to-[#1e4a8c] hover:from-[#011a5c] hover:to-[#022e7d] text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    onClick={handleSubmitAnswerAndNext}
                    disabled={selectedOption === null && currentQuestion.question_type !== "short_answer"}
                  >
                    Next Question <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] hover:from-[#e55a36] hover:to-[#fd6a3e] text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    onClick={handleFinishQuiz}
                    disabled={selectedOption === null && currentQuestion.question_type !== "short_answer"}
                  >
                    <CheckSquare className="mr-2 h-5 w-5" />
                    Submit Quiz
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}