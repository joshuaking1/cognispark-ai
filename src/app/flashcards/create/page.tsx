// src/app/flashcards/create/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="container mx-auto py-8 px-4 md:px-0">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">Create New Flashcard Set</CardTitle>
          <CardDescription>
            Provide a title, description (optional), and source text. Nova will generate flashcards for you!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="setTitle" className="text-lg font-medium">Set Title <span className="text-red-500">*</span></Label>
              <Input
                id="setTitle"
                value={setTitle}
                onChange={(e) => setSetTitle(e.target.value)}
                placeholder="e.g., Chapter 5: Cell Biology"
                className="mt-2 text-base"
                disabled={isLoading}
                required
              />
            </div>
            <div>
              <Label htmlFor="setDescription" className="text-lg font-medium">Set Description (Optional)</Label>
              <Textarea
                id="setDescription"
                value={setDescription}
                onChange={(e) => setSetDescription(e.target.value)}
                placeholder="A brief overview of what this flashcard set covers."
                className="mt-2 min-h-[80px] text-base"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="sourceText" className="text-lg font-medium">Source Text <span className="text-red-500">*</span></Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Paste your notes, textbook chapter, or any text here. Nova will extract key information to create flashcards.
              </p>
              <Textarea
                id="sourceText"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste content here..."
                className="mt-2 min-h-[250px] md:min-h-[300px] text-base"
                disabled={isLoading}
                required
              />
               <p className="mt-1 text-xs text-muted-foreground">
                Tip: Well-structured text with clear concepts yields better flashcards. Aim for a few paragraphs to a couple of pages.
              </p>
            </div>
            <Button
              type="submit"
              disabled={isLoading || !setTitle.trim() || !sourceText.trim()}
              className="w-full sm:w-auto text-base py-3 px-6"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              Generate Flashcards
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}