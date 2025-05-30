// src/app/essay-helper/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator"; // npx shadcn-ui@latest add separator
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react"; // Wand2 for "generate"
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// We will create these server actions next
import { brainstormEssayIdeasAction, generateEssayOutlineAction, getParagraphFeedbackAction } from "@/app/actions/essayActions";

interface BrainstormPoint {
  id: string;
  text: string;
}

interface OutlineSection {
  id: string;
  title: string;
  points: string[];
}

interface FeedbackPointForServer {
  area: string;
  comment: string;
  original_text_segment?: string;
  suggested_revision?: string;
}

interface FeedbackPoint {
  id: string;
  area: string;
  comment: string;
  originalText?: string;
  suggestion?: string;
}

const feedbackTypes = [
  { id: "grammar", label: "Grammar & Spelling" },
  { id: "clarity", label: "Clarity & Conciseness" },
  { id: "strength", label: "Argument Strength & Support" },
  { id: "style", label: "Style & Tone" },
  { id: "flow", label: "Flow & Cohesion" },
];

export default function EssayHelperPage() {
  const [essayTopic, setEssayTopic] = useState("");
  const [keyPoints, setKeyPoints] = useState(""); // Optional user input
  const [essayType, setEssayType] = useState(""); // Optional: persuasive, informative

  const [brainstormedIdeas, setBrainstormedIdeas] = useState<string[]>([]);
  const [generatedOutline, setGeneratedOutline] = useState<OutlineSection[]>([]);

  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [isOutlining, setIsOutlining] = useState(false);

  // New states for paragraph feedback
  const [paragraphText, setParagraphText] = useState("");
  const [selectedFeedbackTypes, setSelectedFeedbackTypes] = useState<string[]>(["grammar", "clarity"]);
  const [feedbackResults, setFeedbackResults] = useState<FeedbackPoint[]>([]);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);

  const handleBrainstorm = async () => {
    if (!essayTopic.trim()) {
      toast.error("Please enter an essay topic to brainstorm ideas.");
      return;
    }
    setIsBrainstorming(true);
    setBrainstormedIdeas([]);
    try {
      const result = await brainstormEssayIdeasAction(essayTopic, keyPoints, essayType);
      if (result.success && result.ideas) {
        setBrainstormedIdeas(result.ideas);
        toast.success("Brainstorming complete!");
      } else {
        toast.error("Brainstorming Failed", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Brainstorming Error", { description: error.message });
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!essayTopic.trim()) {
      toast.error("Please enter an essay topic to generate an outline.");
      return;
    }
    setIsOutlining(true);
    setGeneratedOutline([]);
    try {
      // Use brainstormed ideas as part of the context for the outline if available
      const contextForOutline = brainstormedIdeas.length > 0
        ? `Consider these brainstormed points: ${brainstormedIdeas.join("; ")}`
        : keyPoints;

      const result = await generateEssayOutlineAction(essayTopic, contextForOutline, essayType);
      if (result.success && result.outline) {
        setGeneratedOutline(result.outline);
        toast.success("Outline generated!");
      } else {
        toast.error("Outline Generation Failed", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Outline Generation Error", { description: error.message });
    } finally {
      setIsOutlining(false);
    }
  };

  const handleFeedbackTypeChange = (typeId: string) => {
    setSelectedFeedbackTypes(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  const handleGetParagraphFeedback = async () => {
    if (!paragraphText.trim()) {
      toast.error("Please paste a paragraph to get feedback.");
      return;
    }
    if (selectedFeedbackTypes.length === 0) {
      toast.error("Please select at least one type of feedback to receive.");
      return;
    }
    setIsGettingFeedback(true);
    setFeedbackResults([]);
    try {
      const result = await getParagraphFeedbackAction(paragraphText, selectedFeedbackTypes, essayTopic, essayType);
      if (result.success && result.feedback) {
        // Map server feedback to client feedback structure
        const structuredFeedback: FeedbackPoint[] = (result.feedback as FeedbackPointForServer[]).map((fb, i) => ({
          id: `fb-${Date.now()}-${i}`, // Generate unique client-side ID
          area: fb.area,
          comment: fb.comment,
          originalText: fb.original_text_segment,
          suggestion: fb.suggested_revision,
        }));
        setFeedbackResults(structuredFeedback);
        toast.success("Feedback received!");
      } else {
        toast.error("Feedback Generation Failed", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Feedback Error", { description: error.message });
    } finally {
      setIsGettingFeedback(false);
    }
  };

  return (
    <div className="container mx-auto py-4 md:py-8 px-4">
      <Card className="max-w-4xl mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Nova's Essay Helper
          </CardTitle>
          <CardDescription className="text-sm md:text-base text-slate-600 dark:text-slate-400">
            Brainstorm ideas, structure your essay, and get feedback on your writing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="brainstorm-outline" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg">
              <TabsTrigger 
                value="brainstorm-outline" 
                className="text-xs sm:text-sm md:text-base px-2 sm:px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm whitespace-nowrap flex items-center justify-center h-9 sm:h-10"
              >
                Brainstorm & Outline
              </TabsTrigger>
              <TabsTrigger 
                value="paragraph-feedback" 
                className="text-xs sm:text-sm md:text-base px-2 sm:px-4 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm whitespace-nowrap flex items-center justify-center h-9 sm:h-10"
              >
                Paragraph Feedback
              </TabsTrigger>
            </TabsList>

            {/* Brainstorm & Outline Tab Content */}
            <TabsContent value="brainstorm-outline" className="space-y-6">
              <section className="space-y-6 p-4 md:p-6 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                <h3 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100">1. Tell Nova About Your Essay</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="essayTopic" className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-300">
                      Essay Topic / Prompt <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="essayTopic"
                      value={essayTopic}
                      onChange={(e) => setEssayTopic(e.target.value)}
                      placeholder="e.g., The Impact of Social Media on Teenagers"
                      className="mt-2 text-sm md:text-base bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50"
                      disabled={isBrainstorming || isOutlining}
                    />
                  </div>
                  <div>
                    <Label htmlFor="keyPoints" className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-300">
                      Optional: Key Points / Themes to Include
                    </Label>
                    <Textarea
                      id="keyPoints"
                      value={keyPoints}
                      onChange={(e) => setKeyPoints(e.target.value)}
                      placeholder="e.g., Mental health, cyberbullying, positive connections, information spread..."
                      className="mt-2 min-h-[100px] text-sm md:text-base resize-none bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50"
                      disabled={isBrainstorming || isOutlining}
                    />
                  </div>
                  <div>
                    <Label htmlFor="essayType" className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-300">
                      Optional: Type of Essay
                    </Label>
                    <Input
                      id="essayType"
                      value={essayType}
                      onChange={(e) => setEssayType(e.target.value)}
                      placeholder="e.g., Persuasive, Informative, Argumentative, Narrative"
                      className="mt-2 text-sm md:text-base bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50"
                      disabled={isBrainstorming || isOutlining}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={handleBrainstorm}
                    disabled={isBrainstorming || isOutlining || !essayTopic.trim()}
                    className="flex-1 h-11 text-sm md:text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {isBrainstorming ? (
                      <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                    )}
                    Brainstorm Ideas
                  </Button>
                  <Button
                    onClick={handleGenerateOutline}
                    disabled={isBrainstorming || isOutlining || !essayTopic.trim()}
                    className="flex-1 h-11 text-sm md:text-base bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border-slate-200/50 dark:border-slate-700/50"
                    variant="outline"
                  >
                    {isOutlining ? (
                      <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                    )}
                    Generate Outline
                  </Button>
                </div>

                {/* Brainstormed Ideas Output */}
                {brainstormedIdeas.length > 0 && !isBrainstorming && (
                  <div className="pt-6">
                    <Separator className="my-4" />
                    <h3 className="text-lg md:text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Brainstormed Ideas</h3>
                    <ul className="space-y-2 pl-4 bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                      {brainstormedIdeas.map((idea, index) => (
                        <li key={index} className="text-sm md:text-base text-slate-700 dark:text-slate-300 flex items-start gap-2">
                          <span className="text-blue-600 dark:text-blue-400 mt-1.5">•</span>
                          <span>{idea}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Generated Outline Output */}
                {generatedOutline.length > 0 && !isOutlining && (
                  <div className="pt-6">
                    <Separator className="my-4" />
                    <h3 className="text-lg md:text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Generated Outline</h3>
                    <div className="space-y-4 bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                      {generatedOutline.map((section) => (
                        <div key={section.id} className="pl-2">
                          <h4 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-100">{section.title}</h4>
                          <ul className="space-y-2 pl-6 mt-2">
                            {section.points.map((point, pIndex) => (
                              <li key={pIndex} className="text-sm md:text-base text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400 mt-1.5">•</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </TabsContent>

            {/* Paragraph Feedback Tab Content */}
            <TabsContent value="paragraph-feedback" className="space-y-6">
              <section className="space-y-6 p-4 md:p-6 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                <h3 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100">1. Get Feedback on Your Writing</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="paragraphText" className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-300">
                      Paste Your Paragraph/Text Here <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="paragraphText"
                      value={paragraphText}
                      onChange={(e) => setParagraphText(e.target.value)}
                      placeholder="Paste the paragraph or short text you want feedback on..."
                      className="mt-2 min-h-[200px] text-sm md:text-base resize-none bg-white/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50"
                      disabled={isGettingFeedback}
                    />
                  </div>
                  <div>
                    <Label className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-300 block mb-2">
                      Feedback Focus Areas:
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                      {feedbackTypes.map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`feedback-${type.id}`}
                            checked={selectedFeedbackTypes.includes(type.id)}
                            onCheckedChange={() => handleFeedbackTypeChange(type.id)}
                            disabled={isGettingFeedback}
                            className="border-slate-200/50 dark:border-slate-700/50"
                          />
                          <Label htmlFor={`feedback-${type.id}`} className="text-sm font-normal cursor-pointer text-slate-700 dark:text-slate-300">
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleGetParagraphFeedback}
                    disabled={isGettingFeedback || !paragraphText.trim() || selectedFeedbackTypes.length === 0}
                    className="w-full sm:w-auto h-11 text-sm md:text-base bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    {isGettingFeedback ? (
                      <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                    )}
                    Get Feedback
                  </Button>
                </div>
              </section>

              {/* Feedback Results Output */}
              {feedbackResults.length > 0 && !isGettingFeedback && (
                <section className="pt-6">
                  <Separator className="my-4" />
                  <h3 className="text-lg md:text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Nova's Feedback</h3>
                  <div className="space-y-4">
                    {feedbackResults.map((fb) => (
                      <div key={fb.id} className="p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50">
                        <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 capitalize">
                          {fb.area !== "General" ? `${fb.area} Feedback` : "Suggestion"}
                        </h4>
                        {fb.originalText && (
                          <blockquote className="mt-2 mb-3 pl-3 italic border-l-2 border-slate-200/50 dark:border-slate-700/50 text-sm text-slate-600 dark:text-slate-400">
                            "{fb.originalText}"
                          </blockquote>
                        )}
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{fb.comment}</p>
                        {fb.suggestion && (
                          <div className="mt-3 p-3 bg-green-50/50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/50 rounded-lg">
                            <p className="text-xs font-medium text-green-700 dark:text-green-300">Suggestion:</p>
                            <p className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap mt-1">{fb.suggestion}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-xs text-slate-500 dark:text-slate-400 text-center border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-800/30">
          <p>Nova's Essay Helper provides suggestions. Always review and use your own critical thinking.</p>
        </CardFooter>
      </Card>
    </div>
  );
}