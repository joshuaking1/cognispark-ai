"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
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
import { generateStudyReportAction, getDueFlashcardsForMultipleSetsAction, updateFlashcardSRSDataAction, FlashcardForClient } from "@/app/actions/flashcardActions";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

interface StudyPerformanceData {
  cardId: string;
  question: string;
  quality: 0 | 1 | 2 | 3;
}

// Quality ratings for SRS with brand colors
const srsQualityRatings = [
  { label: "Again", value: 0, color: "#ef4444", hoverColor: "#dc2626", icon: <XOctagon className="mr-2 h-4 w-4"/> },
  { label: "Hard", value: 1, color: "#f97316", hoverColor: "#ea580c", icon: <Brain className="mr-2 h-4 w-4"/> },
  { label: "Good", value: 2, color: "#fd6a3e", hoverColor: "#ff7849", icon: <CheckCircle2 className="mr-2 h-4 w-4"/> },
  { label: "Easy", value: 3, color: "#022e7d", hoverColor: "#033a94", icon: <Zap className="mr-2 h-4 w-4"/> },
];

function StudySessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setIds = searchParams.get('sets')?.split(',') || [];
  
  const [studySessionCards, setStudySessionCards] = useState<FlashcardForClient[]>([]);
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
              toast.success("Study session complete! Generating your report...");
              setIsGeneratingReport(true);
              const userGrade = profile?.grade_level;
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
      <div 
        className="min-h-screen"
        style={{
          background: `linear-gradient(135deg, #fef7f0 0%, #f0f4ff 50%, #fef7f0 100%)`
        }}
      >
        <div className="container mx-auto py-8 px-4 md:px-0">
          <Card className="max-w-2xl mx-auto shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="min-h-[300px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: '#fd6a3e' }} />
                <p className="text-slate-600 font-medium">Loading your study session...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="min-h-screen"
        style={{
          background: `linear-gradient(135deg, #fef7f0 0%, #f0f4ff 50%, #fef7f0 100%)`
        }}
      >
        <div className="container mx-auto py-8 px-4 md:px-0 text-center">
          <Card className="max-w-2xl mx-auto shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="py-8">
              <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Study Session</h2>
              <p className="text-slate-600 mb-4">{error}</p>
              <Button 
                onClick={() => router.push('/flashcards')}
                className="text-white font-semibold"
                style={{
                  background: `linear-gradient(135deg, #fd6a3e 0%, #022e7d 100%)`
                }}
              >
                Back to My Sets
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!currentCard && studySessionCards.length > 0 && !isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, #fef7f0 0%, #f0f4ff 50%, #fef7f0 100%)`
        }}
      >
        <div className="container mx-auto py-8 text-center">Loading card...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen relative"
      style={{
        background: `linear-gradient(135deg, #fef7f0 0%, #f0f4ff 50%, #fef7f0 100%)`
      }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `radial-gradient(circle at 25% 25%, rgba(253, 106, 62, 0.1) 0%, transparent 50%), 
                         radial-gradient(circle at 75% 75%, rgba(2, 46, 125, 0.1) 0%, transparent 50%),
                         radial-gradient(circle at 50% 0%, rgba(253, 106, 62, 0.05) 0%, transparent 50%)`
      }} />

      <div className="container mx-auto py-4 md:py-8 px-4 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => router.push('/flashcards')}
            className="w-full sm:w-auto border-2 hover:scale-105 transition-all duration-200 shadow-md"
            style={{
              borderColor: '#fd6a3e',
              color: '#fd6a3e'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fd6a3e';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(253, 106, 62, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#fd6a3e';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to My Sets
          </Button>
          <Button 
            variant="outline" 
            onClick={handleShuffleCards}
            className="w-full sm:w-auto border-2 hover:scale-105 transition-all duration-200 shadow-md"
            style={{
              borderColor: '#022e7d',
              color: '#022e7d'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#022e7d';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(2, 46, 125, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#022e7d';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
          >
            <RefreshCwIcon className="mr-2 h-4 w-4" /> Shuffle Cards
          </Button>
        </div>

        <Card className="max-w-2xl mx-auto shadow-2xl border-0 bg-white/95 backdrop-blur-sm relative overflow-hidden">
          {/* Card gradient overlay */}
          <div className="absolute inset-0 rounded-lg" style={{
            background: `linear-gradient(135deg, rgba(2, 46, 125, 0.03) 0%, rgba(253, 106, 62, 0.03) 100%)`
          }} />

          <CardHeader className="pb-4 relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl shadow-lg" style={{
                background: `linear-gradient(135deg, #fd6a3e 0%, #022e7d 100%)`
              }}>
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl md:text-2xl lg:text-3xl font-bold" style={{
                  background: `linear-gradient(135deg, #022e7d 0%, #fd6a3e 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  Studying Multiple Sets
                </CardTitle>
                <CardDescription className="text-sm md:text-base pt-1 text-slate-600">
                  {Object.values(setTitles).join(", ")}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2">
              <p className="text-sm text-slate-600 font-medium">
                Card {currentCardIndex + 1} of {studySessionCards.length}
              </p>
              <div className="w-full sm:w-48">
                <Progress 
                  value={sessionProgress} 
                  className="h-3" 
                  style={{
                    background: '#e2e8f0'
                  }}
                />
                <style jsx>{`
                  .progress-bar {
                    background: linear-gradient(135deg, #fd6a3e 0%, #022e7d 100%);
                  }
                `}</style>
              </div>
            </div>
          </CardHeader>

          <CardContent className="min-h-[200px] md:min-h-[300px] flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden border-t border-b border-slate-100">
            <div className="w-full text-center space-y-4 relative z-10">
              <div className="text-lg md:text-xl lg:text-2xl font-medium mb-4 text-slate-800 leading-relaxed">
                {isShowingAnswer ? currentCard?.answer : currentCard?.question}
              </div>
              {currentCard && (
                <div className="text-sm text-slate-600 flex items-center justify-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-medium" style={{
                    background: 'rgba(253, 106, 62, 0.1)',
                    color: '#fd6a3e'
                  }}>
                    From: {setTitles[currentCard.set_id] || "Unknown Set"}
                  </span>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-6 relative">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
              <Button 
                variant="outline" 
                onClick={handleFlipCard}
                className="w-full sm:w-auto border-2 px-6 py-3 font-semibold hover:scale-105 transition-all duration-200"
                style={{
                  borderColor: '#fd6a3e',
                  color: '#fd6a3e'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fd6a3e';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#fd6a3e';
                }}
              >
                {isShowingAnswer ? "Show Question" : "Show Answer"}
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => handleNavigateCard('prev')} 
                  disabled={currentCardIndex === 0}
                  className="flex-1 sm:flex-none border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ArrowLeftIcon className="mr-2 h-4 w-4" /> Previous
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleNavigateCard('next')} 
                  disabled={currentCardIndex === studySessionCards.length - 1}
                  className="flex-1 sm:flex-none border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {isShowingAnswer && (
              <>
                <p className="text-sm text-slate-600 font-medium">How well did you recall the answer?</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                  {srsQualityRatings.map(rating => (
                    <Button
                      key={rating.value}
                      onClick={() => handleSRSResponse(rating.value as 0|1|2|3)}
                      className="text-white transition-all duration-200 hover:scale-105 shadow-lg font-semibold"
                      style={{
                        background: rating.color,
                        boxShadow: `0 4px 15px ${rating.color}30`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = rating.hoverColor;
                        e.currentTarget.style.boxShadow = `0 6px 20px ${rating.color}40`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = rating.color;
                        e.currentTarget.style.boxShadow = `0 4px 15px ${rating.color}30`;
                      }}
                    >
                      {rating.icon} {rating.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </CardFooter>
        </Card>

        {/* Study Report Dialog */}
        {studyReport && (
          <AlertDialog open={!!studyReport} onOpenChange={() => setStudyReport(null)}>
            <AlertDialogContent className="max-w-xl shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
              <div className="absolute inset-0 rounded-lg" style={{
                background: `linear-gradient(135deg, rgba(2, 46, 125, 0.03) 0%, rgba(253, 106, 62, 0.03) 100%)`
              }} />
              <AlertDialogHeader className="relative">
                <AlertDialogTitle className="text-2xl font-bold" style={{
                  background: `linear-gradient(135deg, #022e7d 0%, #fd6a3e 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  Your Study Session Report
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600">
                  Here are some insights from Nova based on your recent review:
                </AlertDialogDescription>
              </AlertDialogHeader>
              <ScrollArea className="max-h-[60vh] pr-2 relative">
                <ChatMessageContentRenderer content={studyReport} />
              </ScrollArea>
              <AlertDialogFooter className="relative">
                <AlertDialogAction 
                  onClick={() => {
                    setStudyReport(null);
                    router.push('/flashcards');
                  }}
                  className="text-white font-semibold shadow-lg hover:scale-105 transition-all duration-200"
                  style={{
                    background: `linear-gradient(135deg, #fd6a3e 0%, #022e7d 100%)`,
                    boxShadow: `0 8px 25px rgba(253, 106, 62, 0.3)`
                  }}
                >
                  Back to My Sets
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

export default function StudySessionPage() {
  return (
    <Suspense fallback={
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, #fef7f0 0%, #f0f4ff 50%, #fef7f0 100%)`
        }}
      >
        <div className="container mx-auto py-8 px-4 md:px-0">
          <Card className="max-w-2xl mx-auto shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="min-h-[300px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin" style={{ color: '#fd6a3e' }} />
                <p className="text-slate-600 font-medium">Loading your study session...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <StudySessionContent />
    </Suspense>
  );
}