// src/app/essay-helper/page.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Loader2,
  Wand2,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  Sparkles,
  CheckCircle2,
  Copy,
  AlertTriangle,
  FileEdit, // Replaced MessageCircleWarning
  ClipboardCheck, // For feedback section title
  PencilLine, // For Get Feedback button icon
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Joyride, { Step } from "react-joyride";

// Server actions
import {
  brainstormEssayIdeasAction,
  generateEssayOutlineAction,
  getParagraphFeedbackAction,
} from "@/app/actions/essayActions";

// Custom hooks
import { useFeatureTour } from "@/hooks/useFeatureTour";

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
  id?: string;
  area: string;
  comment: string;
  original_text_segment?: string;
  suggested_revision?: string;
}

interface FeedbackPoint {
  id: string;
  area: string;
  comment: string;
  original_text_segment?: string;
  suggested_revision?: string;
  applies_to_selection?: boolean;
}

const feedbackCategories = [
  // General Paragraph Level (can still be selected)
  {
    id: "overall_clarity_conciseness",
    label: "Overall Clarity & Conciseness",
    type: "paragraph",
  },
  {
    id: "overall_argument_strength",
    label: "Overall Argument Strength & Support",
    type: "paragraph",
  },
  {
    id: "overall_flow_cohesion",
    label: "Overall Flow & Cohesion",
    type: "paragraph",
  },
  {
    id: "overall_style_tone",
    label: "Overall Style & Tone Consistency",
    type: "paragraph",
  },
  // Granular/Sentence Level (more relevant when text is selected)
  {
    id: "grammar_spelling_selection",
    label: "Grammar & Spelling (for selection)",
    type: "selection",
  },
  {
    id: "word_choice_selection",
    label: "Word Choice & Vocabulary (for selection)",
    type: "selection",
  },
  {
    id: "sentence_structure_selection",
    label: "Sentence Structure & Variety (for selection)",
    type: "selection",
  },
  {
    id: "passive_voice_selection",
    label: "Passive Voice Usage (for selection)",
    type: "selection",
  },
];

const BRAND_ORANGE = "#fd6a3e";
const BRAND_BLUE = "#022e7d";

