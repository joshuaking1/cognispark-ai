"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addManualFlashcardAction } from "@/app/actions/flashcardActions";

export default function AddManualFlashcardPage() {
  const params = useParams();
  const router = useRouter();
  const setId = params.setId as string;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast.error("Please fill in both question and answer fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await addManualFlashcardAction(setId, question.trim(), answer.trim());
      if (result.success) {
        toast.success("Flashcard added successfully!");
        router.push(`/flashcards/set/${setId}`);
      } else {
        toast.error("Failed to add flashcard", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Error", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/flashcards/set/${setId}`)}
              className="border-2 hover:scale-105 transition-all duration-200 shadow-md"
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
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Set
            </Button>
          </div>

          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm relative overflow-hidden">
            {/* Card gradient overlay */}
            <div className="absolute inset-0 rounded-lg" style={{
              background: `linear-gradient(135deg, rgba(2, 46, 125, 0.03) 0%, rgba(253, 106, 62, 0.03) 100%)`
            }} />

            <CardHeader className="relative pb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 rounded-xl shadow-lg" style={{
                  background: `linear-gradient(135deg, #fd6a3e 0%, #022e7d 100%)`
                }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 text-white"
                  >
                    <rect width="18" height="7" x="3" y="3" rx="1" />
                    <rect width="9" height="7" x="3" y="14" rx="1" />
                    <rect width="5" height="7" x="16" y="14" rx="1" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-xl md:text-2xl font-bold" style={{
                    background: `linear-gradient(135deg, #022e7d 0%, #fd6a3e 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    Add New Flashcard
                  </CardTitle>
                  <CardDescription className="text-sm md:text-base text-slate-600 mt-2">
                    Create a new flashcard for your set. Make sure to write clear questions and answers.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="question" className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#fd6a3e' }}></div>
                    Question
                  </Label>
                  <div className="relative">
                    <Textarea
                      id="question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Enter your question here..."
                      className="min-h-[120px] text-base bg-slate-50 border-2 border-slate-200 rounded-xl p-4 transition-all duration-200 resize-none"
                      disabled={isSubmitting}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#fd6a3e';
                        e.target.style.boxShadow = '0 0 0 3px rgba(253, 106, 62, 0.1)';
                        e.target.style.background = 'white';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                        e.target.style.background = '#f8fafc';
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="answer" className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#022e7d' }}></div>
                    Answer
                  </Label>
                  <div className="relative">
                    <Textarea
                      id="answer"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Enter your answer here..."
                      className="min-h-[120px] text-base bg-slate-50 border-2 border-slate-200 rounded-xl p-4 transition-all duration-200 resize-none"
                      disabled={isSubmitting}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#022e7d';
                        e.target.style.boxShadow = '0 0 0 3px rgba(2, 46, 125, 0.1)';
                        e.target.style.background = 'white';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e2e8f0';
                        e.target.style.boxShadow = 'none';
                        e.target.style.background = '#f8fafc';
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/flashcards/set/${setId}`)}
                    disabled={isSubmitting}
                    className="px-6 py-3 text-base border-2 border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-8 py-3 text-base font-semibold text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, #fd6a3e 0%, #022e7d 100%)`,
                      boxShadow: `0 8px 25px rgba(253, 106, 62, 0.3)`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, #ff7849 0%, #033a94 100%)`;
                      e.currentTarget.style.boxShadow = `0 12px 35px rgba(253, 106, 62, 0.4)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `linear-gradient(135deg, #fd6a3e 0%, #022e7d 100%)`;
                      e.currentTarget.style.boxShadow = `0 8px 25px rgba(253, 106, 62, 0.3)`;
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Flashcard"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}