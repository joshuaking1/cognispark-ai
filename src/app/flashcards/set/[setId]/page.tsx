// src/app/flashcards/set/[setId]/page.tsx
"use client"; // For state and interactions

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation"; // useParams to get setId
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeftIcon, ArrowRightIcon, RefreshCwIcon, InfoIcon, Edit, Trash2, PlusCircle, Save, XCircle, Play, CheckCircle2, XOctagon, Brain, Zap, Loader2, FileQuestion, RotateCcw, XIcon, CheckIcon
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer";
import { generateStudyReportAction } from "@/app/actions/flashcardActions";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DonutChart, List, ListItem, Card as TremorCard, Title, Text, ProgressBar, AreaChart } from "@tremor/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Server action to fetch flashcard set details and its cards
import {
  getFlashcardSetDetailsAction,
  updateFlashcardAction,
  deleteFlashcardAction,
  addManualFlashcardAction,
  updateFlashcardSRSDataAction,
  getDueFlashcardsForSetAction,
  logStudySessionAction,
  getStudySessionHistoryAction
} from "@/app/actions/flashcardActions";

interface FlashcardForClient {
  id: string;
  question: string;
  answer: string;
  due_date: string | null;
  interval: number | null;
  ease_factor: number | null;
  repetitions: number | null;
  last_reviewed_at: string | null;
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  set_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  interval: number | null;
  ease_factor: number | null;
  repetitions: number | null;
  last_reviewed_at: string | null;
  isEditing?: boolean;
}

interface FlashcardSet {
  id: string;
  title: string;
  description: string | null;
  flashcards: Flashcard[];
  user_id: string;
  created_at: string;
  updated_at: string;
  totalCards?: number;
  learnedCards?: number;
  dueTodayCount?: number;
  masteryPercentage?: number;
}

// Quality ratings for SRS
const srsQualityRatings = [
  { label: "Again", value: 0, color: "bg-red-500 hover:bg-red-600", icon: <XOctagon className="mr-2 h-4 w-4"/> },
  { label: "Hard", value: 1, color: "bg-orange-500 hover:bg-orange-600", icon: <Brain className="mr-2 h-4 w-4"/> },
  { label: "Good", value: 2, color: "bg-green-500 hover:bg-green-600", icon: <CheckCircle2 className="mr-2 h-4 w-4"/> },
  { label: "Easy", value: 3, color: "bg-blue-500 hover:bg-blue-600", icon: <Zap className="mr-2 h-4 w-4"/> },
];

interface StudyPerformanceData {
  cardId: string;
  question: string;
  quality: 0 | 1 | 2 | 3;
}

// Add new interfaces
interface SessionHistoryDataForChart {
  date: string;
  "Overall Mastery (%)"?: number;
  "Good/Easy Cards (%)"?: number;
}

interface QuizModeCard extends Flashcard {
  userGuessCorrect?: boolean | null;
}

