"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeftIcon, ArrowRightIcon, RefreshCwIcon, InfoIcon, Brain, Zap, Loader2, CheckCircle2, XOctagon
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer";
import { generateStudyReportAction, getDueFlashcardsForMultipleSetsAction, updateFlashcardSRSDataAction } from "@/app/actions/flashcardActions";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  set_id: string;
  due_date: string | null;
  interval: number | null;
  ease_factor: number | null;
  repetitions: number | null;
  last_reviewed_at: string | null;
}

interface StudyPerformanceData {
  cardId: string;
  question: string;
  quality: 0 | 1 | 2 | 3;
}

// Quality ratings for SRS
const srsQualityRatings = [
  { label: "Again", value: 0, color: "bg-red-500 hover:bg-red-600", icon: <XOctagon className="mr-2 h-4 w-4"/> },
  { label: "Hard", value: 1, color: "bg-orange-500 hover:bg-orange-600", icon: <Brain className="mr-2 h-4 w-4"/> },
  { label: "Good", value: 2, color: "bg-green-500 hover:bg-green-600", icon: <CheckCircle2 className="mr-2 h-4 w-4"/> },
  { label: "Easy", value: 3, color: "bg-blue-500 hover:bg-blue-600", icon: <Zap className="mr-2 h-4 w-4"/> },
];

