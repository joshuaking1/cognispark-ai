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
  ArrowLeftIcon, ArrowRightIcon, RefreshCwIcon, InfoIcon, Edit, Trash2, PlusCircle, Save, XCircle, Play, CheckCircle2, XOctagon, Brain, Zap, Loader2, FileQuestion, RotateCcw, XIcon, CheckIcon, CopyIcon, Share2Icon, HelpCircle
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
  getStudySessionHistoryAction,
  toggleFlashcardSetSharingAction
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
  is_publicly_sharable?: boolean;
  share_token?: string | null;
}

// Quality ratings for SRS
const srsQualityRatings = [
  { label: "Again", value: 0, color: "bg-red-500 hover:bg-red-600 text-white", icon: <XOctagon className="mr-2 h-4 w-4"/> },
  { label: "Hard", value: 1, color: "bg-amber-500 hover:bg-amber-600 text-white", icon: <Brain className="mr-2 h-4 w-4"/> },
  { label: "Good", value: 2, color: "bg-green-500 hover:bg-green-600 text-white", icon: <CheckCircle2 className="mr-2 h-4 w-4"/> },
  { label: "Easy", value: 3, color: "bg-sky-500 hover:bg-sky-600 text-white", icon: <Zap className="mr-2 h-4 w-4"/> },
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

  const [chartData, setChartData] = useState<Array<{ name: string; value: number }> | null>(null);
  const [challengingCardsList, setChallengingCardsList] = useState<Array<{ question: string; quality: string }>>([]);

  const [sessionHistoryForChart, setSessionHistoryForChart] = useState<SessionHistoryDataForChart[] | null>(null);
  const [isLoadingHistoryChart, setIsLoadingHistoryChart] = useState(false);

  const [isQuizModeActive, setIsQuizModeActive] = useState(false);
  const [quizModeCards, setQuizModeCards] = useState<QuizModeCard[]>([]);
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [isShowingQuizAnswer, setIsShowingQuizAnswer] = useState(false);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizFinished, setQuizFinished] = useState(false);
  const [isTogglingShare, setIsTogglingShare] = useState(false);

  const learnedProgress = useMemo(() => (flashcardSetInfo?.totalCards ? (flashcardSetInfo.learnedCards || 0) / flashcardSetInfo.totalCards * 100 : 0), [flashcardSetInfo]);

  const handleToggleSharing = async (setToPublic: boolean) => {
    if (!flashcardSetInfo) return;
    setIsTogglingShare(true);
    try {
      const result = await toggleFlashcardSetSharingAction(flashcardSetInfo.id, setToPublic);
      if (result.success) {
        setFlashcardSetInfo(prev => prev ? ({
          ...prev,
          is_publicly_sharable: setToPublic,
          share_token: result.shareToken || null,
        }) : null);
        toast.success(setToPublic ? "Flashcard set is now public!" : "Flashcard set is now private.");
      } else {
        toast.error(`Sharing Update Failed: ${result.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message || 'An unexpected error occurred'}`);
    } finally {
      setIsTogglingShare(false);
    }
  };

  const shareableLink = useMemo(() => {
    if (typeof window !== 'undefined' && flashcardSetInfo?.is_publicly_sharable && flashcardSetInfo.share_token) {
      return `${window.location.origin}/shared/flashcards/${flashcardSetInfo.share_token}`;
    }
    return null;
  }, [flashcardSetInfo?.is_publicly_sharable, flashcardSetInfo?.share_token]);

  const fetchSetDetails = useCallback(async () => {
    console.log('Fetching set details', { setId });
    if (!setId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getFlashcardSetDetailsAction(setId);
      console.log('Set details fetch result', { success: result.success });
      if (result.success && result.set) {
        const { id, title, description, user_id, created_at, updated_at, flashcards, totalCards, learnedCards, dueTodayCount, masteryPercentage, is_publicly_sharable, share_token } = result.set;
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
          masteryPercentage,
          is_publicly_sharable: is_publicly_sharable ?? false,
          share_token: share_token ?? null
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
          user_id: flashcardSetInfo!.user_id, // flashcardSetInfo must exist if we are fetching due cards
          created_at: flashcardSetInfo!.created_at,
          updated_at: flashcardSetInfo!.updated_at,
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
          setStudySessionCards([]); // Ensure it is empty before showing all cards
          if (flashcardSetInfo) { // Revert to all cards if no due cards
            setStudySessionCards(flashcardSetInfo.flashcards);
          }
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
        setStudySessionCards(flashcardSetInfo ? flashcardSetInfo.flashcards : []); // Revert to all cards
      }
    } catch (e: any) {
      console.error('Error in fetchDueCards:', e);
      toast.error("Error fetching due cards", { description: e.message });
      setIsStudyModeActive(false);
      setStudySessionCards(flashcardSetInfo ? flashcardSetInfo.flashcards : []); // Revert to all cards
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

    let againCount = 0;
    let hardCount = 0;
    let goodCount = 0;
    let easyCount = 0;

    sessionPerformance.forEach(p => {
      if (p.quality === 0) {
        againCount++;
        tempChallengingCards.push({ question: p.question, quality: "Again" });
      } else if (p.quality === 1) {
        hardCount++;
        tempChallengingCards.push({ question: p.question, quality: "Hard" });
      } else if (p.quality === 2) {
        goodCount++;
      } else if (p.quality === 3) {
        easyCount++;
      }
    });
    perfCountsForLog.again = againCount;
    perfCountsForLog.hard = hardCount;
    perfCountsForLog.good = goodCount;
    perfCountsForLog.easy = easyCount;
    
    // Data for DonutChart - 'value' is the standard prop name for Tremor charts
    const chartDataForTremor: Array<{ name: string; value: number }> = [
      { name: "Again (Forgot)", value: perfCountsForLog.again },
      { name: "Hard (Difficult)", value: perfCountsForLog.hard },
      { name: "Good (Recalled)", value: perfCountsForLog.good },
      { name: "Easy (Mastered)", value: perfCountsForLog.easy },
    ].filter(d => d.value > 0);

    setChartData(chartDataForTremor);
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
        // When browsing all cards, shuffle the allCardsInSet itself if you want persistence
        // For this implementation, we shuffle the view (studySessionCards)
        setStudySessionCards(shuffled); 
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
    setIsStudyModeActive(false); // Ensure study mode is off
    setIsQuizModeActive(true);
    toast.success("Quiz started!", { description: `Testing your knowledge on ${shuffled.length} cards.` });
  };

  const handleQuizAnswerGrading = (wasCorrect: boolean) => {
    if (!currentQuizCard) return;

    setQuizModeCards(prev => prev.map((card, index) =>
      index === currentQuizQuestionIndex ? { ...card, userGuessCorrect: wasCorrect } : card
    ));
    
    let newCorrectScore = quizScore.correct;
    if (wasCorrect) {
      newCorrectScore = quizScore.correct + 1;
      setQuizScore(prev => ({ ...prev, correct: prev.correct + 1 }));
    }

    if (currentQuizQuestionIndex < quizModeCards.length - 1) {
      setCurrentQuizQuestionIndex(prev => prev + 1);
      setIsShowingQuizAnswer(false);
    } else {
      setQuizFinished(true);
      // Use the latest score for the toast
      toast.info("Quiz Finished!", { description: `You scored ${newCorrectScore}/${quizModeCards.length}. Review your answers below.`});
    }
  };

  const currentQuizCard = quizModeCards[currentQuizQuestionIndex];

  const exitQuizMode = () => {
    setIsQuizModeActive(false);
    setQuizModeCards([]);
    setCurrentQuizQuestionIndex(0);
    setIsShowingQuizAnswer(false);
    setQuizFinished(false);
    // Revert to showing all cards in browse mode
    if(flashcardSetInfo) {
      setStudySessionCards(flashcardSetInfo.flashcards);
      setCurrentCardIndex(0);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full mx-auto bg-white dark:bg-slate-900 shadow-xl">
          <CardContent className="min-h-[300px] flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#fd6a3e]" />
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Loading your flashcards...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full mx-auto bg-white dark:bg-slate-900 shadow-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-red-600 dark:text-red-500">Error Loading Set</CardTitle>
          </CardHeader>
          <CardContent className="py-8">
            <XOctagon className="h-16 w-16 text-red-500 mx-auto mb-4"/>
            <p className="text-slate-700 dark:text-slate-300 mb-6">{error}</p>
            <Button 
              onClick={() => router.push('/flashcards')} 
              className="bg-[#022e7d] hover:bg-[#01225c] text-white"
            >
              Back to My Sets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (flashcardSetInfo && studySessionCards.length === 0 && !isLoading && !isQuizModeActive) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 text-center">
        <Card className="max-w-xl mx-auto bg-white dark:bg-slate-900 shadow-xl p-6 md:p-8">
          <CardTitle className="text-3xl font-bold text-[#022e7d] dark:text-sky-400 mb-3">{flashcardSetInfo.title}</CardTitle>
          {flashcardSetInfo.description && <p className="text-slate-600 dark:text-slate-400 mb-8">{flashcardSetInfo.description}</p>}
          
          <FileQuestion className="h-20 w-20 text-[#fd6a3e] mx-auto mb-6"/>

          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {isStudyModeActive ? "No cards currently due for review. Great job!" : "This flashcard set is empty."}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            {isStudyModeActive ? "You're all caught up with your reviews for this set." : "Add some cards to start learning!"}
          </p>
          
          <div className="mt-6 space-y-3 sm:space-y-0 sm:space-x-3">
            {isStudyModeActive && 
              <Button onClick={toggleStudyMode} className="w-full sm:w-auto bg-[#fd6a3e] hover:bg-[#e05c35] text-white">
                Back to Browse All Cards
              </Button>}
            <Button onClick={() => router.push(setId ? `/flashcards/set/${setId}/add-card` : '/flashcards/create')}
              className="w-full sm:w-auto bg-[#022e7d] hover:bg-[#01225c] text-white">
              <PlusCircle className="mr-2 h-4 w-4"/> Add New Card</Button>
            <Button onClick={() => router.push('/flashcards')} variant="outline"
              className="w-full sm:w-auto border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-[#fd6a3e] dark:text-[#fd6a3e] dark:hover:bg-[#fd6a3e]/10">
              My Sets</Button>
          </div>
        </Card>
      </div>
    );
  }
  
  if (!currentCard && studySessionCards.length > 0 && !isLoading && !isQuizModeActive) { 
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-700 dark:text-slate-300">Loading card...</div>;
  }

  // Quiz Mode Active UI
  if (isQuizModeActive && !quizFinished) {
    if (!currentQuizCard) return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-[#fd6a3e]" />
      </div>
    );
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-[#022e7d] dark:text-sky-400">
              Quiz: <span className="font-medium">{flashcardSetInfo?.title}</span>
            </h1>
            <Button 
              variant="outline" 
              onClick={exitQuizMode}
              className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <XCircle className="mr-2 h-4 w-4"/> Exit Quiz
            </Button>
          </div>
          <Card className="bg-white dark:bg-slate-900 shadow-xl border-t-4 border-[#fd6a3e]">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-slate-700 dark:text-slate-300">
                Question {currentQuizQuestionIndex + 1} of {quizModeCards.length}
              </CardTitle>
              <Progress value={((currentQuizQuestionIndex + 1) / quizModeCards.length) * 100} className="mt-2 h-2 [&>div]:bg-[#fd6a3e]" />
            </CardHeader>
            <CardContent className="min-h-[250px] flex flex-col items-center justify-center p-6 text-center">
              {!isShowingQuizAnswer ? (
                <div className="text-xl md:text-2xl text-slate-800 dark:text-slate-200">
                  <ChatMessageContentRenderer content={currentQuizCard.question} />
                </div>
              ) : (
                <>
                  <Label className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Answer:</Label>
                  <div className="text-lg md:text-xl text-slate-800 dark:text-slate-200">
                    <ChatMessageContentRenderer content={currentQuizCard.answer} />
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
              {!isShowingQuizAnswer ? (
                <Button 
                  onClick={() => setIsShowingQuizAnswer(true)} 
                  className="w-full sm:w-auto bg-[#fd6a3e] hover:bg-[#e05c35] text-white px-8 py-3 text-lg"
                >
                  Show Answer
                </Button>
              ) : (
                <div className="w-full space-y-4 text-center">
                  <p className="text-md font-medium text-slate-700 dark:text-slate-300">Did you get it right?</p>
                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <Button onClick={() => handleQuizAnswerGrading(false)} variant="destructive" className="flex-1 text-lg py-3">
                      <XIcon className="mr-2 h-5 w-5"/> Incorrect
                    </Button>
                    <Button onClick={() => handleQuizAnswerGrading(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-lg py-3">
                      <CheckIcon className="mr-2 h-5 w-5"/> Correct
                    </Button>
                  </div>
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Quiz Finished UI
  if (isQuizModeActive && quizFinished) {
    const scorePercentage = quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 0;
    let scoreColorClass = 'text-red-500 dark:text-red-400';
    if (scorePercentage >= 70) scoreColorClass = 'text-green-600 dark:text-green-400';
    else if (scorePercentage >= 40) scoreColorClass = 'text-amber-500 dark:text-amber-400';

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
        <Card className="max-w-2xl mx-auto bg-white dark:bg-slate-900 shadow-xl border-t-4 border-[#022e7d]">
          <CardHeader className="text-center pb-6">
            <CardTitle className="text-3xl md:text-4xl font-bold text-[#022e7d] dark:text-sky-400">
              Quiz Complete!
            </CardTitle>
            <CardDescription className="text-lg text-slate-600 dark:text-slate-400 mt-1">
              {flashcardSetInfo?.title}
            </CardDescription>
            <div className={`mt-6 text-4xl font-bold ${scoreColorClass}`}>
              {quizScore.correct} / {quizScore.total} 
              <span className="text-2xl"> ({scorePercentage}%)</span>
            </div>
          </CardHeader>
          <CardContent className="mt-2">
            <h3 className="text-xl font-semibold text-[#022e7d] dark:text-sky-400 mb-4 text-center">Review Your Answers:</h3>
            <ScrollArea className="h-[calc(100vh-450px)] min-h-[200px] pr-3"> {/* Adjusted height */}
              <Accordion type="single" collapsible className="w-full space-y-2">
                {quizModeCards.map((q, index) => (
                  <AccordionItem value={`item-${index}`} key={q.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <AccordionTrigger className={`text-left text-md p-4 hover:no-underline ${
                      q.userGuessCorrect === null ? 'bg-slate-50 dark:bg-slate-800/50' 
                      : q.userGuessCorrect ? 'bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40' 
                      : 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40'
                    }`}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Q{index + 1}: <ChatMessageContentRenderer content={q.question.length > 40 ? q.question.substring(0,40)+"..." : q.question}/>
                        </span>
                        {q.userGuessCorrect === null ? <HelpCircle className="h-5 w-5 text-slate-400"/> 
                         : q.userGuessCorrect ? <CheckCircle2 className="h-5 w-5 text-green-500"/> 
                         : <XCircle className="h-5 w-5 text-red-500"/>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 space-y-2 text-sm bg-white dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-slate-700 dark:text-slate-300"><strong>Your Guess:</strong> {q.userGuessCorrect === null ? "Not Graded" : (q.userGuessCorrect ? "Correct" : "Incorrect")}</div>
                      <div className="text-slate-700 dark:text-slate-300"><strong>Correct Answer:</strong> <ChatMessageContentRenderer content={q.answer}/></div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-center gap-3 pt-8 mt-4 border-t border-slate-200 dark:border-slate-700">
            <Button 
              onClick={startQuizMode} 
              className="bg-[#fd6a3e] hover:bg-[#e05c35] text-white w-full sm:w-auto"
            >
              <RotateCcw className="mr-2 h-4 w-4"/> Retake Quiz
            </Button>
            <Button 
              variant="outline" 
              onClick={exitQuizMode}
              className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 w-full sm:w-auto"
            >
              <ArrowLeftIcon className="mr-2 h-4 w-4"/> Back to Set Overview
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Default: Render SRS Study / Browse Mode
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8">
      <div className="container mx-auto px-4 md:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/flashcards')}
            className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-[#fd6a3e] dark:text-[#fd6a3e] dark:hover:bg-[#fd6a3e]/10 self-start"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to My Sets
          </Button>
          
          {flashcardSetInfo && !isLoading && (
            <div className="flex flex-col gap-2 items-start sm:items-end w-full sm:w-auto order-first sm:order-none">
              <div className="flex items-center gap-2 p-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 shadow-sm">
                <Share2Icon className="h-5 w-5 text-[#fd6a3e] dark:text-orange-400"/>
                <Label htmlFor="share-toggle" className="text-sm font-medium text-[#022e7d] dark:text-sky-400 select-none cursor-pointer">
                  {flashcardSetInfo.is_publicly_sharable ? "Publicly Shared" : "Private Set"}
                </Label>
                <Switch
                  id="share-toggle"
                  checked={flashcardSetInfo.is_publicly_sharable ?? false}
                  onCheckedChange={handleToggleSharing}
                  disabled={isTogglingShare}
                  className="data-[state=checked]:bg-[#fd6a3e] data-[state=unchecked]:bg-slate-300 dark:data-[state=unchecked]:bg-slate-600"
                  aria-label={flashcardSetInfo.is_publicly_sharable ? "Disable public sharing" : "Enable public sharing"}
                />
              </div>
              
              {flashcardSetInfo.is_publicly_sharable && shareableLink && (
                <div className="p-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 shadow-sm w-full max-w-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <CopyIcon className="h-4 w-4 text-[#fd6a3e] dark:text-orange-400" />
                    <Label className="text-xs font-medium text-[#022e7d] dark:text-sky-400">Share Link:</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={shareableLink} 
                      readOnly 
                      className="text-xs h-8 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300" 
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 px-2 border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-[#fd6a3e] dark:text-[#fd6a3e] dark:hover:bg-[#fd6a3e]/10"
                      onClick={() => {
                        navigator.clipboard.writeText(shareableLink);
                        toast.success("Link copied to clipboard!");
                      }}
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 self-start sm:self-center">
            <Button 
              onClick={toggleStudyMode} 
              disabled={!allCardsInSet || allCardsInSet.length === 0}
              className={`${isStudyModeActive ? 'bg-[#022e7d] hover:bg-[#01225c]' : 'bg-[#fd6a3e] hover:bg-[#e05c35]'} text-white`}
            >
              {isStudyModeActive ? <XCircle className="mr-2 h-4 w-4"/> : <Play className="mr-2 h-4 w-4" />}
              {isStudyModeActive ? "Exit Study Mode" : `Study Due Cards (${flashcardSetInfo?.dueTodayCount || 0})`}
            </Button>
            <Button 
              onClick={startQuizMode} 
              variant="outline" 
              disabled={!allCardsInSet || allCardsInSet.length === 0 || isStudyModeActive}
              className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-[#fd6a3e] dark:text-[#fd6a3e] dark:hover:bg-[#fd6a3e]/10"
            >
              <FileQuestion className="mr-2 h-4 w-4" /> Quiz Me
            </Button>
          </div>
        </div>

        <Card className="max-w-2xl mx-auto bg-white dark:bg-slate-900 shadow-xl border-l-4 border-[#fd6a3e] dark:border-orange-500">
          <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="text-2xl md:text-3xl font-bold text-[#022e7d] dark:text-sky-400 truncate">
              {flashcardSetInfo?.title}
            </CardTitle>
            {flashcardSetInfo?.description && (
              <CardDescription className="text-md pt-1 text-slate-600 dark:text-slate-400">{flashcardSetInfo.description}</CardDescription>
            )}
            
            {flashcardSetInfo && !isLoading && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <div className="flex justify-between">
                  <span>Total Cards:</span>
                  <strong className="text-[#022e7d] dark:text-sky-300">{flashcardSetInfo.totalCards || 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Cards Learned:</span>
                  <strong className="text-green-600 dark:text-green-400">{flashcardSetInfo.learnedCards || 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Due Today:</span>
                  <strong className="text-amber-600 dark:text-amber-400">{flashcardSetInfo.dueTodayCount || 0}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span>Set Mastery:</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-emerald-600 dark:text-emerald-400">{flashcardSetInfo.masteryPercentage || 0}%</strong>
                    <Progress value={flashcardSetInfo.masteryPercentage || 0} className="w-24 h-2 [&>div]:bg-[#fd6a3e]" />
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-slate-500 dark:text-slate-400 pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
              {isStudyModeActive
                ? `Studying: Card ${studySessionCards.length > 0 ? currentCardIndex + 1 : 0} of ${studySessionCards.length}`
                : `Browsing: Card ${allCardsInSet.length > 0 ? currentCardIndex + 1 : 0} of ${allCardsInSet.length}`
              }
            </p>
          </CardHeader>

          <CardContent className="min-h-[250px] md:min-h-[300px] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div className="text-xl md:text-2xl lg:text-3xl font-medium text-slate-800 dark:text-slate-200">
              {isShowingAnswer ? (
                <ChatMessageContentRenderer content={currentCard?.answer || "Answer not available."} />
              ) : (
                <ChatMessageContentRenderer content={currentCard?.question || "Question not available."} />
              )}
            </div>
          </CardContent>

          {isStudyModeActive && currentCard ? (
            <CardFooter className="flex flex-col gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm text-slate-600 dark:text-slate-400">How well did you recall the answer?</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                {srsQualityRatings.map(rating => (
                  <Button
                    key={rating.value}
                    onClick={() => handleSRSResponse(rating.value as 0|1|2|3)}
                    className={`${rating.color} transition-all duration-150 hover:brightness-110 focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 focus:ring-slate-400`}
                    disabled={!isShowingAnswer}
                  >
                    {rating.icon} {rating.label}
                  </Button>
                ))}
              </div>
              <Button 
                variant="link" 
                onClick={handleFlipCard} 
                className="mt-2 text-[#fd6a3e] hover:text-[#e05c35] dark:text-orange-400 dark:hover:text-orange-300"
              >
                {isShowingAnswer ? "View Question" : "View Answer"}
              </Button>
            </CardFooter>
          ) : (
            <CardFooter className="flex flex-col gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 w-full">
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={handleFlipCard}
                    className="flex-1 sm:flex-none border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {isShowingAnswer ? "Show Question" : "Show Answer"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleShuffleCards}
                    className="flex-1 sm:flex-none border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <RefreshCwIcon className="mr-2 h-4 w-4" /> Shuffle
                  </Button>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    onClick={() => handleNavigateCard('prev')} 
                    disabled={currentCardIndex === 0}
                    className="flex-1 sm:flex-none border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <ArrowLeftIcon className="mr-2 h-4 w-4" /> Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleNavigateCard('next')} 
                    disabled={currentCardIndex === studySessionCards.length - 1 || studySessionCards.length === 0}
                    className="flex-1 sm:flex-none border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    Next <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardFooter>
          )}
        </Card>
        {/* Session Report Area */}
        {studyReport && !isStudyModeActive && !isQuizModeActive && ( // Show only when not studying and not quizzing
          <Card className="max-w-2xl mx-auto mt-8 bg-white dark:bg-slate-900 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-[#022e7d] dark:text-sky-400">Study Session Report</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">Summary of your recent study session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isGeneratingReport ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-[#fd6a3e]" />
                  <p className="ml-3 text-slate-600 dark:text-slate-400">Generating your personalized report...</p>
                </div>
              ) : (
                <>
                  {chartData && chartData.length > 0 && (
                    <div>
                      <Title className="text-lg font-semibold !text-[#022e7d] dark:!text-sky-400">Performance Breakdown</Title>
                      <DonutChart
                        className="mt-4 h-60"
                        data={chartData}
                        category="value"
                        index="name"
                        colors={["red", "amber", "green", "sky"]} // Corresponds to Again, Hard, Good, Easy from srsQualityRatings
                        valueFormatter={(number: number) => `${number} card${number === 1 ? '' : 's'}`}
                      />
                    </div>
                  )}
                  {challengingCardsList.length > 0 && (
                    <div>
                      <Title className="text-lg font-semibold !text-[#022e7d] dark:!text-sky-400">Challenging Cards</Title>
                      <Text className="text-slate-600 dark:text-slate-400">Focus more on these in your next session.</Text>
                      <List className="mt-2">
                        {challengingCardsList.map((card, idx) => (
                          <ListItem key={idx} className="border-b border-slate-200 dark:border-slate-700 py-2">
                            <span className="text-sm text-slate-700 dark:text-slate-300">{card.question.substring(0, 70)}{card.question.length > 70 ? '...' : ''}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
                              card.quality === "Again" ? "bg-red-500" : "bg-amber-500"
                            }`}>{card.quality}</span>
                          </ListItem>
                        ))}
                      </List>
                    </div>
                  )}
                  {sessionHistoryForChart && sessionHistoryForChart.length > 0 && (
                     <div>
                        <Title className="text-lg font-semibold !text-[#022e7d] dark:!text-sky-400">Progress Over Time</Title>
                        <AreaChart
                            className="mt-4 h-72"
                            data={sessionHistoryForChart}
                            index="date"
                            categories={["Overall Mastery (%)", "Good/Easy Cards (%)"]}
                            colors={["emerald", "sky"]} // Using Tremor/Tailwind color names
                            yAxisWidth={30}
                        />
                     </div>
                  )}
                  {studyReport && (
                    <div>
                      <Title className="text-lg font-semibold !text-[#022e7d] dark:!text-sky-400">AI Generated Feedback</Title>
                      <ScrollArea className="h-48 mt-2 p-3 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800/50">
                        <ChatMessageContentRenderer content={studyReport} />
                      </ScrollArea>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <Button 
                    onClick={() => { setStudyReport(null); setChartData(null); setChallengingCardsList([]); setSessionHistoryForChart(null); }} 
                    variant="outline"
                    className="w-full border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d]/10 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                    Dismiss Report
                </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}