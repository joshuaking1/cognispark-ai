// src/app/smart-notes/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import Joyride, { Step } from "react-joyride";
import { useFeatureTour } from "@/hooks/useFeatureTour";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react"; // For loading spinner icon

// We will create this server action next
import { summarizeTextAction } from "@/app/actions/summarizeTextAction";

type SummaryLength = "short" | "medium" | "long";

export default function SmartNotesPage() {
  const [inputText, setInputText] = useState("");
  const [summaryLength, setSummaryLength] = useState<SummaryLength>("medium");
  const [summarizedText, setSummarizedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [summaryWordCount, setSummaryWordCount] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const supabase = createPagesBrowserClient();

  // Define tour steps
  const tourSteps: Step[] = [
    {
      target: ".smart-notes-page",
      content: "Welcome to Nova's Smart Notes! This tool helps you summarize and organize your study materials.",
      disableBeacon: true,
      placement: "center"
    },
    {
      target: ".notes-input",
      content: "Paste your lecture notes, textbook content, or any text you want to summarize here.",
      placement: "top"
    },
    {
      target: ".summary-length-select",
      content: "Choose how detailed you want your summary to be - short, medium, or long.",
      placement: "bottom"
    },
    {
      target: ".summarize-button",
      content: "Click here to generate your AI-powered summary. Nova will identify and extract the key points.",
      placement: "right"
    },
    {
      target: ".summary-output",
      content: "Your summarized text will appear here. You can copy it or continue editing it for your notes.",
      placement: "top"
    }
  ];

  // Use our custom feature tour hook
  const { runTour, handleJoyrideCallback, startTour } = useFeatureTour({
    tourKey: "smart_notes",
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
            if (!completedTours.includes('smart_notes')) {
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

  const countWords = (text: string): number => {
    return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    setWordCount(countWords(e.target.value));
  };

  const handleSummarize = async () => {
    if (!inputText.trim()) {
      toast.error("Please paste some text to summarize.");
      return;
    }
    setIsLoading(true);
    setSummarizedText(""); // Clear previous summary
    setSummaryWordCount(0);

    try {
      const result = await summarizeTextAction(inputText, summaryLength);
      if (result.success && result.summary) {
        setSummarizedText(result.summary);
        setSummaryWordCount(countWords(result.summary));
        toast.success("Text summarized successfully!");
      } else {
        toast.error("Summarization Failed", { description: result.error || "Unknown error." });
      }
    } catch (error: any) {
      console.error("Summarization error:", error);
      toast.error("An unexpected error occurred during summarization.", {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container max-w-6xl mx-auto py-8 px-4 sm:px-6 smart-notes-page">
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
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-[#022e7d] via-[#fd6a3e] to-[#022e7d] bg-clip-text text-transparent">
              Smart Notes
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Transform lengthy content into concise, AI-powered summaries
          </p>
        </div>

        <Card className="max-w-5xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-0 shadow-2xl shadow-[#fd6a3e]/10 dark:shadow-[#fd6a3e]/5">
          <CardHeader className="space-y-4 pb-8">
            <div className="w-full h-1 bg-gradient-to-r from-[#022e7d] via-[#fd6a3e] to-[#022e7d] rounded-full"></div>
            <CardTitle className="text-xl md:text-2xl font-bold text-[#022e7d] dark:text-white text-center">
              AI Text Summarizer
            </CardTitle>
            <CardDescription className="text-base md:text-lg text-slate-600 dark:text-slate-400 text-center max-w-3xl mx-auto">
              Paste your text below, choose a summary length, and let Nova create intelligent summaries for you.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8">
            {/* Input Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="inputText" className="text-lg font-semibold text-[#022e7d] dark:text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#fd6a3e] rounded-full"></div>
                  Your Text
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#fd6a3e]">
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </span>
                </div>
              </div>
              <div className="relative">
                <Textarea
                  id="inputText"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="Paste your article, lecture notes, research paper, or any text here for intelligent summarization..."
                  className="min-h-[250px] md:min-h-[300px] text-base resize-none bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 border-2 border-slate-200/50 dark:border-slate-700/50 focus:border-[#fd6a3e] dark:focus:border-[#fd6a3e] focus:ring-2 focus:ring-[#fd6a3e]/20 rounded-xl transition-all duration-300 notes-input placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  disabled={isLoading}
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <div className="px-3 py-1 bg-[#fd6a3e]/10 text-[#fd6a3e] text-xs font-medium rounded-full">
                    Ready to Summarize
                  </div>
                </div>
              </div>
            </div>

            {/* Controls Section */}
            <div className="flex flex-col lg:flex-row items-start lg:items-end gap-6 p-6 bg-gradient-to-r from-[#022e7d]/5 to-[#fd6a3e]/5 dark:from-[#022e7d]/10 dark:to-[#fd6a3e]/10 rounded-xl border border-[#fd6a3e]/20">
              <div className="w-full lg:w-auto flex-1">
                <Label htmlFor="summaryLength" className="text-lg font-semibold text-[#022e7d] dark:text-white flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-[#fd6a3e] rounded-full"></div>
                  Summary Length
                </Label>
                <Select
                  value={summaryLength}
                  onValueChange={(value: SummaryLength) => setSummaryLength(value)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full lg:w-[220px] h-12 text-base bg-white dark:bg-slate-800 border-2 border-slate-200/50 dark:border-slate-700/50 focus:border-[#fd6a3e] rounded-lg summary-length-select transition-all duration-300">
                    <SelectValue placeholder="Select summary length" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-800 border-[#fd6a3e]/20">
                    <SelectItem value="short" className="text-base py-3 focus:bg-[#fd6a3e]/10 focus:text-[#fd6a3e]">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-1 bg-[#fd6a3e] rounded-full"></div>
                        <span>Short (~20%)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium" className="text-base py-3 focus:bg-[#fd6a3e]/10 focus:text-[#fd6a3e]">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-1 bg-[#fd6a3e] rounded-full"></div>
                        <span>Medium (~40%)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="long" className="text-base py-3 focus:bg-[#fd6a3e]/10 focus:text-[#fd6a3e]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-1 bg-[#fd6a3e] rounded-full"></div>
                        <span>Long (~60%)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                onClick={handleSummarize}
                disabled={isLoading || !inputText.trim()}
                className="w-full lg:w-auto h-12 px-8 text-base font-semibold bg-gradient-to-r from-[#022e7d] to-[#fd6a3e] hover:from-[#022e7d]/90 hover:to-[#fd6a3e]/90 text-white shadow-lg hover:shadow-xl hover:shadow-[#fd6a3e]/25 transition-all duration-300 rounded-lg summarize-button group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    <span>Analyzing & Summarizing...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Summary</span>
                    <div className="ml-2 w-2 h-2 bg-white rounded-full group-hover:scale-110 transition-transform duration-300"></div>
                  </>
                )}
              </Button>
            </div>

            {/* Summary Section */}
            {summarizedText && (
              <div className="space-y-6 pt-8 border-t-2 border-gradient-to-r from-[#022e7d]/20 to-[#fd6a3e]/20">
                <div className="flex items-center justify-between">
                  <Label htmlFor="summarizedText" className="text-lg font-semibold text-[#022e7d] dark:text-white flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#fd6a3e] rounded-full animate-pulse"></div>
                    AI Generated Summary
                  </Label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-[#fd6a3e]">
                      {summaryWordCount} {summaryWordCount === 1 ? 'word' : 'words'}
                    </span>
                    <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                      ✓ Complete
                    </div>
                  </div>
                </div>
                
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#022e7d]/5 to-[#fd6a3e]/5 rounded-xl blur-xl"></div>
                  <div className="relative bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-900/80 rounded-xl border-2 border-[#fd6a3e]/20 overflow-hidden">
                    <Textarea
                      id="summarizedText"
                      value={summarizedText}
                      readOnly
                      className="min-h-[200px] md:min-h-[250px] text-base resize-none bg-transparent border-0 focus:ring-0 summary-output p-6"
                    />
                    <div className="absolute top-4 right-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(summarizedText);
                          toast.success("Summary copied to clipboard!");
                        }}
                        className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-[#fd6a3e]/30 hover:bg-[#fd6a3e]/10 hover:border-[#fd6a3e] text-[#022e7d] dark:text-white transition-all duration-300 shadow-lg"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Summary
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-br from-[#022e7d]/10 to-[#022e7d]/5 rounded-lg border border-[#022e7d]/20">
                    <div className="text-2xl font-bold text-[#022e7d] dark:text-white">{Math.round((summaryWordCount / wordCount) * 100)}%</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Compression Ratio</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-[#fd6a3e]/10 to-[#fd6a3e]/5 rounded-lg border border-[#fd6a3e]/20">
                    <div className="text-2xl font-bold text-[#fd6a3e]">{wordCount - summaryWordCount}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Words Reduced</div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg border border-green-500/20">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">✓</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Ready to Use</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}