"use client"; // For client-side fetching and interaction

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ArrowLeftIcon, ArrowRightIcon, RefreshCwIcon, UserCircle2, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer"; // For rendering Q&A
import { Label } from "@/components/ui/label";
import Link from "next/link";

// Import the action and types
import { getPublicFlashcardSetByTokenAction, type FlashcardSetWithCards as PublicFlashcardSet } from "@/app/actions/flashcardActions";
// We need a slightly different Flashcard type for client here if it doesn't have SRS fields
interface PublicFlashcard {
    id: string;
    question: string;
    answer: string;
}
interface PublicFlashcardSetAltered extends Omit<PublicFlashcardSet, 'flashcards' | 'user_id' | 'created_at' | 'updated_at'> {
    flashcards: PublicFlashcard[];
    creatorName?: string;
}


export default function SharedFlashcardSetPage() {
  const params = useParams();
  const router = useRouter(); // For "Create your own" button
  const shareToken = params.shareToken as string;

  const [flashcardSet, setFlashcardSet] = useState<PublicFlashcardSetAltered | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareToken) {
      setIsLoading(true);
      setError(null);
      getPublicFlashcardSetByTokenAction(shareToken)
        .then(result => {
          if (result.success && result.set) {
            // @ts-ignore // Assuming creatorName is on result.set
            setFlashcardSet(result.set as PublicFlashcardSetAltered);
            setCurrentCardIndex(0);
            setIsShowingAnswer(false);
          } else {
            setError(result.error || "Could not load shared flashcard set.");
          }
        })
        .catch(err => {
          setError("An unexpected error occurred while loading the set.");
          console.error("Error fetching shared set:", err);
        })
        .finally(() => setIsLoading(false));
    } else {
        setError("Invalid share link."); // Should not happen if route matches
        setIsLoading(false);
    }
  }, [shareToken]);

  const currentCard = flashcardSet?.flashcards[currentCardIndex];

  const handleFlipCard = () => setIsShowingAnswer(!isShowingAnswer);
  
  const handleNextCard = () => {
    if (flashcardSet && currentCardIndex < flashcardSet.flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsShowingAnswer(false);
    }
  };
  
  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsShowingAnswer(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50">
        <div className="container mx-auto py-8 px-4 md:px-0">
          <Card className="max-w-2xl mx-auto shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-4 bg-gradient-to-r from-[#022e7d] to-[#1e40af] text-white rounded-t-lg">
              <Skeleton className="h-8 w-3/4 mb-2 bg-white/20" />
              <Skeleton className="h-4 w-1/2 bg-white/20" />
              <Skeleton className="h-4 w-1/4 mt-2 bg-white/20" />
            </CardHeader>
            <CardContent className="min-h-[250px] md:min-h-[300px] flex items-center justify-center p-6">
              <div className="text-center space-y-4 w-full">
                <Skeleton className="h-6 w-1/2 mx-auto" />
                <Skeleton className="h-24 w-full" />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center pt-6 bg-gradient-to-r from-gray-50 to-slate-50 rounded-b-lg">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-20" />
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 flex items-center justify-center">
        <div className="container mx-auto py-10 text-center">
          <div className="max-w-md mx-auto bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
            <div className="w-16 h-16 bg-gradient-to-br from-[#fd6a3e] to-[#f97316] rounded-full mx-auto mb-6 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#022e7d] mb-4">Oops! Something went wrong</h2>
            <p className="text-gray-700 mb-2">{error}</p>
            <p className="text-sm text-gray-500 mb-6">The shared set might no longer be available or the link may be invalid.</p>
            <Button 
              onClick={() => router.push('/')} 
              className="bg-gradient-to-r from-[#fd6a3e] to-[#f97316] hover:from-[#f97316] hover:to-[#fd6a3e] text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Go to CogniSpark AI Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!flashcardSet || flashcardSet.flashcards.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 flex items-center justify-center">
        <div className="container mx-auto py-10 text-center">
          <div className="max-w-md mx-auto bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/20">
            <div className="w-16 h-16 bg-gradient-to-br from-[#022e7d] to-[#1e40af] rounded-full mx-auto mb-6 flex items-center justify-center">
              <UserCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#022e7d] mb-4">Flashcard Set Not Found</h2>
            <p className="text-gray-700 mb-6">The link might be invalid, or the owner may have stopped sharing this set.</p>
            <Button 
              onClick={() => router.push('/')} 
              className="bg-gradient-to-r from-[#fd6a3e] to-[#f97316] hover:from-[#f97316] hover:to-[#fd6a3e] text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Go to CogniSpark AI Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (!currentCard) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 flex items-center justify-center">
      <div className="container py-8 text-center">
        <div className="text-[#022e7d] text-xl font-semibold">Loading card...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50">
      <div className="container mx-auto py-8 px-4 md:px-0">
        {/* Shared Set Notice */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-white/80 to-blue-50/80 backdrop-blur-sm border border-white/30 text-center shadow-lg">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#fd6a3e] to-[#f97316] rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <p className="text-[#022e7d] font-semibold text-lg">Shared Flashcard Set</p>
          </div>
          {flashcardSet.creatorName && (
            <p className="text-gray-600 text-sm">
              Created by <span className="font-medium text-[#fd6a3e]">{flashcardSet.creatorName}</span>
            </p>
          )}
        </div>

        {/* Main Flashcard */}
        <Card className="max-w-2xl mx-auto shadow-2xl border-0 bg-white/90 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-6 bg-gradient-to-r from-[#022e7d] to-[#1e40af] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#fd6a3e]/20 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            <CardTitle className="text-2xl md:text-3xl font-bold relative z-10 truncate">
              {flashcardSet.title}
            </CardTitle>
            {flashcardSet.description && (
              <CardDescription className="text-blue-100 text-md pt-2 relative z-10">
                {flashcardSet.description}
              </CardDescription>
            )}
            <div className="flex items-center justify-between pt-4 relative z-10">
              <p className="text-blue-200 text-sm font-medium">
                Card {currentCardIndex + 1} of {flashcardSet.flashcards.length}
              </p>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(flashcardSet.flashcards.length, 5) }, (_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === currentCardIndex % 5 ? 'bg-[#fd6a3e] scale-125' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="min-h-[250px] md:min-h-[300px] flex items-center justify-center p-0 relative overflow-hidden">
            <div
              className={`w-full h-full flex flex-col items-center justify-center p-8 text-center transition-all duration-700 ease-in-out cursor-pointer relative group`}
              onClick={handleFlipCard}
              style={{ 
                transformStyle: 'preserve-3d', 
                transform: isShowingAnswer ? 'rotateY(180deg)' : 'rotateY(0deg)',
                background: isShowingAnswer 
                  ? 'linear-gradient(135deg, #fd6a3e 0%, #f97316 100%)' 
                  : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
              }}
            >
              {/* Decorative elements */}
              <div className="absolute top-4 right-4 w-12 h-12 bg-gradient-to-br from-[#fd6a3e]/20 to-[#022e7d]/20 rounded-full opacity-50"></div>
              <div className="absolute bottom-4 left-4 w-8 h-8 bg-gradient-to-br from-[#022e7d]/20 to-[#fd6a3e]/20 rounded-full opacity-50"></div>

              {/* Front of Card (Question) */}
              <div 
                className="absolute w-full h-full flex flex-col items-center justify-center p-8 text-center backface-hidden" 
                style={{ transform: 'rotateY(0deg)' }}
              >
                <Label className="text-sm font-bold text-[#022e7d] mb-4 px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full border border-[#022e7d]/20">
                  Question
                </Label>
                <div className="text-lg md:text-xl font-semibold prose dark:prose-invert max-w-none text-gray-800 leading-relaxed">
                  <ChatMessageContentRenderer content={currentCard.question} />
                </div>
                <div className="mt-6 text-xs text-gray-500 font-medium">Click to reveal answer</div>
              </div>

              {/* Back of Card (Answer) */}
              <div 
                className="absolute w-full h-full flex flex-col items-center justify-center p-8 text-center backface-hidden" 
                style={{ transform: 'rotateY(180deg)' }}
              >
                <Label className="text-sm font-bold text-white mb-4 px-4 py-2 bg-white/20 rounded-full border border-white/30">
                  Answer
                </Label>
                <div className="text-lg md:text-xl prose dark:prose-invert max-w-none text-white leading-relaxed font-medium">
                  <ChatMessageContentRenderer content={currentCard.answer} />
                </div>
                <div className="mt-6 text-xs text-white/80 font-medium">Click to see question</div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex sm:flex-row justify-between items-center pt-6 pb-6 bg-gradient-to-r from-gray-50 to-slate-50 gap-3">
            <Button 
              variant="outline" 
              onClick={handlePreviousCard} 
              disabled={currentCardIndex === 0}
              className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-6"
            >
              <ArrowLeftIcon className="mr-2 h-4 w-4" /> Prev
            </Button>
            
            <Button 
              onClick={handleFlipCard} 
              className="bg-gradient-to-r from-[#fd6a3e] to-[#f97316] hover:from-[#f97316] hover:to-[#fd6a3e] text-white font-semibold px-8 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <RefreshCwIcon className="mr-2 h-4 w-4" /> Flip
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleNextCard} 
              disabled={currentCardIndex >= flashcardSet.flashcards.length - 1}
              className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d] hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-6"
            >
              Next <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <div className="max-w-lg mx-auto bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/30">
            <div className="w-16 h-16 bg-gradient-to-br from-[#fd6a3e] to-[#f97316] rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-[#022e7d] mb-3">Ready to create your own?</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Join thousands of learners using AI-powered flashcards to master any subject faster than ever before.
            </p>
            <Button 
              onClick={() => router.push('/signup')} 
              size="lg" 
              className="bg-gradient-to-r from-[#fd6a3e] to-[#f97316] hover:from-[#f97316] hover:to-[#fd6a3e] text-white font-bold px-10 py-4 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 text-lg"
            >
              <Sparkles className="mr-3 h-5 w-5" />
              Create your own AI Flashcards with CogniSpark AI!
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}