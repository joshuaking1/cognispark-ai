// src/app/flashcards/create/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import Joyride, { Step } from "react-joyride";
import { useFeatureTour } from "@/hooks/useFeatureTour";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react"; // Sparkles for generate

// We will create this server action next
import { generateFlashcardsFromTextAction } from "@/app/actions/flashcardActions";

export default function CreateFlashcardSetPage() {
  const router = useRouter();
  const [setTitle, setSetTitle] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const supabase = createPagesBrowserClient();

  // Define tour steps
  const tourSteps: Step[] = [
    {
      target: ".flashcards-create-page",
      content: "Welcome to Nova's Flashcard Creator! This tool helps you create flashcards from your study material.",
      disableBeacon: true,
      placement: "center"
    },
    {
      target: ".set-title-input",
      content: "Start by giving your flashcard set a meaningful title.",
      placement: "bottom"
    },
    {
      target: ".set-description-input",
      content: "Add an optional description to help you remember what this set is about.",
      placement: "bottom"
    },
    {
      target: ".source-text-input",
      content: "Paste your study material here. Nova will analyze it and generate flashcards with questions and answers.",
      placement: "top"
    },
    {
      target: ".generate-button",
      content: "Click here to generate your flashcards. Nova will create question-answer pairs from your text.",
      placement: "bottom"
    }
  ];

  // Use our custom feature tour hook
  const { runTour, handleJoyrideCallback, startTour } = useFeatureTour({
    tourKey: "flashcards_create",
    steps: tourSteps,
    isTourEnabledInitially: false // Will be set based on user profile
  });

  // Fetch user profile to check if tour has been completed
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('completed_tours')
            .eq('id', session.user.id)
            .single();

          if (!error && profile) {
            setUserProfile(profile);

            // Check if user has completed this tour
            const completedTours = profile.completed_tours || [];
            if (!completedTours.includes('flashcards_create')) {
              // If not completed, run the tour
              startTour();
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [supabase, startTour]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!setTitle.trim() || !sourceText.trim()) {
      toast.error("Missing Information", {
        description: "Please provide a title for your set and some source text to generate flashcards from.",
      });
      return;
    }
    setIsLoading(true);
    try {
      const result = await generateFlashcardsFromTextAction({
        title: setTitle,
        description: setDescription,
        sourceText: sourceText,
      });

      if (result.success && result.setId) {
        toast.success("Flashcard set created!", {
          description: `${result.cardsGeneratedCount || 0} flashcards were generated. Redirecting to your set...`,
        });
        // Redirect to the page where the user can view/study this new set
        router.push(`/flashcards/set/${result.setId}`);
      } else {
        toast.error("Generation Failed", { description: result.error || "Could not generate flashcards." });
      }
    } catch (error: any) {
      toast.error("An Error Occurred", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-blue-50/40 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-800">
      <div className="container max-w-4xl mx-auto py-12 px-4 sm:px-6 flashcards-create-page">
        {/* Joyride Tour */}
        <Joyride
          steps={tourSteps}
          run={runTour}
          continuous
          showSkipButton
          showProgress
          callback={handleJoyrideCallback}
          styles={{
            options: {
              primaryColor: '#fd6a3e',
              zIndex: 1000,
            },
          }}
        />

        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#fd6a3e] to-[#ff8a66] rounded-2xl shadow-lg mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] bg-clip-text text-transparent mb-2">
            Create Flashcard Set
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Transform your study material into interactive flashcards with the power of AI
          </p>
        </div>

        <Card className="shadow-2xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
          <CardHeader className="bg-gradient-to-r from-[#022e7d] via-[#1a4a9e] to-[#fd6a3e] text-white rounded-t-xl relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            
            <CardTitle className="text-2xl font-semibold relative z-10">Generate Your Flashcards</CardTitle>
            <CardDescription className="text-blue-100/90 relative z-10">
              Powered by advanced AI to extract key concepts from your content
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Title Input */}
              <div className="space-y-2">
                <Label 
                  htmlFor="set-title" 
                  className="text-sm font-semibold text-[#022e7d] dark:text-slate-200 flex items-center gap-2"
                >
                  <div className="w-2 h-2 bg-[#fd6a3e] rounded-full"></div>
                  Set Title
                </Label>
                <Input
                  id="set-title"
                  placeholder="e.g., Biology Chapter 5: Cell Structure"
                  value={setTitle}
                  onChange={(e) => setSetTitle(e.target.value)}
                  className="h-12 bg-gradient-to-r from-white to-orange-50/50 dark:from-slate-800 dark:to-slate-700 border-2 border-slate-200/60 dark:border-slate-600/60 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 rounded-lg text-[#022e7d] dark:text-slate-200 placeholder:text-slate-400 transition-all duration-300 set-title-input"
                  required
                />
              </div>

              {/* Description Input */}
              <div className="space-y-2">
                <Label 
                  htmlFor="set-description" 
                  className="text-sm font-semibold text-[#022e7d] dark:text-slate-200 flex items-center gap-2"
                >
                  <div className="w-2 h-2 bg-[#fd6a3e]/60 rounded-full"></div>
                  Description (Optional)
                </Label>
                <Input
                  id="set-description"
                  placeholder="e.g., Comprehensive overview of cellular components and their functions"
                  value={setDescription}
                  onChange={(e) => setSetDescription(e.target.value)}
                  className="h-12 bg-gradient-to-r from-white to-orange-50/30 dark:from-slate-800 dark:to-slate-700 border-2 border-slate-200/60 dark:border-slate-600/60 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 rounded-lg text-[#022e7d] dark:text-slate-200 placeholder:text-slate-400 transition-all duration-300 set-description-input"
                />
              </div>

              {/* Source Text Input */}
              <div className="space-y-3">
                <Label 
                  htmlFor="sourceText" 
                  className="text-lg font-semibold text-[#022e7d] dark:text-slate-200 flex items-center gap-2"
                >
                  <div className="w-3 h-3 bg-gradient-to-r from-[#fd6a3e] to-[#ff8a66] rounded-full"></div>
                  Source Material
                  <span className="text-[#fd6a3e] text-sm">*</span>
                </Label>
                
                <div className="bg-gradient-to-r from-blue-50 to-orange-50/50 dark:from-slate-700/50 dark:to-slate-600/50 p-4 rounded-lg border border-slate-200/50 dark:border-slate-600/50">
                  <p className="text-sm text-[#022e7d]/80 dark:text-slate-300 leading-relaxed">
                    📚 Paste your study material below. Nova's AI will analyze your content and automatically generate 
                    comprehensive flashcards with intelligent question-answer pairs.
                  </p>
                </div>

                <Textarea
                  id="sourceText"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder="Paste your notes, textbook chapters, lecture transcripts, or any educational content here..."
                  className="min-h-[320px] md:min-h-[380px] text-base bg-gradient-to-br from-white via-orange-50/20 to-blue-50/20 dark:from-slate-800 dark:via-slate-700/50 dark:to-slate-700 border-2 border-slate-200/60 dark:border-slate-600/60 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 rounded-xl text-[#022e7d] dark:text-slate-200 placeholder:text-slate-400 resize-none transition-all duration-300 source-text-input"
                  disabled={isLoading}
                  required
                />
                
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="w-1.5 h-1.5 bg-[#fd6a3e]/60 rounded-full"></div>
                  <span>
                    💡 <strong>Pro tip:</strong> Well-structured content with clear concepts and definitions produces the best flashcards. 
                    Aim for 200-2000 words for optimal results.
                  </span>
                </div>
              </div>

              {/* Generate Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-gradient-to-r from-[#022e7d] via-[#1a4a9e] to-[#fd6a3e] hover:from-[#011d5a] hover:via-[#143a7a] hover:to-[#e55a35] text-white font-semibold text-lg rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] generate-button group"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating Your Flashcards...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-1.5 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span>Generate Flashcards with AI</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ✨ Your flashcards will be ready in moments. Nova analyzes your content to create meaningful study materials.
          </p>
        </div>
      </div>
    </div>
  );
}