export default function StudyFlashcardSetPage() {
  const params = useParams();
  const router = useRouter();
  const setId = params.setId as string; // Get setId from URL

  const [flashcardSetInfo, setFlashcardSetInfo] = useState<FlashcardSet | null>(null);
  const [studySessionCards, setStudySessionCards] = useState<Flashcard[]>([]);
  const [allCardsInSet, setAllCardsInSet] = useState<Flashcard[]>([]);
  
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);

  const [isStudyModeActive, setIsStudyModeActive] = useState(false);
  const [sessionProgress, setSessionProgress] = useState(0);

  const [studyReport, setStudyReport] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [sessionPerformance, setSessionPerformance] = useState<StudyPerformanceData[]>([]);
  const [profile, setProfile] = useState<{ grade_level: string | null } | null>(null);

  const [chartData, setChartData] = useState<any[] | null>(null);
  const [challengingCardsList, setChallengingCardsList] = useState<Array<{ question: string; quality: string }>>([]);

  const [sessionHistoryForChart, setSessionHistoryForChart] = useState<SessionHistoryDataForChart[] | null>(null);
  const [isLoadingHistoryChart, setIsLoadingHistoryChart] = useState(false);

  const [isQuizModeActive, setIsQuizModeActive] = useState(false);
  const [quizModeCards, setQuizModeCards] = useState<QuizModeCard[]>([]);
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [isShowingQuizAnswer, setIsShowingQuizAnswer] = useState(false);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizFinished, setQuizFinished] = useState(false);

  const fetchSetDetails = useCallback(async () => {
    console.log('Fetching set details', { setId });
    if (!setId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getFlashcardSetDetailsAction(setId);
      console.log('Set details fetch result', { success: result.success });
      if (result.success && result.set) {
        const { id, title, description, user_id, created_at, updated_at, flashcards, totalCards, learnedCards, dueTodayCount, masteryPercentage } = result.set;
        const setData: FlashcardSet = {
          id,
          title,
          description: description || null,
          user_id,
          created_at,
          updated_at,
          flashcards: flashcards.map(card => ({
            id: card.id,
            question: card.question,
            answer: card.answer,
            set_id: id,
            user_id,
            created_at,
            updated_at,
            due_date: card.due_date || null,
            interval: card.interval || null,
            ease_factor: card.ease_factor || null,
            repetitions: card.repetitions || null,
            last_reviewed_at: card.last_reviewed_at || null
          })),
          totalCards,
          learnedCards,
          dueTodayCount,
          masteryPercentage
        };
        setFlashcardSetInfo(setData);
        setAllCardsInSet(setData.flashcards);
        if (!isStudyModeActive) {
          setStudySessionCards(setData.flashcards);
          setCurrentCardIndex(0);
          setIsShowingAnswer(false);
        }
      } else {
        setError(result.error || "Could not load flashcard set.");
        toast.error("Load Failed", { description: result.error });
      }
    } catch (err: any) {
      console.error('Error in fetchSetDetails:', err);
      setError("An unexpected error occurred.");
      toast.error("Error", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  }, [setId, isStudyModeActive]);

  const fetchDueCards = useCallback(async () => {
    console.log('Fetching due cards', { setId, hasFlashcardSetInfo: !!flashcardSetInfo });
    if (!setId || !flashcardSetInfo) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDueFlashcardsForSetAction(setId);
      console.log('Due cards fetch result', { success: result.success, cardCount: result.dueCards?.length });
      if (result.success && result.dueCards) {
        const dueCards: Flashcard[] = result.dueCards.map(card => ({
          id: card.id,
          question: card.question,
          answer: card.answer,
          set_id: setId,
          user_id: flashcardSetInfo.user_id,
          created_at: flashcardSetInfo.created_at,
          updated_at: flashcardSetInfo.updated_at,
          due_date: card.due_date || null,
          interval: card.interval || null,
          ease_factor: card.ease_factor || null,
          repetitions: card.repetitions || null,
          last_reviewed_at: card.last_reviewed_at || null
        }));
        
        if (dueCards.length === 0) {
          console.log('No due cards found');
          toast.info("No cards due for review right now!", { description: "Great job, or come back later." });
          setIsStudyModeActive(false);
          setStudySessionCards([]);
          setCurrentCardIndex(0);
          setIsShowingAnswer(false);
          setSessionProgress(0);
        } else {
          console.log('Setting due cards', { count: dueCards.length });
          setStudySessionCards(dueCards.sort(() => Math.random() - 0.5));
          setCurrentCardIndex(0);
          setIsShowingAnswer(false);
          setSessionProgress(0);
        }
      } else {
        console.error('Failed to fetch due cards:', result.error);
        toast.error("Failed to load due cards", { description: result.error });
        setIsStudyModeActive(false);
        setStudySessionCards([]);
      }
    } catch (e: any) {
      console.error('Error in fetchDueCards:', e);
      toast.error("Error fetching due cards", { description: e.message });
      setIsStudyModeActive(false);
      setStudySessionCards([]);
    } finally {
      setIsLoading(false);
    }
  }, [setId, flashcardSetInfo]);

  // Initial load and setId changes
  useEffect(() => {
    console.log('Initial load/setId effect triggered', { setId });
    if (setId) {
      fetchSetDetails();
    }
  }, [setId, fetchSetDetails]);

  // Handle study mode changes
  useEffect(() => {
    console.log('Study mode effect triggered', { isStudyModeActive });
    if (isStudyModeActive) {
      fetchDueCards();
    } else if (flashcardSetInfo) {
      // When exiting study mode, show all cards
      setStudySessionCards(flashcardSetInfo.flashcards);
      setCurrentCardIndex(0);
      setIsShowingAnswer(false);
    }
  }, [isStudyModeActive, fetchDueCards, flashcardSetInfo]);

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClientComponentClient();
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
  }, []);

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
    if (isStudyModeActive) {
      setSessionProgress(((newIndex + 1) / studySessionCards.length) * 100);
    }
  };

  // Calculate Mastery Level using useMemo
  const currentSetMasteryPercentage = useMemo(() => {
    if (!allCardsInSet || allCardsInSet.length === 0) return 0;

    let masteredCount = 0;
    allCardsInSet.forEach(card => {
      const interval = card.interval ?? 0;
      const repetitions = card.repetitions ?? 0;

      if (interval >= 21) { // Considered well-learned
        masteredCount++;
      } else if (repetitions >= 3 && interval >= 7) { // Learned through several correct repetitions
        masteredCount++;
      }
    });
    return Math.round((masteredCount / allCardsInSet.length) * 100);
  }, [allCardsInSet]);

  // Logic for when session ends and report is generated
  const handleSessionEndAndGenerateReport = useCallback(async () => {
    if (!flashcardSetInfo || sessionPerformance.length === 0) {
      setIsStudyModeActive(false);
      setSessionPerformance([]);
      return;
    }

    setIsGeneratingReport(true);

    // 1. Prepare data for logging and charts
    const perfCountsForLog = { again: 0, hard: 0, good: 0, easy: 0 };
    const tempChallengingCards: Array<{ question: string; quality: string }> = [];

    sessionPerformance.forEach(p => {
      if (p.quality === 0) {
        perfCountsForLog.again++;
        tempChallengingCards.push({ question: p.question, quality: "Again" });
      } else if (p.quality === 1) {
        perfCountsForLog.hard++;
        tempChallengingCards.push({ question: p.question, quality: "Hard" });
      } else if (p.quality === 2) {
        perfCountsForLog.good++;
      } else if (p.quality === 3) {
        perfCountsForLog.easy++;
      }
    });

    const newChartData = [
      { name: "Again (Forgot)", count: perfCountsForLog.again, color: "red-500" },
      { name: "Hard (Difficult)", count: perfCountsForLog.hard, color: "orange-500" },
      { name: "Good (Recalled)", count: perfCountsForLog.good, color: "green-500" },
      { name: "Easy (Mastered)", count: perfCountsForLog.easy, color: "blue-500" },
    ].filter(d => d.count > 0);

    setChartData(newChartData);
    setChallengingCardsList(tempChallengingCards.slice(0, 5));

    // 2. Log the current study session
    logStudySessionAction({
      setId: flashcardSetInfo.id,
      cardsReviewedCount: sessionPerformance.length,
      performanceCounts: perfCountsForLog,
      setMasteryPercentageAtEnd: currentSetMasteryPercentage
    }).catch(err => console.error("Failed to log study session:", err));

    // 3. Fetch session history for the line chart
    getStudySessionHistoryAction(flashcardSetInfo.id)
      .then(histResult => {
        if (histResult.success && histResult.history) {
          const formattedHistory = histResult.history.map(session => {
            const reviewed = session.cards_reviewed || 1;
            const goodOrEasyCount = (session.performance_snapshot?.good || 0) + (session.performance_snapshot?.easy || 0);
            return {
              date: new Date(session.session_completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              "Overall Mastery (%)": session.mastery_at_session_end ?? undefined,
              "Good/Easy Cards (%)": Math.round((goodOrEasyCount / reviewed) * 100)
            };
          });
          setSessionHistoryForChart(formattedHistory);
        } else {
          console.warn("Could not fetch session history for chart:", histResult.error);
        }
      });

    // 4. Generate AI textual report
    const userGrade = profile?.grade_level;
    generateStudyReportAction(flashcardSetInfo.title, sessionPerformance, userGrade)
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
        setIsStudyModeActive(false);
        setSessionPerformance([]);
      });
  }, [flashcardSetInfo, sessionPerformance, currentSetMasteryPercentage, profile?.grade_level]);

  // Update handleSRSResponse to use handleSessionEndAndGenerateReport
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
              handleSessionEndAndGenerateReport();
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

  const toggleStudyMode = () => {
    console.log('Toggling study mode', { currentMode: isStudyModeActive });
    setIsStudyModeActive(prev => !prev);
  };

  const afterCardModification = () => {
    setIsEditingCard(false);
    if (isStudyModeActive) {
      fetchDueCards();
    } else {
      fetchSetDetails();
    }
  };

  const handleSaveEdit = async () => {
    if (!currentCard) return;
    if (editQuestion.trim() === "" || editAnswer.trim() === "") {
      toast.error("Question and Answer cannot be empty.");
      return;
    }
    setIsSavingEdit(true);
    try {
      const result = await updateFlashcardAction(currentCard.id, editQuestion, editAnswer);
      if (result.success && result.data) {
        afterCardModification();
        toast.success("Flashcard updated!");
      } else {
        toast.error("Update Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Error Updating", { description: e.message });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!currentCard) return;
    setIsDeletingCard(true);
    try {
      const result = await deleteFlashcardAction(currentCard.id);
      if (result.success) {
        afterCardModification();
        toast.success("Flashcard deleted!");
      } else {
        toast.error("Delete Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Error Deleting", { description: e.message });
    } finally {
      setIsDeletingCard(false);
    }
  };

  const handleShuffleCards = () => {
    const cardsToShuffle = isStudyModeActive ? studySessionCards : allCardsInSet;
    if (cardsToShuffle.length > 0) {
      const shuffled = [...cardsToShuffle].sort(() => Math.random() - 0.5);
      if (isStudyModeActive) {
        setStudySessionCards(shuffled);
      } else {
        setAllCardsInSet(shuffled);
      }
      setCurrentCardIndex(0);
      setIsShowingAnswer(false);
      toast.info("Cards shuffled!");
    }
  };

  const startQuizMode = () => {
    if (!allCardsInSet || allCardsInSet.length === 0) {
      toast.info("No cards to quiz!", { description: "This set is empty." });
      return;
    }
    const shuffled = [...allCardsInSet].sort(() => Math.random() - 0.5);
    setQuizModeCards(shuffled.map(card => ({ ...card, userGuessCorrect: null })));
    setCurrentQuizQuestionIndex(0);
    setIsShowingQuizAnswer(false);
    setQuizScore({ correct: 0, total: shuffled.length });
    setQuizFinished(false);
    setIsStudyModeActive(false);
    setIsQuizModeActive(true);
    toast.success("Quiz started!", { description: `Testing your knowledge on ${shuffled.length} cards.` });
  };

  const handleQuizAnswerGrading = (wasCorrect: boolean) => {
    if (!currentQuizCard) return;

    setQuizModeCards(prev => prev.map((card, index) =>
      index === currentQuizQuestionIndex ? { ...card, userGuessCorrect: wasCorrect } : card
    ));

    if (wasCorrect) {
      setQuizScore(prev => ({ ...prev, correct: prev.correct + 1 }));
    }

    if (currentQuizQuestionIndex < quizModeCards.length - 1) {
      setCurrentQuizQuestionIndex(prev => prev + 1);
      setIsShowingQuizAnswer(false);
    } else {
      setQuizFinished(true);
      toast.info("Quiz Finished!", { description: `You scored ${quizScore.correct + (wasCorrect ? 1:0)}/${quizModeCards.length}. Review your answers below.`});
    }
  };

  const currentQuizCard = quizModeCards[currentQuizQuestionIndex];

  const exitQuizMode = () => {
    setIsQuizModeActive(false);
    setQuizModeCards([]);
    setCurrentQuizQuestionIndex(0);
    setIsShowingQuizAnswer(false);
    setQuizFinished(false);
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
            <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Flashcard Set</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/flashcards')}>Back to My Sets</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (flashcardSetInfo && studySessionCards.length === 0 && !isLoading) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-semibold mb-2">{flashcardSetInfo.title}</h1>
        {flashcardSetInfo.description && <p className="text-muted-foreground mb-6">{flashcardSetInfo.description}</p>}
        <h2 className="text-xl font-semibold text-muted-foreground mt-10">
          {isStudyModeActive ? "No cards currently due for review. Great job!" : "This flashcard set is empty."}
        </h2>
        <div className="mt-6 space-x-2">
          {isStudyModeActive && <Button onClick={toggleStudyMode}>Back to Browse All Cards</Button>}
          <Button onClick={() => router.push(setId ? `/flashcards/set/${setId}/add-card` : '/flashcards/create')}>Add New Card</Button>
          <Button onClick={() => router.push('/flashcards')} variant="outline">My Sets</Button>
        </div>
      </div>
    );
  }

  if (!currentCard && studySessionCards.length > 0 && !isLoading) {
    return <div className="container mx-auto py-8 text-center">Loading card...</div>;
  }

  // Quiz Mode Active UI
  if (isQuizModeActive && !quizFinished) {
    if (!currentQuizCard) return <div className="container py-8 text-center">Loading quiz question...</div>;
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Quiz Mode: {flashcardSetInfo?.title}</h1>
          <Button variant="outline" onClick={exitQuizMode}><XCircle className="mr-2 h-4 w-4"/> Exit Quiz</Button>
        </div>
        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Question {currentQuizQuestionIndex + 1} of {quizModeCards.length}</CardTitle>
            <Progress value={((currentQuizQuestionIndex + 1) / quizModeCards.length) * 100} className="mt-2 h-2" />
          </CardHeader>
          <CardContent className="min-h-[200px] flex flex-col items-center justify-center p-6 text-center">
            {!isShowingQuizAnswer ? (
              <ChatMessageContentRenderer content={currentQuizCard.question} />
            ) : (
              <>
                <Label className="text-sm font-medium text-muted-foreground mb-1">Answer:</Label>
                <ChatMessageContentRenderer content={currentQuizCard.answer} />
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-6">
            {!isShowingQuizAnswer ? (
              <Button onClick={() => setIsShowingQuizAnswer(true)} className="w-full sm:w-auto">Show Answer</Button>
            ) : (
              <div className="w-full space-y-3 text-center">
                <p className="text-md font-medium">Did you get it right?</p>
                <div className="flex justify-center gap-3">
                  <Button onClick={() => handleQuizAnswerGrading(false)} variant="destructive" className="flex-1">
                    <XIcon className="mr-2 h-4 w-4"/> Incorrect
                  </Button>
                  <Button onClick={() => handleQuizAnswerGrading(true)} variant="default" className="flex-1 bg-green-600 hover:bg-green-700">
                    <CheckIcon className="mr-2 h-4 w-4"/> Correct
                  </Button>
                </div>
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Quiz Finished UI
  if (isQuizModeActive && quizFinished) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-2xl mx-auto shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl md:text-3xl">Quiz Complete: {flashcardSetInfo?.title}</CardTitle>
            <div className="mt-4 text-3xl font-bold">
              Final Score: <span className={quizScore.correct / quizScore.total >= 0.7 ? 'text-green-600' : quizScore.correct / quizScore.total >= 0.4 ? 'text-orange-500' : 'text-red-600'}>
                {quizScore.correct} / {quizScore.total} ({quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 0}%)
              </span>
            </div>
          </CardHeader>
          <CardContent className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Review Your Answers:</h3>
            <Accordion type="single" collapsible className="w-full">
              {quizModeCards.map((q, index) => (
                <AccordionItem value={`item-${index}`} key={q.id}>
                  <AccordionTrigger className={`text-left text-md p-3 rounded-md ${
                    q.userGuessCorrect === null ? '' : q.userGuessCorrect ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'
                  }`}>
                    <div className="flex items-center justify-between w-full">
                      <span>Q{index + 1}: <ChatMessageContentRenderer content={q.question.length > 50 ? q.question.substring(0,50)+"..." : q.question}/></span>
                      {q.userGuessCorrect === null ? null : q.userGuessCorrect ? <CheckIcon className="h-5 w-5 text-green-500"/> : <XIcon className="h-5 w-5 text-red-500"/>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 space-y-2 text-sm border-t">
                    <div><strong>Your Guess:</strong> {q.userGuessCorrect === null ? "Not Graded" : (q.userGuessCorrect ? "Correct" : "Incorrect")}</div>
                    <div><strong>Correct Answer:</strong> <ChatMessageContentRenderer content={q.answer}/></div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 pt-6">
            <Button onClick={startQuizMode}><RotateCcw className="mr-2 h-4 w-4"/> Retake Quiz</Button>
            <Button variant="outline" onClick={exitQuizMode}><ArrowLeftIcon className="mr-2 h-4 w-4"/> Back to Set Overview</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Default: Render SRS Study / Browse Mode
  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => router.push('/flashcards')}>
          <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to My Sets
        </Button>
        <div className="flex gap-2">
          <Button onClick={toggleStudyMode} variant={isStudyModeActive ? "secondary" : "default"} disabled={!allCardsInSet || allCardsInSet.length === 0}>
            {isStudyModeActive ? <XCircle className="mr-2 h-4 w-4"/> : <Play className="mr-2 h-4 w-4" />}
            {isStudyModeActive ? "Exit Study Mode" : `Study Due Cards (${flashcardSetInfo?.dueTodayCount || 0})`}
          </Button>
          <Button onClick={startQuizMode} variant="outline" disabled={!allCardsInSet || allCardsInSet.length === 0 || isStudyModeActive}>
            <FileQuestion className="mr-2 h-4 w-4" /> Quiz Me
          </Button>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl md:text-3xl truncate">{flashcardSetInfo?.title}</CardTitle>
          {flashcardSetInfo?.description && (
            <CardDescription className="text-md pt-1">{flashcardSetInfo.description}</CardDescription>
          )}
          
          {/* Display Stats */}
          {flashcardSetInfo && !isLoading && (
            <div className="mt-3 pt-3 border-t text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Total Cards:</span>
                <strong>{flashcardSetInfo.totalCards || 0}</strong>
              </div>
              <div className="flex justify-between">
                <span>Cards Learned:</span>
                <strong className="text-green-600">{flashcardSetInfo.learnedCards || 0}</strong>
              </div>
              <div className="flex justify-between">
                <span>Due Today:</span>
                <strong className="text-orange-500">{flashcardSetInfo.dueTodayCount || 0}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span>Set Mastery:</span>
                <div className="flex items-center gap-2">
                  <strong className="text-emerald-600">{flashcardSetInfo.masteryPercentage || 0}%</strong>
                  <Progress value={flashcardSetInfo.masteryPercentage || 0} className="w-24 h-2" />
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground pt-3 mt-3 border-t">
            {isStudyModeActive
              ? `Studying: Card ${studySessionCards.length > 0 ? currentCardIndex + 1 : 0} of ${studySessionCards.length}`
              : `Browsing: Card ${allCardsInSet.length > 0 ? currentCardIndex + 1 : 0} of ${allCardsInSet.length}`
            }
          </p>
          {isStudyModeActive && studySessionCards.length > 0 && (
            <Progress value={sessionProgress} className="mt-2 h-2" />
          )}
        </CardHeader>

        <CardContent className="min-h-[200px] md:min-h-[300px] flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden border-t border-b border-slate-200/50 dark:border-slate-700/50">
          {isEditingCard && currentCard ? (
            <div className="w-full space-y-4 bg-card">
              <div>
                <Label htmlFor="editQuestion" className="text-sm md:text-base font-medium">Question</Label>
                <Textarea 
                  id="editQuestion" 
                  value={editQuestion} 
                  onChange={(e) => setEditQuestion(e.target.value)} 
                  className="mt-2 min-h-[80px] bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-400 transition-colors" 
                  disabled={isSavingEdit} 
                />
              </div>
              <div>
                <Label htmlFor="editAnswer" className="text-sm md:text-base font-medium">Answer</Label>
                <Textarea 
                  id="editAnswer" 
                  value={editAnswer} 
                  onChange={(e) => setEditAnswer(e.target.value)} 
                  className="mt-2 min-h-[80px] bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 focus:border-blue-500 dark:focus:border-blue-400 transition-colors" 
                  disabled={isSavingEdit} 
                />
              </div>
            </div>
          ) : (
            <div className="w-full text-center space-y-4">
              <div className="text-lg md:text-xl lg:text-2xl font-medium">
                {isShowingAnswer ? currentCard?.answer : currentCard?.question}
              </div>
            </div>
          )}
        </CardContent>

        {isStudyModeActive && currentCard ? (
          <CardFooter className="flex flex-col gap-4 pt-6">
            <p className="text-sm text-muted-foreground">How well did you recall the answer?</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
              {srsQualityRatings.map(rating => (
                <Button
                  key={rating.value}
                  onClick={() => handleSRSResponse(rating.value as 0|1|2|3)}
                  className={`${rating.color} text-white transition-all duration-200 hover:scale-[1.02]`}
                  disabled={!isShowingAnswer}
                >
                  {rating.icon} {rating.label}
                </Button>
              ))}
            </div>
            <Button 
              variant="link" 
              onClick={handleFlipCard} 
              className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {isShowingAnswer ? "View Question" : "View Answer"}
            </Button>
          </CardFooter>
        ) : (
          <CardFooter className="flex flex-col gap-4 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={handleFlipCard}
                  className="flex-1 sm:flex-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                >
                  {isShowingAnswer ? "Show Question" : "Show Answer"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleShuffleCards}
                  className="flex-1 sm:flex-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                >
                  <RefreshCwIcon className="mr-2 h-4 w-4" /> Shuffle
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditingCard(true)}
                  className="flex-1 sm:flex-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                >
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Flashcard</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this flashcard? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteCard} className="bg-destructive">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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
        )}

        {isEditingCard && currentCard && (
          <CardFooter className="flex justify-end gap-2 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
            <Button 
              variant="outline" 
              onClick={() => setIsEditingCard(false)} 
              disabled={isSavingEdit}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={isSavingEdit}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] disabled:scale-100 disabled:opacity-50"
            >
              {isSavingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </CardFooter>
        )}
      </Card>

      <div className="mt-6 text-center">
        <Button 
          onClick={() => router.push(setId ? `/flashcards/set/${setId}/add-card` : '/flashcards/create')}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Card
        </Button>
      </div>

      {/* Add Study Report Dialog */}
      {studyReport && !isStudyModeActive && (
        <AlertDialog open={!!studyReport} onOpenChange={(open) => { 
          if(!open) {
            setStudyReport(null); 
            setChartData(null); 
            setChallengingCardsList([]);
            setSessionHistoryForChart(null);
          }
        }}>
          <AlertDialogContent className="max-w-2xl md:max-w-4xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl">
                Study Session Report: "{flashcardSetInfo?.title}"
              </AlertDialogTitle>
              <AlertDialogDescription>
                Here's a breakdown of your recent review session.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
                {/* Column 1: Donut and Mastery */}
                <div className="space-y-6">
                  {chartData && chartData.length > 0 && (
                    <TremorCard>
                      <Title>This Session's Performance</Title>
                      <DonutChart
                        className="mt-6 h-48 sm:h-60"
                        data={chartData}
                        category="count"
                        index="name"
                        colors={chartData.map(d => d.color.split('-')[0]) as any}
                        valueFormatter={(number: number) => `${number} card${number !== 1 ? 's' : ''}`}
                      />
                    </TremorCard>
                  )}
                  <TremorCard>
                    <Title>Current Set Mastery</Title>
                    <Text>{`Based on all ${allCardsInSet.length} cards in "${flashcardSetInfo?.title}".`}</Text>
                    <ProgressBar 
                      value={currentSetMasteryPercentage} 
                      color={currentSetMasteryPercentage >= 80 ? "emerald" : 
                             currentSetMasteryPercentage >= 50 ? "blue" : 
                             currentSetMasteryPercentage >= 25 ? "amber" : "rose"} 
                      className="mt-3 h-2"
                    />
                    <Text className="text-center mt-1 text-lg font-medium">
                      {currentSetMasteryPercentage}% Mastered
                    </Text>
                    <Text className="text-center text-xs text-muted-foreground">
                      (Mastery = card interval &gt; 3 weeks, or &gt; 3 good reps &amp; interval &gt; 1 week)
                    </Text>
                  </TremorCard>
                </div>

                {/* Column 2: Performance Trend Chart */}
                <div className="space-y-6">
                  {sessionHistoryForChart && sessionHistoryForChart.length >= 2 ? (
                    <TremorCard>
                      <Title>Mastery Trend Over Time</Title>
                      <Text>Your progress across recent study sessions for this set.</Text>
                      <AreaChart
                        className="mt-4 h-60"
                        data={sessionHistoryForChart}
                        index="date"
                        categories={["Overall Mastery (%)", "Good/Easy Cards (%)"]}
                        colors={["emerald", "blue"]}
                        yAxisWidth={35}
                        valueFormatter={(number: number) => `${number}%`}
                        showLegend={true}
                      />
                    </TremorCard>
                  ) : (
                    <TremorCard className="flex flex-col items-center justify-center h-full min-h-[200px]">
                      <InfoIcon className="w-10 h-10 text-muted-foreground mb-2"/>
                      <Title>Mastery Trend</Title>
                      <Text className="text-center">Complete more study sessions for this set to see your progress over time!</Text>
                    </TremorCard>
                  )}
                </div>
              </div>

              {/* AI Textual Report */}
              <TremorCard className="mt-6">
                <Title>Nova's Insights & Tips</Title>
                <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
              <ChatMessageContentRenderer content={studyReport} />
                </div>
              </TremorCard>

              {/* Challenging Cards List */}
              {challengingCardsList.length > 0 && (
                <TremorCard className="mt-6">
                  <Title>Cards to Focus On ({challengingCardsList.length})</Title>
                  <Text>These are questions you found challenging in this session:</Text>
                  <ScrollArea className="max-h-40 mt-2">
                    <List className="mt-2">
                      {challengingCardsList.map((card, idx) => (
                        <ListItem key={idx} className="truncate">
                          <div className="flex items-center justify-between w-full">
                            <span className="text-sm">{card.question}</span>
                            <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                              card.quality === "Again" 
                                ? "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-700/30 dark:text-orange-300"
                            }`}>
                              {card.quality}
                            </span>
                          </div>
                        </ListItem>
                      ))}
                    </List>
                  </ScrollArea>
                </TremorCard>
              )}
            </ScrollArea>

            <AlertDialogFooter className="mt-4">
              <AlertDialogAction onClick={() => { 
                setStudyReport(null); 
                setChartData(null); 
                setChallengingCardsList([]);
                setSessionHistoryForChart(null);
              }}>
                Great, Got It!
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}