export default function EssayHelperPage() {
  const [essayTopic, setEssayTopic] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [essayType, setEssayType] = useState("");

  const [brainstormedIdeas, setBrainstormedIdeas] = useState<string[]>([]);
  const [generatedOutline, setGeneratedOutline] = useState<OutlineSection[]>(
    []
  );

  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [isOutlining, setIsOutlining] = useState(false);

  const [paragraphText, setParagraphText] = useState("");
  const paragraphTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [userSelectedSnippet, setUserSelectedSnippet] = useState("");
  const [displayedSnippet, setDisplayedSnippet] = useState("");
  const [selectedFeedbackTypes, setSelectedFeedbackTypes] = useState<string[]>([
    "overall_clarity_conciseness",
    "grammar_spelling_selection",
  ]);
  const [feedbackResults, setFeedbackResults] = useState<FeedbackPoint[]>([]);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);

  const tourSteps: Step[] = [
    {
      target: ".essay-helper-tabs",
      content:
        "Welcome to LearnBridge AI's Essay Helper! This tool has three main features to help with your essays.",
      disableBeacon: true,
      placement: "center",
    },
    {
      target: ".brainstorm-inputs-section", // Updated target
      content:
        "Start by telling Nova about your essay. Enter the topic, type, and any key points.",
      placement: "bottom",
    },
    {
      target: ".brainstorm-actions-section", // Updated target for buttons
      content:
        "Then, brainstorm ideas or generate a structured outline for your essay.",
      placement: "bottom",
    },
    {
      target: ".paragraph-section",
      content:
        "Get detailed feedback on individual paragraphs. You can even highlight specific text for focused feedback!",
      placement: "top",
    },
    {
      target: ".paragraph-textarea",
      content:
        "Paste your paragraph here. Highlight any text if you want specific feedback on that part.",
      placement: "top",
    },
    {
      target: ".feedback-categories",
      content: "Select the types of feedback you want Nova to focus on.",
      placement: "bottom",
    },
    {
      target: ".get-feedback-button",
      content: "Click here to get AI-powered feedback on your writing!",
      placement: "right",
    },
  ];

  const { runTour, handleJoyrideCallback, startTour } = useFeatureTour({
    tourKey: "essay_helper_v2", // Changed key to potentially re-trigger for users
    steps: tourSteps,
    isTourEnabledInitially: false, // Set to false, can be enabled by a button or first-time logic
  });

  const handleTextSelection = useCallback(() => {
    if (paragraphTextareaRef.current) {
      const textarea = paragraphTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.substring(start, end);
      // Update snippet only if there's an actual change in selection
      // This prevents clearing the snippet if user clicks away without re-selecting
      if (selectedText && selectedText !== userSelectedSnippet) {
        setUserSelectedSnippet(selectedText);
        setDisplayedSnippet(selectedText);
      } else if (!selectedText && userSelectedSnippet) {
        // Optionally clear if selection is removed, or keep last selection
        // For now, let's clear it if the new selection is empty
        setUserSelectedSnippet("");
        setDisplayedSnippet("");
      }
    }
  }, [userSelectedSnippet]); // Add userSelectedSnippet to dependencies

  useEffect(() => {
    const textarea = paragraphTextareaRef.current;
    if (textarea) {
      textarea.addEventListener("mouseup", handleTextSelection);
      textarea.addEventListener("keyup", handleTextSelection); // Consider if keyup is too frequent

      return () => {
        textarea.removeEventListener("mouseup", handleTextSelection);
        textarea.removeEventListener("keyup", handleTextSelection);
      };
    }
  }, [handleTextSelection]);

  const handleBrainstorm = async () => {
    if (!essayTopic.trim()) {
      toast.error("Please enter an essay topic to brainstorm ideas.");
      return;
    }
    setIsBrainstorming(true);
    setBrainstormedIdeas([]);
    try {
      const result = await brainstormEssayIdeasAction(
        essayTopic,
        keyPoints,
        essayType
      );
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
      const contextForOutline =
        brainstormedIdeas.length > 0
          ? `Consider these brainstormed points: ${brainstormedIdeas.join(
              "; "
            )}`
          : keyPoints;

      const result = await generateEssayOutlineAction(
        essayTopic,
        contextForOutline,
        essayType
      );
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

  const handleFeedbackTypeChange = (typeId: string, checked: boolean) => {
    setSelectedFeedbackTypes((prev) => {
      if (checked) {
        return [...prev, typeId];
      } else {
        return prev.filter((id) => id !== typeId);
      }
    });
  };

  const handleAcceptSuggestion = (feedbackPoint: FeedbackPoint) => {
    if (
      !feedbackPoint.suggested_revision ||
      !feedbackPoint.original_text_segment
    ) {
      toast.error(
        "Cannot apply suggestion: missing revision or original text."
      );
      return;
    }

    const originalText = feedbackPoint.original_text_segment;
    const suggestedText = feedbackPoint.suggested_revision;

    // Find and replace the original text with the suggested revision
    const updatedParagraph = paragraphText.replace(originalText, suggestedText);

    if (updatedParagraph === paragraphText) {
      // If no replacement occurred, try a more flexible approach
      const trimmedOriginal = originalText.trim();
      const updatedParagraphFlexible = paragraphText.replace(
        trimmedOriginal,
        suggestedText
      );

      if (updatedParagraphFlexible === paragraphText) {
        toast.error(
          "Could not find the exact text to replace. Please apply the suggestion manually."
        );
        return;
      } else {
        setParagraphText(updatedParagraphFlexible);
        toast.success("Suggestion applied successfully!");
      }
    } else {
      setParagraphText(updatedParagraph);
      toast.success("Suggestion applied successfully!");
    }

    // Clear the current feedback results since the text has changed
    setFeedbackResults([]);

    // Clear any selected snippet since the text has been modified
    setUserSelectedSnippet("");
    setDisplayedSnippet("");
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

    const currentSnippet = userSelectedSnippet; // Use the state variable

    // Set displayed snippet for feedback confirmation
    if (currentSnippet) {
      setDisplayedSnippet(currentSnippet);
    }

    setIsGettingFeedback(true);
    setFeedbackResults([]);
    try {
      const result = await getParagraphFeedbackAction(
        paragraphText,
        selectedFeedbackTypes,
        currentSnippet,
        essayTopic,
        essayType
      );

      if (result.success && result.feedback) {
        const structuredFeedback: FeedbackPoint[] = (
          result.feedback as FeedbackPointForServer[]
        ).map((fb, i) => ({
          id: fb.id || `fb-${Date.now()}-${i}`,
          area: fb.area,
          comment: fb.comment,
          original_text_segment: fb.original_text_segment,
          suggested_revision: fb.suggested_revision,
          applies_to_selection: !!(
            currentSnippet &&
            // Check if feedback area is selection-focused
            (fb.area.toLowerCase().includes("(for selection)") ||
              // Or if the original text segment matches the selected snippet
              (fb.original_text_segment &&
                (currentSnippet.includes(fb.original_text_segment) ||
                  fb.original_text_segment.includes(currentSnippet) ||
                  // More flexible matching for partial overlaps
                  fb.original_text_segment.trim() === currentSnippet.trim())) ||
              // Or if comment mentions selection/highlighted text
              fb.comment.toLowerCase().includes("your selection") ||
              fb.comment.toLowerCase().includes("highlighted text"))
          ),
        }));
        setFeedbackResults(structuredFeedback);
        toast.success("Feedback received!");
      } else {
        toast.error("Feedback Generation Failed", {
          description: result.error,
        });
      }
    } catch (error: any) {
      toast.error("Feedback Error", { description: error.message });
    } finally {
      setIsGettingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 md:px-8">
      {/* Tour can be triggered by a button if needed */}
      {/* <Button onClick={startTour} className="fixed bottom-4 right-4 z-50" style={{backgroundColor: BRAND_ORANGE}}>Start Tour</Button> */}
      <Joyride
        run={runTour}
        steps={tourSteps}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            arrowColor: BRAND_BLUE,
            backgroundColor: BRAND_BLUE,
            primaryColor: BRAND_ORANGE,
            textColor: "#FFFFFF",
            zIndex: 1000,
          },
          spotlight: {
            borderRadius: "8px",
          },
        }}
      />

      <Card className="w-full max-w-5xl mx-auto shadow-xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden essay-helper-card">
        <CardHeader className="border-b border-slate-200 dark:border-slate-700/80 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/80 dark:to-slate-900/70 p-5 md:p-6">
          <CardTitle
            className="text-2xl md:text-3xl font-bold flex items-center"
            style={{ color: BRAND_ORANGE }}
          >
            <img
              src="/LearnBridge logo inverted2.png"
              alt="LearnBrigeEdu Logo"
              className="mr-2 h-8 w-auto"
            />{" "}
            <span className="text-slate-800 dark:text-slate-100">
              Learnbridge AI's Essay Helper
            </span>
          </CardTitle>
          <CardDescription className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1.5">
            Craft compelling essays with AI-powered brainstorming, outlining,
            and feedback.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs
            defaultValue="brainstorm-outline"
            className="w-full essay-helper-tabs"
          >
            <TabsList className="grid w-full grid-cols-2 h-auto rounded-none bg-slate-100 dark:bg-slate-800 p-1">
              <TabsTrigger
                value="brainstorm-outline"
                className="text-sm md:text-base py-3 data-[state=active]:bg-[#fd6a3e] data-[state=active]:text-white data-[state=active]:shadow-lg rounded-md transition-all duration-200 ease-in-out text-slate-700 dark:text-slate-300 hover:bg-orange-100 dark:hover:bg-orange-800/30"
              >
                <Wand2 className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Brainstorm &
                Outline
              </TabsTrigger>
              <TabsTrigger
                value="paragraph-feedback"
                className="text-sm md:text-base py-3 data-[state=active]:bg-[#022e7d] data-[state=active]:text-white data-[state=active]:shadow-lg rounded-md transition-all duration-200 ease-in-out text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-800/30"
              >
                <FileEdit className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Paragraph
                Feedback
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="brainstorm-outline"
              className="p-5 md:p-7 space-y-8 bg-white dark:bg-slate-900"
            >
              <section className="space-y-6 p-5 md:p-6 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 shadow-sm brainstorm-inputs-section">
                <h3
                  className="text-lg font-semibold flex items-center"
                  style={{ color: BRAND_BLUE }}
                >
                  <Lightbulb
                    className="mr-2 h-5 w-5"
                    style={{ color: BRAND_ORANGE }}
                  />
                  <span className="dark:text-blue-300">
                    Tell LearnBridge AI About Your Essay
                  </span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="essayTopic"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Essay Topic / Question{" "}
                      <span style={{ color: BRAND_ORANGE }}>*</span>
                    </Label>
                    <Input
                      id="essayTopic"
                      value={essayTopic}
                      onChange={(e) => setEssayTopic(e.target.value)}
                      placeholder="e.g., The impact of AI on modern art"
                      className="border-slate-300 dark:border-slate-600 focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e] dark:bg-slate-700/40 dark:focus:border-[#fd6a3e]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="essayType"
                      className="text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Essay Type (Optional)
                    </Label>
                    <Input
                      id="essayType"
                      value={essayType}
                      onChange={(e) => setEssayType(e.target.value)}
                      placeholder="e.g., Persuasive, Argumentative"
                      className="border-slate-300 dark:border-slate-600 focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e] dark:bg-slate-700/40 dark:focus:border-[#fd6a3e]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="keyPoints"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Key Points / Arguments (Optional)
                  </Label>
                  <Textarea
                    id="keyPoints"
                    value={keyPoints}
                    onChange={(e) => setKeyPoints(e.target.value)}
                    placeholder="e.g., AI democratizes art creation; AI challenges traditional notions of authorship..."
                    rows={3}
                    className="border-slate-300 dark:border-slate-600 focus:border-[#fd6a3e] focus:ring-1 focus:ring-[#fd6a3e] dark:bg-slate-700/40 dark:focus:border-[#fd6a3e]"
                  />
                </div>
              </section>

              <Separator className="my-6 md:my-8 border-slate-200 dark:border-slate-700" />

              <section className="space-y-8 brainstorm-actions-section">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={handleBrainstorm}
                    disabled={
                      isBrainstorming || isOutlining || !essayTopic.trim()
                    }
                    style={{ backgroundColor: BRAND_ORANGE }}
                    className="flex-1 h-11 text-sm md:text-base text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all duration-200 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
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
                    disabled={
                      isBrainstorming || isOutlining || !essayTopic.trim()
                    }
                    style={{ backgroundColor: BRAND_BLUE }}
                    className="flex-1 h-11 text-sm md:text-base text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all duration-200 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isOutlining ? (
                      <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                    ) : (
                      <ListChecks className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                    )}
                    Generate Outline
                  </Button>
                </div>

                {brainstormedIdeas.length > 0 && !isBrainstorming && (
                  <div className="pt-2">
                    <h3
                      className="text-xl md:text-2xl font-semibold mb-4 flex items-center"
                      style={{ color: BRAND_BLUE }}
                    >
                      <CheckCircle2 className="mr-3 h-6 w-6 text-green-500" />
                      <span className="dark:text-blue-300">
                        Brainstormed Ideas
                      </span>
                    </h3>
                    <ul className="space-y-3 list-inside">
                      {brainstormedIdeas.map((idea, index) => (
                        <li
                          key={index}
                          className="p-3.5 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-700/50 text-sm text-slate-700 dark:text-slate-300 flex items-start shadow-sm"
                        >
                          <Sparkles
                            className="h-5 w-5 mr-3 mt-0.5 flex-shrink-0"
                            style={{ color: BRAND_ORANGE }}
                          />
                          <span>{idea}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {generatedOutline.length > 0 && !isOutlining && (
                  <div className="pt-2">
                    <h3
                      className="text-xl md:text-2xl font-semibold flex items-center mb-5"
                      style={{ color: BRAND_BLUE }}
                    >
                      <MessageSquareText
                        className="mr-3 h-6 w-6"
                        style={{ color: BRAND_ORANGE }}
                      />
                      <span className="dark:text-blue-300">
                        Generated Outline
                      </span>
                    </h3>
                    <div className="space-y-5">
                      {generatedOutline.map((section) => (
                        <div
                          key={section.id}
                          className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700/50 shadow-sm"
                        >
                          <h4
                            className="text-lg md:text-xl font-semibold mb-2"
                            style={{ color: BRAND_BLUE }}
                          >
                            <span className="dark:text-blue-300">
                              {section.title}
                            </span>
                          </h4>
                          <ul className="space-y-1.5 pl-5">
                            {section.points.map((point, pIndex) => (
                              <li
                                key={pIndex}
                                className="text-sm text-slate-700 dark:text-slate-300 list-disc marker:text-[#fd6a3e]"
                              >
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

            <TabsContent
              value="paragraph-feedback"
              className="p-5 md:p-7 space-y-8 bg-white dark:bg-slate-900 paragraph-section"
            >
              <section className="space-y-6 p-5 md:p-6 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 shadow-sm">
                <h3
                  className="text-lg font-semibold flex items-center"
                  style={{ color: BRAND_BLUE }}
                >
                  <ClipboardCheck
                    className="mr-2 h-5 w-5"
                    style={{ color: BRAND_ORANGE }}
                  />
                  <span className="dark:text-blue-300">
                    Get Detailed Feedback on Your Writing
                  </span>
                </h3>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="paragraphText"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Paste Your Paragraph Here
                  </Label>
                  <Textarea
                    id="paragraphText"
                    ref={paragraphTextareaRef}
                    value={paragraphText}
                    onChange={(e) => setParagraphText(e.target.value)}
                    placeholder="Enter your paragraph content... You can select text within this area to get feedback specifically on that selection."
                    rows={8}
                    className="paragraph-textarea border-slate-300 dark:border-slate-600 focus:border-[#022e7d] focus:ring-1 focus:ring-[#022e7d] dark:bg-slate-700/40 dark:focus:border-[#022e7d]"
                  />
                  {userSelectedSnippet && (
                    <div className="mt-2 text-xs p-2.5 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-md">
                      <p className="text-slate-600 dark:text-slate-300">
                        Focused feedback on:{" "}
                        <strong className="text-[#022e7d] dark:text-blue-300 italic">
                          "{userSelectedSnippet}"
                        </strong>
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 feedback-categories">
                  <Label
                    className="text-sm font-medium flex items-center"
                    style={{ color: BRAND_BLUE }}
                  >
                    <ListChecks
                      className="mr-2 h-5 w-5"
                      style={{ color: BRAND_ORANGE }}
                    />
                    <span className="dark:text-blue-300">
                      Choose Feedback Types
                    </span>
                  </Label>

                  {/* Paragraph-level feedback */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      📄 Paragraph-Level Feedback
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {feedbackCategories
                        .filter((type) => type.type === "paragraph")
                        .map((type) => (
                          <div
                            key={type.id}
                            className="flex items-center space-x-2 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-md transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                          >
                            <Checkbox
                              id={`feedback-${type.id}`}
                              checked={selectedFeedbackTypes.includes(type.id)}
                              onCheckedChange={(checked) =>
                                handleFeedbackTypeChange(
                                  type.id,
                                  checked as boolean
                                )
                              }
                              disabled={isGettingFeedback}
                              className={`data-[state=checked]:bg-[#022e7d] data-[state=checked]:border-[#022e7d] data-[state=checked]:text-white rounded border-slate-400 dark:border-slate-500 focus:ring-offset-0 focus:ring-1 focus:ring-[#022e7d]`}
                            />
                            <Label
                              htmlFor={`feedback-${type.id}`}
                              className="text-sm font-normal cursor-pointer text-slate-700 dark:text-slate-300 select-none"
                            >
                              {type.label}
                            </Label>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Selection-level feedback */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center">
                      🎯 Selection-Level Feedback
                      {userSelectedSnippet && (
                        <span className="ml-2 text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                          Text Selected
                        </span>
                      )}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {feedbackCategories
                        .filter((type) => type.type === "selection")
                        .map((type) => (
                          <div
                            key={type.id}
                            className={`flex items-center space-x-2 p-2 rounded-md transition-colors cursor-pointer border border-transparent ${
                              userSelectedSnippet
                                ? "hover:bg-orange-50 dark:hover:bg-orange-900/40 hover:border-orange-200 dark:hover:border-orange-800"
                                : "opacity-60 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                            }`}
                          >
                            <Checkbox
                              id={`feedback-${type.id}`}
                              checked={selectedFeedbackTypes.includes(type.id)}
                              onCheckedChange={(checked) =>
                                handleFeedbackTypeChange(
                                  type.id,
                                  checked as boolean
                                )
                              }
                              disabled={isGettingFeedback}
                              className={`data-[state=checked]:bg-[#fd6a3e] data-[state=checked]:border-[#fd6a3e] data-[state=checked]:text-white rounded border-slate-400 dark:border-slate-500 focus:ring-offset-0 focus:ring-1 focus:ring-[#fd6a3e]`}
                            />
                            <Label
                              htmlFor={`feedback-${type.id}`}
                              className={`text-sm font-normal cursor-pointer select-none ${
                                userSelectedSnippet
                                  ? "text-slate-700 dark:text-slate-300"
                                  : "text-slate-500 dark:text-slate-500"
                              }`}
                            >
                              {type.label}
                            </Label>
                          </div>
                        ))}
                    </div>
                    {!userSelectedSnippet && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        💡 Tip: Highlight text in the paragraph above to enable
                        selection-specific feedback
                      </p>
                    )}
                  </div>
                </div>

                {/* Display selected snippet for feedback confirmation */}
                {displayedSnippet && (
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2 flex items-center">
                          🎯 Selected Text for Focused Feedback
                        </h4>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded border border-orange-200 dark:border-orange-600">
                          <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                            "{displayedSnippet}"
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDisplayedSnippet("");
                          setUserSelectedSnippet("");
                        }}
                        className="ml-3 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGetParagraphFeedback}
                  disabled={
                    isGettingFeedback ||
                    !paragraphText.trim() ||
                    selectedFeedbackTypes.length === 0
                  }
                  style={{ backgroundColor: BRAND_ORANGE }}
                  className="w-full sm:w-auto h-11 text-sm md:text-base text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all duration-200 rounded-lg get-feedback-button disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isGettingFeedback ? (
                    <Loader2 className="mr-2 h-4 w-4 md:h-5 md:w-5 animate-spin" />
                  ) : (
                    <PencilLine className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                  )}
                  {userSelectedSnippet
                    ? "Get Feedback on Selection & Paragraph"
                    : "Get Feedback on Paragraph"}
                </Button>
              </section>

              {isGettingFeedback && (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <Loader2
                    className="h-10 w-10 animate-spin"
                    style={{ color: BRAND_ORANGE }}
                  />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                    Nova is analyzing your paragraph...
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    This might take a few moments.
                  </p>
                </div>
              )}

              {!isGettingFeedback && feedbackResults.length > 0 && (
                <section className="space-y-6 pt-2">
                  <h3
                    className="text-xl md:text-2xl font-semibold flex items-center"
                    style={{ color: BRAND_BLUE }}
                  >
                    <CheckCircle2 className="mr-3 h-6 w-6 text-green-500" />
                    <span className="dark:text-blue-300">Feedback Results</span>
                  </h3>
                  <div className="space-y-4">
                    {feedbackResults.map((fb) => (
                      <Card
                        key={fb.id}
                        className={`rounded-xl shadow-md transition-all hover:shadow-lg
                          ${
                            fb.applies_to_selection
                              ? `border-2 border-[#fd6a3e] bg-gradient-to-br from-orange-50/80 to-orange-100/60 dark:from-orange-900/40 dark:to-orange-800/30 shadow-orange-100 dark:shadow-orange-900/20`
                              : `border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600`
                          }`}
                      >
                        <CardHeader className="pb-2 pt-3.5 px-4 md:px-5">
                          <CardTitle
                            className="text-base md:text-lg font-semibold capitalize flex items-center"
                            style={{ color: BRAND_BLUE }}
                          >
                            {fb.applies_to_selection && (
                              <span className="mr-2 text-orange-500 dark:text-orange-400">
                                🎯
                              </span>
                            )}
                            <span className="dark:text-blue-300">
                              {fb.area.replace(/_/g, " ")}
                            </span>
                            {fb.applies_to_selection && (
                              <span className="ml-2 text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                                Selection Feedback
                              </span>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 md:px-5 pb-3.5 text-sm space-y-2.5">
                          {fb.original_text_segment && (
                            <blockquote className="mt-1 mb-2 pl-3 italic border-l-4 border-orange-400/80 dark:border-orange-500/70 text-orange-700 dark:text-orange-300/90 text-xs bg-orange-50/80 dark:bg-orange-900/20 p-2.5 rounded-r-md">
                              Regarding: "{fb.original_text_segment}"
                            </blockquote>
                          )}
                          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {fb.comment}
                          </p>
                          {fb.suggested_revision && (
                            <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700/60 rounded-md shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-green-600 dark:text-green-400">
                                  💡 Suggestion:
                                </p>
                                {fb.original_text_segment && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAcceptSuggestion(fb)}
                                    className="text-xs h-7 px-2 bg-green-100 hover:bg-green-200 dark:bg-green-800/50 dark:hover:bg-green-700/50 border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
                                  >
                                    ✓ Apply
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap font-medium">
                                {fb.suggested_revision}
                              </p>
                              {fb.original_text_segment && (
                                <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-2 italic">
                                  This will replace: "{fb.original_text_segment}
                                  "
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="text-xs text-slate-500 dark:text-slate-400 text-center border-t border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/50 p-4 md:p-5">
          <p>
            LearnBridge AI's Essay Helper provides suggestions. Always review
            and use your own critical thinking.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
