"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation"; // useSearchParams if needed
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // npx shadcn-ui@latest add accordion
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, ArrowLeftIcon, CheckIcon, XIcon, Repeat, Trophy, Clock, Target, BarChart2 } from "lucide-react";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer"; // For rendering markdown in questions/explanations
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { getQuizResultsDataAction, type QuizWithFullAnswers, type QuizQuestionWithAnswer } from "@/app/actions/quizActions";

interface UserAnswer { // Should match the structure stored in sessionStorage
  questionId: string;
  selectedAnswer: string;
}

interface ResultQuestion extends QuizQuestionWithAnswer {
  userAnswer?: string;
  isCorrect?: boolean;
}

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

interface Question {
  question_type: QuestionType;
  isCorrect: boolean;
  // ... other properties
}

export default function QuizResultsPage() {
  const params = useParams();
  const router = useRouter();
  const quizId = params.quizId as string;

  const [quizData, setQuizData] = useState<QuizWithFullAnswers | null>(null);
  const [resultQuestions, setResultQuestions] = useState<ResultQuestion[]>([]);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizTitleFromStorage, setQuizTitleFromStorage] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

  useEffect(() => {
    if (quizId) {
      setIsLoading(true);
      setError(null);
      setShowScore(false);
      setProgressValue(0);

      // Retrieve user answers from sessionStorage
      const storedAnswersString = sessionStorage.getItem(`quizAnswers_${quizId}`);
      const storedTitle = sessionStorage.getItem(`quizTitle_${quizId}`);
      if (storedTitle) setQuizTitleFromStorage(storedTitle);

      if (!storedAnswersString) {
        setError("Could not find your answers for this quiz. Please try taking it again.");
        toast.error("Answers Not Found", { description: "Your answers for this quiz session were not found." });
        setIsLoading(false);
        return;
      }

      let userAnswers: UserAnswer[] = [];
      try {
        userAnswers = JSON.parse(storedAnswersString);
      } catch (e) {
        setError("Error reading your answers. Please try taking the quiz again.");
        setIsLoading(false);
        return;
      }

      getQuizResultsDataAction(quizId)
        .then(result => {
          if (result.success && result.quiz) {
            setQuizData(result.quiz);
            let correctCount = 0;
            const processedQuestions: ResultQuestion[] = result.quiz.questions.map(q => {
              const userAnswerObj = userAnswers.find(ua => ua.questionId === q.id);
              const isCorrect = userAnswerObj ? userAnswerObj.selectedAnswer === q.correct_answer : false;
              if (isCorrect) correctCount++;
              return { ...q, userAnswer: userAnswerObj?.selectedAnswer, isCorrect };
            });
            setResultQuestions(processedQuestions);
            const calculatedScore = result.quiz.questions.length > 0 ? Math.round((correctCount / result.quiz.questions.length) * 100) : 0;
            setScore(calculatedScore);

            // Animate score reveal
            setTimeout(() => {
              setShowScore(true);
              // Animate progress bar
              const duration = 1500; // 1.5 seconds
              const steps = 60;
              const increment = calculatedScore / steps;
              let currentStep = 0;
              
              const interval = setInterval(() => {
                currentStep++;
                setProgressValue(Math.min(increment * currentStep, calculatedScore));
                
                if (currentStep >= steps) {
                  clearInterval(interval);
                }
              }, duration / steps);
            }, 500);
          } else {
            setError(result.error || "Could not load quiz results.");
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <div className="max-w-3xl mx-auto">
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
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-red-500">Error Loading Results</CardTitle>
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

  if (!quizData && !isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Quiz Not Found</CardTitle>
            <CardDescription>
              The quiz results you're looking for don't exist or have been removed.
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

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-orange-500 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreMessage = (score: number) => {
    if (score >= 90) return "Outstanding! You've mastered this topic!";
    if (score >= 70) return "Great job! You have a solid understanding.";
    if (score >= 40) return "Good effort! Keep practicing to improve.";
    return "Keep studying! You'll get better with practice.";
  };

  const getQuestionTypeStats = () => {
    const stats = {
      multiple_choice: { total: 0, correct: 0 },
      true_false: { total: 0, correct: 0 },
      short_answer: { total: 0, correct: 0 }
    };

    resultQuestions.forEach(q => {
      const type = q.question_type as QuestionType;
      stats[type].total++;
      if (q.isCorrect) stats[type].correct++;
    });

    return stats;
  };

  return (
    <div className="container mx-auto py-4 md:py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Quiz Results
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {quizData?.title}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
              {quizData?.quiz_type === "multiple_choice" ? "Multiple Choice" : "True/False"}
            </span>
            <span>•</span>
            <span>{quizData?.questions?.length} questions</span>
          </div>
        </div>

        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 mb-6">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">Your Score</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative w-32 h-32 mb-4">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 opacity-20"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {score}%
                  </span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">
                  {score >= 80 ? "Excellent!" : score >= 60 ? "Good job!" : "Keep practicing!"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You got {resultQuestions.filter(q => q.isCorrect).length} out of {quizData?.questions?.length} questions correct
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {resultQuestions.map((question, index) => {
            const userAnswer = question.userAnswer;
            const isCorrect = question.isCorrect;
            
            return (
              <Card 
                key={index}
                className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 transition-all duration-200 ${
                  isCorrect ? "hover:border-green-500/50" : "hover:border-red-500/50"
                }`}
              >
                <CardHeader className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-base md:text-lg">
                        Question {index + 1}
                      </CardTitle>
                      <p className="mt-2 text-sm md:text-base">{question.question_text}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isCorrect 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {isCorrect ? "Correct" : "Incorrect"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-0">
                  <div className="space-y-3">
                    {quizData?.quiz_type === "multiple_choice" ? (
                      question.options?.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className={`p-3 rounded-lg text-sm ${
                            option === question.correct_answer
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : option === userAnswer && !isCorrect
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <span className="font-medium mr-2">{String.fromCharCode(65 + optionIndex)}.</span>
                          {option}
                        </div>
                      ))
                    ) : (
                      <div className="space-y-2">
                        <div className={`p-3 rounded-lg text-sm ${
                          "True" === question.correct_answer
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "True" === userAnswer && !isCorrect
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}>
                          True
                        </div>
                        <div className={`p-3 rounded-lg text-sm ${
                          "False" === question.correct_answer
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "False" === userAnswer && !isCorrect
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}>
                          False
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link href="/quizzes" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
            </Button>
          </Link>
          <Link href={`/quizzes/take/${quizId}`} className="w-full sm:w-auto">
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Retake Quiz
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
} 