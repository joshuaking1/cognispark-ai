"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation"; // useSearchParams if needed
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"; // npx shadcn-ui@latest add accordion
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, ArrowLeftIcon, CheckIcon, XIcon, Repeat, Trophy, Clock, Target, BarChart2, Award, Star } from "lucide-react";
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
        <div className="container mx-auto py-8 px-4 md:px-0">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gradient-to-r from-orange-200 to-blue-200 rounded-lg w-1/3"></div>
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8">
                  <div className="flex justify-center mb-6">
                    <div className="w-32 h-32 bg-gradient-to-r from-orange-100 to-blue-100 rounded-full"></div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gradient-to-r from-orange-100 to-blue-100 rounded w-2/3 mx-auto"></div>
                    <div className="h-3 bg-gradient-to-r from-orange-100 to-blue-100 rounded w-1/2 mx-auto"></div>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="h-20 bg-gradient-to-r from-orange-100 to-blue-100 rounded-lg"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
          <Card className="max-w-3xl mx-auto border-0 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-red-500 flex items-center justify-center gap-2">
                <XIcon className="h-6 w-6" />
                Error Loading Results
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

  if (!quizData && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
        <div className="container mx-auto py-8 px-4 md:px-0">
          <Card className="max-w-3xl mx-auto border-0 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold text-[#022e7d] flex items-center justify-center gap-2">
                <Target className="h-6 w-6" />
                Quiz Not Found
              </CardTitle>
              <CardDescription className="text-gray-600 text-base">
                The quiz results you're looking for don't exist or have been removed.
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

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <Trophy className="h-8 w-8 text-yellow-500" />;
    if (score >= 70) return <Award className="h-8 w-8 text-green-500" />;
    if (score >= 40) return <Star className="h-8 w-8 text-orange-500" />;
    return <Target className="h-8 w-8 text-red-500" />;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40">
      <div className="container mx-auto py-6 md:py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#022e7d] via-[#1e4a8c] to-[#fd6a3e] bg-clip-text text-transparent mb-3">
              Quiz Results
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {quizData?.title}
            </p>
            <div className="flex justify-center items-center gap-4 mt-4">
              <span className="px-4 py-2 rounded-full bg-gradient-to-r from-[#fd6a3e]/10 to-[#022e7d]/10 text-sm font-medium text-[#022e7d] border border-[#022e7d]/20">
                {quizData?.quiz_type === "multiple_choice" ? "Multiple Choice" : "True/False"}
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-sm font-medium text-[#022e7d]">{quizData?.questions?.length} questions</span>
            </div>
          </div>

          {/* Score Card */}
          <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm mb-8 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#fd6a3e] via-[#ff8c6b] to-[#022e7d]"></div>
            
            <CardContent className="p-8 md:p-12">
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  {getScoreIcon(score)}
                </div>
                
                <div className="relative inline-block mb-6">
                  <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-r from-[#fd6a3e]/10 to-[#022e7d]/10 flex items-center justify-center border-4 border-gradient-to-r from-[#fd6a3e]/20 to-[#022e7d]/20">
                    <div className="text-center">
                      <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent mb-2">
                        {showScore ? score : 0}%
                      </div>
                      <div className="text-sm font-medium text-gray-600">
                        Your Score
                      </div>
                    </div>
                  </div>
                  
                  {/* Animated Progress Ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="url(#scoreGradient)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - progressValue / 100)}`}
                      className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#fd6a3e" />
                        <stop offset="100%" stopColor="#022e7d" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-2xl md:text-3xl font-bold text-[#022e7d]">
                    {getScoreMessage(score)}
                  </h2>
                  <p className="text-lg text-gray-600">
                    You answered <span className="font-bold text-[#fd6a3e]">{resultQuestions.filter(q => q.isCorrect).length}</span> out of <span className="font-bold text-[#022e7d]">{quizData?.questions?.length}</span> questions correctly
                  </p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  <div className="bg-gradient-to-r from-green-50 to-green-100/50 p-4 rounded-xl border border-green-200/50">
                    <div className="text-2xl font-bold text-green-600">
                      {resultQuestions.filter(q => q.isCorrect).length}
                    </div>
                    <div className="text-sm font-medium text-green-700">Correct</div>
                  </div>
                  <div className="bg-gradient-to-r from-red-50 to-red-100/50 p-4 rounded-xl border border-red-200/50">
                    <div className="text-2xl font-bold text-red-600">
                      {resultQuestions.filter(q => !q.isCorrect).length}
                    </div>
                    <div className="text-sm font-medium text-red-700">Incorrect</div>
                  </div>
                  <div className="bg-gradient-to-r from-[#fd6a3e]/5 to-[#022e7d]/5 p-4 rounded-xl border border-[#fd6a3e]/20">
                    <div className="text-2xl font-bold text-[#022e7d]">
                      {Math.round(((resultQuestions.filter(q => q.isCorrect).length) / (quizData?.questions?.length || 1)) * 100)}%
                    </div>
                    <div className="text-sm font-medium text-[#fd6a3e]">Accuracy</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Questions Review */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-[#022e7d] text-center mb-6">Question Review</h3>
            
            {resultQuestions.map((question, index) => {
              const userAnswer = question.userAnswer;
              const isCorrect = question.isCorrect;
              
              return (
                <Card 
                  key={index}
                  className="border-0 shadow-xl bg-white/90 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl"
                >
                  <div className={`h-1 ${isCorrect ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`}></div>
                  
                  <CardHeader className="p-6 md:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${
                            isCorrect ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-red-600'
                          }`}>
                            {index + 1}
                          </div>
                          <CardTitle className="text-lg md:text-xl text-[#022e7d]">
                            Question {index + 1}
                          </CardTitle>
                        </div>
                        <div className="bg-gradient-to-r from-[#fd6a3e]/5 to-[#022e7d]/5 p-4 rounded-lg border border-[#fd6a3e]/10">
                          <p className="text-base md:text-lg font-medium text-gray-800">{question.question_text}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg ${
                        isCorrect 
                          ? "bg-gradient-to-r from-green-500 to-green-600 text-white" 
                          : "bg-gradient-to-r from-red-500 to-red-600 text-white"
                      }`}>
                        {isCorrect ? <CheckIcon className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
                        {isCorrect ? "Correct" : "Incorrect"}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6 md:p-8 pt-0">
                    <div className="space-y-3">
                      {quizData?.quiz_type === "multiple_choice" ? (
                        question.options?.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className={`p-4 rounded-xl text-sm md:text-base font-medium transition-all duration-200 border-2 ${
                              option === question.correct_answer
                                ? "bg-gradient-to-r from-green-50 to-green-100 border-green-300 text-green-800 shadow-md"
                                : option === userAnswer && !isCorrect
                                ? "bg-gradient-to-r from-red-50 to-red-100 border-red-300 text-red-800 shadow-md"
                                : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-700"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                option === question.correct_answer
                                  ? "bg-green-200 text-green-800"
                                  : option === userAnswer && !isCorrect
                                  ? "bg-red-200 text-red-800"
                                  : "bg-gray-200 text-gray-600"
                              }`}>
                                {String.fromCharCode(65 + optionIndex)}
                              </div>
                              <span className="flex-1">{option}</span>
                              {option === question.correct_answer && <CheckIcon className="h-5 w-5 text-green-600" />}
                              {option === userAnswer && !isCorrect && <XIcon className="h-5 w-5 text-red-600" />}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className={`p-4 rounded-xl text-base font-medium transition-all duration-200 border-2 ${
                            "True" === question.correct_answer
                              ? "bg-gradient-to-r from-green-50 to-green-100 border-green-300 text-green-800 shadow-md"
                              : "True" === userAnswer && !isCorrect
                              ? "bg-gradient-to-r from-red-50 to-red-100 border-red-300 text-red-800 shadow-md"
                              : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-700"
                          }`}>
                            <div className="flex items-center justify-center gap-3">
                              <CheckIcon className="h-5 w-5" />
                              <span className="font-bold">True</span>
                              {"True" === question.correct_answer && <CheckIcon className="h-5 w-5 text-green-600" />}
                              {"True" === userAnswer && !isCorrect && <XIcon className="h-5 w-5 text-red-600" />}
                            </div>
                          </div>
                          <div className={`p-4 rounded-xl text-base font-medium transition-all duration-200 border-2 ${
                            "False" === question.correct_answer
                              ? "bg-gradient-to-r from-green-50 to-green-100 border-green-300 text-green-800 shadow-md"
                              : "False" === userAnswer && !isCorrect
                              ? "bg-gradient-to-r from-red-50 to-red-100 border-red-300 text-red-800 shadow-md"
                              : "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 text-gray-700"
                          }`}>
                            <div className="flex items-center justify-center gap-3">
                              <XIcon className="h-5 w-5" />
                              <span className="font-bold">False</span>
                              {"False" === question.correct_answer && <CheckIcon className="h-5 w-5 text-green-600" />}
                              {"False" === userAnswer && !isCorrect && <XIcon className="h-5 w-5 text-red-600" />}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/quizzes" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full bg-white/80 hover:bg-white text-[#022e7d] border-[#022e7d]/20 hover:border-[#022e7d]/40 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Back to Quizzes
              </Button>
            </Link>
            <Link href={`/quizzes/take/${quizId}`} className="w-full sm:w-auto">
              <Button
                className="w-full bg-gradient-to-r from-[#fd6a3e] to-[#ff8c6b] hover:from-[#e55a36] hover:to-[#fd6a3e] text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <RefreshCw className="mr-2 h-5 w-5" /> Retake Quiz
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}