export default function StudySessionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setIds = searchParams.get('sets')?.split(',') || [];
  
  const [studySessionCards, setStudySessionCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionProgress, setSessionProgress] = useState(0);
  const [studyReport, setStudyReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [sessionPerformance, setSessionPerformance] = useState<StudyPerformanceData[]>([]);
  const [profile, setProfile] = useState<{ grade_level: string | null } | null>(null);
  const [setTitles, setSetTitles] = useState<Record<string, string>>({});

  const supabase = createPagesBrowserClient();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('grade_level')
          .eq('id', user.id)
          .single();
        setProfile(profileData);
      }
    };
    fetchProfile();
  }, [supabase]);

  const fetchDueCards = useCallback(async () => {
    if (setIds.length === 0) {
      setError("No flashcard sets selected.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await getDueFlashcardsForMultipleSetsAction(setIds);
      if (result.success && result.dueCards) {
        setStudySessionCards(result.dueCards.sort(() => Math.random() - 0.5));
        setCurrentCardIndex(0);
        setIsShowingAnswer(false);
        setSessionProgress(0);
        if (result.setTitles) {
          setSetTitles(result.setTitles);
        }
        if (result.dueCards.length === 0) {
          toast.info("No cards due for review right now!", { description: "Great job, or come back later." });
          router.push('/flashcards');
        }
      } else {
        toast.error("Failed to load due cards", { description: result.error });
        router.push('/flashcards');
      }
    } catch (e: any) {
      toast.error("Error fetching due cards", { description: e.message });
      router.push('/flashcards');
    } finally {
      setIsLoading(false);
    }
  }, [setIds, router]);

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  const currentCard = studySessionCards[currentCardIndex];

  const handleFlipCard = () => setIsShowingAnswer(!isShowingAnswer);

  const handleNavigateCard = (direction: 'next' | 'prev') => {
    if (!studySessionCards || studySessionCards.length === 0) return;
    let newIndex = currentCardIndex;
    if (direction === 'next' && currentCardIndex < studySessionCards.length - 1) {
      newIndex = currentCardIndex + 1;
    } else if (direction === 'prev' && currentCardIndex > 0) {
      newIndex = currentCardIndex - 1;
    }
    setCurrentCardIndex(newIndex);
    setIsShowingAnswer(false);
    setSessionProgress(((newIndex + 1) / studySessionCards.length) * 100);
  };

  const handleSRSResponse = async (quality: 0 | 1 | 2 | 3) => {
    if (!currentCard) return;
    
    // Add to session performance data
    setSessionPerformance(prev => [...prev, {
      cardId: currentCard.id,
      question: currentCard.question,
      quality
    }]);

    toast.promise(
      updateFlashcardSRSDataAction(currentCard.id, quality),
      {
        loading: 'Updating review status...',
        success: (result) => {
          if (result.success) {
            if (currentCardIndex < studySessionCards.length - 1) {
              handleNavigateCard('next');
            } else {
              // Study session complete - generate report
              toast.success("Study session complete! Generating your report...");
              setIsGeneratingReport(true);
              const userGrade = profile?.grade_level;
              
              // Get all set titles for the report
              const allSetTitles = Object.values(setTitles).join(", ");
              
              generateStudyReportAction(allSetTitles, sessionPerformance, userGrade)
                .then(reportResult => {
                  if (reportResult.success && reportResult.report) {
                    setStudyReport(reportResult.report);
                  } else {
                    toast.error("Failed to generate study report", { description: reportResult.error });
                  }
                })
                .catch(err => toast.error("Report Error", { description: err.message }))
                .finally(() => {
                  setIsGeneratingReport(false);
                  setSessionPerformance([]);
                });
            }
            return "Card review updated!";
          } else {
            throw new Error(result.error || "Failed to update card.");
          }
        },
        error: (err) => `Error: ${err.message}`,
      }
    );
  };

  const handleShuffleCards = () => {
    if (studySessionCards.length > 0) {
      const shuffled = [...studySessionCards].sort(() => Math.random() - 0.5);
      setStudySessionCards(shuffled);
      setCurrentCardIndex(0);
      setIsShowingAnswer(false);
      toast.info("Cards shuffled!");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="min-h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0 text-center">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="py-8">
            <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Study Session</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/flashcards')}>Back to My Sets</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentCard && studySessionCards.length > 0 && !isLoading) {
    return <div className="container mx-auto py-8 text-center">Loading card...</div>;
  }

  return (
    <div className="container mx-auto py-4 md:py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <Button 
          variant="outline" 
          onClick={() => router.push('/flashcards')}
          className="w-full sm:w-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to My Sets
        </Button>
        <Button 
          variant="outline" 
          onClick={handleShuffleCards}
          className="w-full sm:w-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
        >
          <RefreshCwIcon className="mr-2 h-4 w-4" /> Shuffle Cards
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto shadow-lg bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Studying Multiple Sets
          </CardTitle>
          <CardDescription className="text-sm md:text-base pt-1">
            {Object.values(setTitles).join(", ")}
          </CardDescription>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2">
            <p className="text-sm text-muted-foreground">
              Card {currentCardIndex + 1} of {studySessionCards.length}
            </p>
            <div className="w-full sm:w-48">
              <Progress 
                value={sessionProgress} 
                className="h-2 bg-slate-100 dark:bg-slate-800" 
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-h-[200px] md:min-h-[300px] flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden border-t border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="w-full text-center space-y-4">
            <div className="text-lg md:text-xl lg:text-2xl font-medium mb-4">
              {isShowingAnswer ? currentCard?.answer : currentCard?.question}
            </div>
            {currentCard && (
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs">
                  From: {setTitles[currentCard.set_id] || "Unknown Set"}
                </span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
            <Button 
              variant="outline" 
              onClick={handleFlipCard}
              className="w-full sm:w-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
            >
              {isShowingAnswer ? "Show Question" : "Show Answer"}
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => handleNavigateCard('prev')} 
                disabled={currentCardIndex === 0}
                className="flex-1 sm:flex-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
              >
                <ArrowLeftIcon className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleNavigateCard('next')} 
                disabled={currentCardIndex === studySessionCards.length - 1}
                className="flex-1 sm:flex-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
              >
                Next <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Study Report Dialog */}
      {studyReport && (
        <AlertDialog open={!!studyReport} onOpenChange={() => setStudyReport(null)}>
          <AlertDialogContent className="max-w-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Your Study Session Report</AlertDialogTitle>
              <AlertDialogDescription>
                Here are some insights from Nova based on your recent review:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-[60vh] pr-2">
              <ChatMessageContentRenderer content={studyReport} />
            </ScrollArea>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => {
                setStudyReport(null);
                router.push('/flashcards');
              }}>Back to My Sets</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
} 