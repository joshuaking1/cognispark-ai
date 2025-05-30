// src/app/smart-notes/page.tsx
"use client";

import { useState } from "react";
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
    <div className="container mx-auto py-4 md:py-8 px-4">
      <Card className="max-w-4xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Smart Notes - AI Text Summarizer
          </CardTitle>
          <CardDescription className="text-sm md:text-base text-slate-600 dark:text-slate-400">
            Paste your text below, choose a summary length, and let Nova summarize it for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="inputText" className="text-base md:text-lg font-medium text-slate-700 dark:text-slate-300">
                Your Text
              </Label>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </div>
            <Textarea
              id="inputText"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Paste your article, notes, or any text here..."
              className="min-h-[200px] md:min-h-[250px] text-sm md:text-base resize-none bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 focus:border-blue-500/50 dark:focus:border-blue-400/50"
              disabled={isLoading}
            />
          </div>

          {/* Controls Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-full sm:w-auto">
              <Label htmlFor="summaryLength" className="text-base md:text-lg font-medium text-slate-700 dark:text-slate-300">
                Summary Length
              </Label>
              <Select
                value={summaryLength}
                onValueChange={(value: SummaryLength) => setSummaryLength(value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full sm:w-[180px] mt-2 text-sm md:text-base bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50">
                  <SelectValue placeholder="Select length" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (~20%)</SelectItem>
                  <SelectItem value="medium">Medium (~40%)</SelectItem>
                  <SelectItem value="long">Long (~60%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSummarize}
              disabled={isLoading || !inputText.trim()}
              className="w-full sm:w-auto h-11 px-6 text-sm md:text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                  <span>Summarizing...</span>
                </>
              ) : (
                "Summarize Text"
              )}
            </Button>
          </div>

          {/* Summary Section */}
          {summarizedText && (
            <div className="space-y-4 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <Label htmlFor="summarizedText" className="text-base md:text-lg font-medium text-slate-700 dark:text-slate-300">
                  AI Generated Summary
                </Label>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {summaryWordCount} {summaryWordCount === 1 ? 'word' : 'words'}
                </span>
              </div>
              <div className="relative">
                <Textarea
                  id="summarizedText"
                  value={summarizedText}
                  readOnly
                  className="min-h-[150px] md:min-h-[200px] text-sm md:text-base resize-none bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(summarizedText);
                    toast.success("Summary copied to clipboard!");
                  }}
                  className="absolute bottom-3 right-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800"
                >
                  Copy Summary
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}