// src/app/quizzes/create/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createPagesBrowserClient, User } from "@supabase/auth-helpers-nextjs";
import Joyride, { CallBackProps, Step, STATUS } from "react-joyride";
import { useFeatureTour } from "@/hooks/useFeatureTour";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Wand2, Minus, Plus, RotateCcw, Sparkles } from "lucide-react";
import { generateQuizAction } from "@/app/actions/quizActions";

const quizTypes = [
  { value: "multiple_choice", label: "Multiple Choice (4 options)" },
  { value: "true_false", label: "True/False" },
];

export default function CreateQuizPage() {
  const router = useRouter();
  const supabase = createPagesBrowserClient();

  const [quizTitle, setQuizTitle] = useState("");
  const [sourceType, setSourceType] = useState<"topic" | "text">("topic");
  const [sourceContent, setSourceContent] = useState("");
  const [selectedQuizType, setSelectedQuizType] = useState<string>(quizTypes[0].value);
  const [selectedNumQuestions, setSelectedNumQuestions] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const tourSteps: Step[] = [
    {
      target: ".quiz-create-page",
      content: "Welcome to Nova's Quiz Generator! This tool helps you create custom quizzes on any topic.",
      disableBeacon: true,
      placement: "center",
    },
    {
      target: ".quiz-title-input",
      content: "Start by giving your quiz a descriptive title.",
      placement: "bottom",
    },
    {
      target: ".source-type-selector",
      content: "Choose whether to generate a quiz based on a topic or from your own text material.",
      placement: "bottom",
    },
    {
      target: ".source-content-input",
      content: "Enter your topic or paste your study material here. The more specific you are, the better your quiz will be.",
      placement: "top",
    },
    {
      target: ".quiz-type-selector-container",
      content: "Select the type of questions you want in your quiz - multiple choice or true/false.",
      placement: "bottom",
    },
    {
      target: ".question-count-selector-container",
      content: "Choose how many questions you want in your quiz.",
      placement: "bottom",
    },
    {
      target: ".generate-button",
      content: "Click here to generate your quiz. Nova will create tailored questions based on your input.",
      placement: "bottom",
    },
  ];

  const handleTourEnd = useCallback(async (userId: string) => {
    try {
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('completed_tours')
        .eq('id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: row not found
        console.error('Error fetching profile for onTourEnd:', fetchError.message);
        return;
      }

      const completedTours = profile?.completed_tours || [];
      if (!completedTours.includes('quiz_generator')) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ completed_tours: [...completedTours, 'quiz_generator'] })
          .eq('id', userId);
        if (updateError) {
          console.error('Error updating completed_tours:', updateError.message);
        }
      }
    } catch (e: any) {
      console.error('Error in onTourEnd callback:', e.message);
    }
  }, [supabase]);

  const joyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || type === 'tour:end') {
      if (currentUser?.id) {
        handleTourEnd(currentUser.id);
      }
    }
  };

  const { runTour, startTour } = useFeatureTour({
    tourKey: "quiz_generator",
    steps: tourSteps,
    isTourEnabledInitially: false, // Will be controlled by useEffect
    joyrideCallbackInternal: joyrideCallback, // Pass the combined callback
  });

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        try {
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('completed_tours')
            .eq('id', session.user.id)
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116: row not found, treat as new user
            console.error('Error fetching user profile for tour:', error.message);
            startTour(); // Start tour if profile fetch fails but user is logged in
            return;
          }
          
          const completedTours = profile?.completed_tours || [];
          if (!completedTours.includes('quiz_generator')) {
            startTour();
          }
        } catch (err: any) {
          console.error('Error fetching profile or starting tour:', err.message);
          startTour(); // Fallback to start tour if any error in try block
        }
      } else {
        // No session, user not logged in. Tour won't start.
      }
    };

    fetchUserAndProfile();
  }, [supabase, startTour]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quizTitle.trim()) {
      toast.error("Missing Quiz Title", { description: "Please provide a title for your quiz." });
      return;
    }
    if (!sourceContent.trim()) {
      toast.error("Missing Source Material", { description: `Please provide a ${sourceType === "topic" ? "topic" : "study material text"}.` });
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
        router.push(`/quizzes/take/${result.quizId}`);
      } else {
        toast.error("Quiz Generation Failed", { description: result.error || "Could not generate quiz. Please try again." });
      }
    } catch (error: any) {
      console.error("Quiz generation client-side error:", error);
      toast.error("An Unexpected Error Occurred", { description: error.message || "Please check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setQuizTitle("");
    setSourceType("topic");
    setSourceContent("");
    setSelectedQuizType(quizTypes[0].value);
    setSelectedNumQuestions(10);
    toast.info("Form Reset", { description: "Quiz settings have been reset to default." });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-orange-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto py-6 md:py-12 px-4 quiz-create-page">
        <Joyride
          steps={tourSteps}
          run={runTour}
          continuous
          showSkipButton
          showProgress
          callback={joyrideCallback} // Use the combined callback
          styles={{
            options: {
              primaryColor: '#fd6a3e',
              zIndex: 1000,
              arrowColor: '#FFFFFF',
              backgroundColor: '#FFFFFF',
              textColor: '#333333',
            },
            tooltipContainer: {
              textAlign: 'left',
            },
            buttonNext: {
              backgroundColor: '#fd6a3e',
              borderRadius: '8px',
            },
            buttonBack: {
              color: '#022e7d',
              marginRight: 'auto',
              borderRadius: '8px',
            },
            buttonSkip: {
              color: '#777777',
              fontSize: '0.875rem',
            }
          }}
        />
        
        <div className="max-w-3xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#fd6a3e] to-[#ff8c42] rounded-2xl shadow-lg mb-6">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-[#022e7d] via-[#1e40af] to-[#fd6a3e] bg-clip-text text-transparent mb-4 tracking-tight">
              Create Your Quiz
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Transform your study materials into engaging quizzes with our AI-powered generator. 
              Perfect for learning, teaching, or testing knowledge.
            </p>
          </div>

          {/* Main Card */}
          <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-0 shadow-2xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-3xl overflow-hidden">
            {/* Card Header with Gradient */}
            <div className="bg-gradient-to-r from-[#022e7d] to-[#1e40af] p-8 text-white">
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Wand2 className="w-5 h-5" />
                </div>
                Quiz Configuration
              </CardTitle>
              <CardDescription className="text-blue-100 mt-2 text-base">
                Customize your quiz settings to create the perfect learning experience.
              </CardDescription>
            </div>

            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Quiz Title */}
                <div className="space-y-3">
                  <Label htmlFor="quizTitle" className="text-base font-semibold text-[#022e7d] dark:text-slate-200 flex items-center gap-2">
                    Quiz Title
                    <span className="text-[#fd6a3e]">*</span>
                  </Label>
                  <Input
                    id="quizTitle"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="E.g., 'Advanced Physics: Quantum Mechanics'"
                    className="h-12 text-base bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 focus:border-[#fd6a3e] focus:ring-2 focus:ring-[#fd6a3e]/20 quiz-title-input rounded-xl transition-all duration-200"
                    disabled={isLoading}
                  />
                </div>

                {/* Source Type Toggle */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-[#022e7d] dark:text-slate-200">
                    Content Source
                  </Label>
                  <div className="grid grid-cols-2 gap-3 p-2 bg-slate-100 dark:bg-slate-800 rounded-2xl source-type-selector">
                    <Button
                      type="button"
                      variant={sourceType === "topic" ? "default" : "ghost"}
                      className={`h-12 text-base font-medium rounded-xl transition-all duration-300 ${
                        sourceType === "topic" 
                          ? "bg-gradient-to-r from-[#022e7d] to-[#1e40af] text-white shadow-lg transform scale-105" 
                          : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-[#022e7d]"
                      }`}
                      onClick={() => setSourceType("topic")}
                      disabled={isLoading}
                    >
                      📚 Topic-Based
                    </Button>
                    <Button
                      type="button"
                      variant={sourceType === "text" ? "default" : "ghost"}
                      className={`h-12 text-base font-medium rounded-xl transition-all duration-300 ${
                        sourceType === "text" 
                          ? "bg-gradient-to-r from-[#022e7d] to-[#1e40af] text-white shadow-lg transform scale-105" 
                          : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-[#022e7d]"
                      }`}
                      onClick={() => setSourceType("text")}
                      disabled={isLoading}
                    >
                      📄 Custom Material
                    </Button>
                  </div>
                </div>

                {/* Source Content */}
                <div className="space-y-3">
                  <Label htmlFor="sourceContent" className="text-base font-semibold text-[#022e7d] dark:text-slate-200 flex items-center gap-2">
                    {sourceType === "topic" ? "Study Topic" : "Study Material"}
                    <span className="text-[#fd6a3e]">*</span>
                  </Label>
                  {sourceType === "topic" ? (
                    <Input
                      id="sourceContent"
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                      placeholder="E.g., 'Machine Learning Algorithms', 'World War II History'"
                      className="h-12 text-base bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 focus:border-[#fd6a3e] focus:ring-2 focus:ring-[#fd6a3e]/20 source-content-input rounded-xl transition-all duration-200"
                      disabled={isLoading}
                    />
                  ) : (
                    <Textarea
                      id="sourceContent"
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                      placeholder="Paste your study notes, textbook excerpts, articles, or any educational content here. The more detailed your material, the better your quiz will be!"
                      className="min-h-[200px] text-base bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 focus:border-[#fd6a3e] focus:ring-2 focus:ring-[#fd6a3e]/20 source-content-input rounded-xl transition-all duration-200 resize-none"
                      disabled={isLoading}
                    />
                  )}
                </div>
                
                {/* Quiz Settings Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Quiz Type */}
                  <div className="quiz-type-selector-container space-y-3">
                    <Label htmlFor="quizType" className="text-base font-semibold text-[#022e7d] dark:text-slate-200">
                      Question Type
                    </Label>
                    <Select
                      value={selectedQuizType}
                      onValueChange={(value) => setSelectedQuizType(value as "multiple_choice" | "true_false")}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-12 text-base bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 focus:border-[#fd6a3e] focus:ring-2 focus:ring-[#fd6a3e]/20 rounded-xl">
                        <SelectValue placeholder="Choose question format" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl">
                        {quizTypes.map(qt => (
                          <SelectItem 
                            key={qt.value} 
                            value={qt.value} 
                            className="text-base py-3 hover:bg-[#fd6a3e]/10 focus:bg-[#fd6a3e]/10 hover:text-[#022e7d] rounded-lg"
                          >
                            {qt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Question Count */}
                  <div className="question-count-selector-container space-y-3">
                    <Label htmlFor="numQuestions" className="text-base font-semibold text-[#022e7d] dark:text-slate-200">
                      Number of Questions
                    </Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 border-2 border-slate-200 dark:border-slate-700 hover:border-[#fd6a3e] hover:bg-[#fd6a3e]/10 hover:text-[#fd6a3e] rounded-xl transition-all duration-200"
                        onClick={() => setSelectedNumQuestions(prev => Math.max(1, prev - 1))}
                        disabled={isLoading || selectedNumQuestions <= 1}
                      >
                        <Minus className="h-5 w-5" />
                      </Button>
                      <div className="flex-1 relative">
                        <Input
                          id="numQuestions"
                          type="number"
                          min={1}
                          max={20}
                          value={selectedNumQuestions}
                          onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (isNaN(val)) setSelectedNumQuestions(1);
                              else setSelectedNumQuestions(Math.min(20, Math.max(1, val)));
                          }}
                          className="h-12 text-center text-lg font-semibold bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-700 focus:border-[#fd6a3e] focus:ring-2 focus:ring-[#fd6a3e]/20 rounded-xl"
                          disabled={isLoading}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 border-2 border-slate-200 dark:border-slate-700 hover:border-[#fd6a3e] hover:bg-[#fd6a3e]/10 hover:text-[#fd6a3e] rounded-xl transition-all duration-200"
                        onClick={() => setSelectedNumQuestions(prev => Math.min(20, prev + 1))}
                        disabled={isLoading || selectedNumQuestions >= 20}
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                      Recommended: 5-15 questions for optimal engagement
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t-2 border-slate-100 dark:border-slate-800">
                  <Button
                    type="submit"
                    className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-[#fd6a3e] to-[#ff8c42] hover:from-[#e55a35] hover:to-[#fd6a3e] text-white shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300 generate-button rounded-2xl"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                        Generating Your Quiz...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-3 h-6 w-6" />
                        Generate Quiz
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="sm:w-auto h-14 text-lg font-medium border-2 border-slate-200 dark:border-slate-700 hover:border-[#022e7d] hover:bg-[#022e7d]/5 text-[#022e7d] dark:text-slate-300 transform hover:scale-[1.02] transition-all duration-300 rounded-2xl"
                    onClick={handleReset}
                    disabled={isLoading}
                  >
                    <RotateCcw className="mr-3 h-5 w-5" />
                    Reset Form
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Footer Note */}
          <div className="text-center mt-8 p-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            <p className="text-slate-600 dark:text-slate-300 text-sm">
              🚀 <span className="font-semibold text-[#022e7d] dark:text-[#fd6a3e]">Pro Tip:</span> The more specific and detailed your input, 
              the more accurate and challenging your quiz will be!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}