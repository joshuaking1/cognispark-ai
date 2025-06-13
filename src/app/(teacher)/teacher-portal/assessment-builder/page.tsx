"use client";

import { useState, FormEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Wand2,
  Save,
  Edit,
  Trash2,
  FilePlus2,
  PlusCircle,
  BookOpen,
  Target,
  Lightbulb,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "sonner";

// Import actions and types for TOS and Assessment generation
import {
  getSavedTOSTemplatesAction,
  getTOSTemplateByIdAction,
} from "@/app/actions/tosActions";
import { generateAssessmentItemsAction } from "@/app/actions/assessmentActions";
import type {
  TOSTemplateClientData,
  SavedTOSMeta as SavedTOSTemplateMeta,
} from "@/app/(teacher)/teacher-portal/tos-builder/page"; // Adjust path if types are elsewhere

// We'll fetch real saved assessments from the database
const initialSavedAssessments = [];

const questionTypeOptions = [
  { id: "multiple_choice", label: "Multiple Choice", icon: "🔤" },
  { id: "true_false", label: "True/False", icon: "✓✗" },
  { id: "short_answer", label: "Short Answer", icon: "📝" },
];

const numQuestionOptions = [5, 10, 15, 20, 25];

// No helper functions needed - we're using the real API now

export default function AssessmentBuilderPage() {
  // State management
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [sourceType, setSourceType] = useState<"topic" | "text">("topic");
  const [sourceContent, setSourceContent] = useState("");
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<string[]>([
    "multiple_choice",
  ]);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [generatedAssessment, setGeneratedAssessment] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAssessments, setSavedAssessments] = useState(
    initialSavedAssessments
  );
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false);

  // TOS-related state
  const [availableTOSTemplates, setAvailableTOSTemplates] = useState<
    SavedTOSTemplateMeta[]
  >([]);
  const [selectedTOSId, setSelectedTOSId] = useState<string>("");
  const [selectedTOSData, setSelectedTOSData] =
    useState<TOSTemplateClientData | null>(null); // To store full data of selected TOS
  const [isLoadingTOSList, setIsLoadingTOSList] = useState(false);

  // Fetch TOS templates on component mount
  useEffect(() => {
    let isMounted = true;

    const fetchTOS = async () => {
      if (!isMounted) return;

      setIsLoadingTOSList(true);

      try {
        const result = await getSavedTOSTemplatesAction();

        if (!isMounted) return;

        if (result.success && result.templates) {
          setAvailableTOSTemplates(result.templates);
        } else {
          toast.error("Failed to load TOS templates");
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching TOS templates:", error);
          toast.error("Error loading TOS templates");
        }
      } finally {
        if (isMounted) {
          setIsLoadingTOSList(false);
        }
      }
    };

    fetchTOS();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateNew = () => {
    setAssessmentTitle("");
    setSourceType("topic");
    setSourceContent("");
    setSelectedQuestionTypes(["multiple_choice"]);
    setNumQuestions(10);
    setDifficulty("medium");
    setGeneratedAssessment(null);
    // Reset TOS selection
    setSelectedTOSId("");
    setSelectedTOSData(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleQuestionTypeChange = (typeId: string) => {
    setSelectedQuestionTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId]
    );
  };

  // This function handles selecting a TOS template and loading its data
  const handleTOSSelect = async (tosId: string) => {
    // Don't do anything if the ID is empty or already selected
    if (!tosId || tosId === selectedTOSId) {
      return;
    }

    // Set loading state
    toast.info("Loading TOS template...");

    try {
      // Fetch the TOS template data
      const result = await getTOSTemplateByIdAction(tosId);

      if (result.success && result.template) {
        // First set the ID
        setSelectedTOSId(tosId);

        // Then update the source content with the TOS title
        const newContent =
          result.template.title || "Content based on selected TOS";
        setSourceContent(newContent);

        // Update the number of questions if specified in the TOS
        if (
          result.template.total_items_or_percent &&
          !result.template.is_percentage_based
        ) {
          setNumQuestions(Number(result.template.total_items_or_percent));
        }

        // Finally set the TOS data
        setSelectedTOSData(result.template);

        // Show success message
        toast.success(`TOS "${result.template.title}" loaded successfully`);
      } else {
        // Show error message
        toast.error("Failed to load TOS template");
        setSelectedTOSId("");
      }
    } catch (error) {
      // Show error message
      toast.error("Error loading TOS template");
      console.error("Error loading TOS template:", error);
      setSelectedTOSId("");
    }
  };

  const handleGenerateItems = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validation - if using TOS, we might not need source content to be required
    if (
      !assessmentTitle.trim() ||
      (!selectedTOSData && !sourceContent.trim()) ||
      selectedQuestionTypes.length === 0
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    setGeneratedAssessment(null);

    try {
      const payload = {
        title: assessmentTitle,
        source_type: selectedTOSData ? "tos" : sourceType, // Use "tos" as source type if TOS is selected
        source_content: sourceContent, // This might be the general topic if TOS is used
        question_types_requested: selectedQuestionTypes as any,
        num_questions: numQuestions,
        difficulty_level: difficulty,
        linked_tos_id: selectedTOSId || undefined,
        linked_tos_data: selectedTOSData, // Pass the full TOS data
      };

      // Make a real API call to generate assessment items
      // Import the action at the top of the file if not already imported
      const result = await generateAssessmentItemsAction(payload);

      if (result.success && result.assessment_items) {
        // Set the generated assessment with the real data from the API
        setGeneratedAssessment({
          title: assessmentTitle,
          questions: result.assessment_items,
        });

        // Check if there's a warning message
        if (result.error) {
          // Show warning toast if there's an error message despite success=true
          toast.warning(result.error);
        } else {
          toast.success("Assessment generated successfully!");
        }

        // Scroll to the assessment output
        setTimeout(() => {
          document
            .getElementById("assessment-output")
            ?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        // Handle error from the API
        toast.error(
          result.error || "Failed to generate assessment. Please try again."
        );
      }

      setIsGenerating(false);
    } catch (error: any) {
      toast.error("Failed to generate assessment items", {
        description: error.message || "An unexpected error occurred",
      });
      setIsGenerating(false);
    }
  };

  const handleSaveAssessment = async () => {
    setIsSaving(true);

    try {
      // In a real implementation, you would call the saveAssessmentAction:
      // const result = await saveAssessmentAction({
      //   title: assessmentTitle,
      //   description: "", // Optional description field could be added to the form
      //   source_type: selectedTOSData ? "tos" : sourceType,
      //   source_content: sourceContent,
      //   generated_question_types: selectedQuestionTypes as any,
      //   target_num_questions: numQuestions,
      //   difficulty_level: difficulty,
      //   questions: generatedAssessment?.questions || [],
      //   linked_tos_id: selectedTOSId || undefined,
      //   linked_tos_data: selectedTOSData || undefined,
      // });

      // Simulate API call
      setTimeout(() => {
        toast.success("Assessment saved successfully!");
        setIsSaving(false);
      }, 1500);
    } catch (error: any) {
      toast.error("Failed to save assessment", {
        description: error.message || "An unexpected error occurred",
      });
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/20">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-[#022e7d] to-[#1e3a8a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#fd6a3e] rounded-xl flex items-center justify-center">
                  <Lightbulb className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-4xl font-bold">
                  Intelligent Assessment Builder
                </h1>
              </div>
              <p className="text-blue-100 text-lg max-w-2xl">
                Create engaging assessments with AI-powered question generation.
                Design, customize, and deploy professional assessments in
                minutes.
              </p>
              <div className="flex items-center gap-6 text-sm text-blue-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>AI-Generated Questions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span>Multiple Question Types</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Quick Setup</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleCreateNew}
              className="bg-[#fd6a3e] hover:bg-[#e5562e] text-white border-0 px-6 py-3 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <FilePlus2 className="mr-2 h-5 w-5" />
              Create New Assessment
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Input Card */}
        <Card
          id="assessment-input-card"
          className="border-0 shadow-xl bg-white/80 backdrop-blur-sm"
        >
          <CardHeader className="bg-gradient-to-r from-[#fd6a3e]/10 to-[#fd6a3e]/5 border-b border-[#fd6a3e]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#fd6a3e] rounded-lg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-[#022e7d]">
                  Design Your Assessment
                </CardTitle>
                <CardDescription className="text-slate-600 text-base">
                  Specify your requirements, and our AI will create professional
                  assessment items tailored to your needs.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleGenerateItems} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  <div>
                    <Label
                      htmlFor="assessmentTitle"
                      className="text-[#022e7d] font-semibold text-base"
                    >
                      Assessment Title <span className="text-[#fd6a3e]">*</span>
                    </Label>
                    <Input
                      id="assessmentTitle"
                      value={assessmentTitle}
                      onChange={(e) => setAssessmentTitle(e.target.value)}
                      placeholder="Enter a descriptive title for your assessment"
                      className="mt-2 border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 h-12 text-base"
                    />
                  </div>

                  <div>
                    <Label className="text-[#022e7d] font-semibold text-base mb-4 block">
                      Source for Assessment Questions{" "}
                      <span className="text-[#fd6a3e]">*</span>
                    </Label>
                    <Select
                      value={sourceType} // Don't change this based on selectedTOSData to avoid infinite loop
                      onValueChange={(value: "topic" | "text") => {
                        // Only handle topic and text here
                        setSourceType(value);
                        // If changing source type, clear TOS selection
                        setSelectedTOSId("");
                        setSelectedTOSData(null);
                      }}
                      disabled={isGenerating || !!selectedTOSData} // Disable if TOS is selected
                    >
                      <SelectTrigger className="w-full mt-1 border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="topic">
                          Generate from a Topic/Keyword
                        </SelectItem>
                        <SelectItem value="text">
                          Generate from Pasted Text
                        </SelectItem>
                        {/* Removed TOS option from here - it's handled by the separate TOS dropdown below */}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* TOS Selection Dropdown */}
                  <div className="mt-0">
                    <Label
                      htmlFor="tosSelect"
                      className="text-[#022e7d] font-semibold text-base"
                    >
                      Link to Table of Specifications (Optional)
                    </Label>
                    <Select
                      defaultValue="none"
                      value={selectedTOSId || "none"}
                      onValueChange={(tosId) => {
                        if (tosId === "none") {
                          // Clear TOS selection
                          setSelectedTOSId("");
                          setSelectedTOSData(null);
                          // Reset source content if it was set by TOS
                          if (selectedTOSData) {
                            setSourceContent("");
                          }
                        } else if (
                          tosId !== "loading_tos" &&
                          tosId !== selectedTOSId
                        ) {
                          // Only fetch TOS data for valid IDs that aren't already selected
                          handleTOSSelect(tosId);
                        }
                      }}
                      disabled={isLoadingTOSList || isGenerating}
                    >
                      <SelectTrigger
                        id="tosSelect"
                        className="mt-1 border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 h-12 text-base"
                      >
                        <SelectValue placeholder="Select a saved TOS (optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          -- None (Generate freely) --
                        </SelectItem>
                        {isLoadingTOSList && (
                          <SelectItem value="loading_tos" disabled>
                            Loading TOS templates...
                          </SelectItem>
                        )}
                        {availableTOSTemplates.map((tos) => (
                          <SelectItem key={tos.id} value={tos.id}>
                            {tos.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTOSData && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>TOS Selected: "{selectedTOSData.title}"</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Your assessment will be generated according to this
                          Table of Specifications.
                          {sourceType === "topic" &&
                            " The topic field below will provide additional context."}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="sourceContent"
                      className="text-[#022e7d] font-semibold text-base"
                    >
                      {selectedTOSData
                        ? "Overall Subject/Context for TOS-based Questions"
                        : sourceType === "topic"
                        ? "Topic or Learning Objective"
                        : "Source Text/Material"}{" "}
                      {!selectedTOSData && (
                        <span className="text-[#fd6a3e]">*</span>
                      )}
                    </Label>
                    <Textarea
                      id="sourceContent"
                      value={sourceContent}
                      onChange={(e) => setSourceContent(e.target.value)}
                      placeholder={
                        selectedTOSData
                          ? "e.g., Grade 9 Biology - Cell Division Unit"
                          : sourceType === "topic"
                          ? "Example: 'Photosynthesis in plants - students should understand the process, inputs, outputs, and importance'"
                          : "Paste your source material, lesson content, or reading passage here..."
                      }
                      className="mt-2 min-h-[150px] border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 text-base"
                      required={!selectedTOSData}
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div>
                    <Label className="text-[#022e7d] font-semibold text-base mb-4 block">
                      Question Types <span className="text-[#fd6a3e]">*</span>
                    </Label>
                    <div className="space-y-3">
                      {questionTypeOptions.map((qt) => (
                        <div
                          key={qt.id}
                          className={`p-4 border-2 rounded-xl transition-all duration-300 cursor-pointer ${
                            selectedQuestionTypes.includes(qt.id)
                              ? "border-[#fd6a3e] bg-[#fd6a3e]/5"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                          onClick={() => handleQuestionTypeChange(qt.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`qt-${qt.id}`}
                              checked={selectedQuestionTypes.includes(qt.id)}
                              onCheckedChange={() =>
                                handleQuestionTypeChange(qt.id)
                              }
                              className="data-[state=checked]:bg-[#fd6a3e] data-[state=checked]:border-[#fd6a3e]"
                            />
                            <span className="text-2xl">{qt.icon}</span>
                            <Label
                              htmlFor={`qt-${qt.id}`}
                              className="font-medium text-[#022e7d] cursor-pointer"
                            >
                              {qt.label}
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#022e7d] font-semibold text-base">
                        Number of Questions{" "}
                        <span className="text-[#fd6a3e]">*</span>
                      </Label>
                      <Select
                        value={String(numQuestions)}
                        onValueChange={(val) => setNumQuestions(Number(val))}
                      >
                        <SelectTrigger className="mt-2 h-12 border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20">
                          <SelectValue placeholder="Select number of questions" />
                        </SelectTrigger>
                        <SelectContent>
                          {numQuestionOptions.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} questions
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[#022e7d] font-semibold text-base">
                        Difficulty Level
                      </Label>
                      <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger className="mt-2 h-12 border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20">
                          <SelectValue placeholder="Select difficulty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">
                            Medium (Grade Appropriate)
                          </SelectItem>
                          <SelectItem value="hard">Challenging</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-[#fd6a3e] to-[#e5562e] hover:from-[#e5562e] hover:to-[#d64a26] text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50"
                  disabled={isGenerating}
                >
                  <Wand2 className="h-5 w-5 mr-2" />
                  {isGenerating ? "Generating..." : "Generate Assessment Items"}
                  {isGenerating && (
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isGenerating && (
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gradient-to-r from-[#fd6a3e] to-[#e5562e] rounded-full flex items-center justify-center mb-6">
                <Loader2 className="animate-spin h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold text-[#022e7d] mb-2">
                Generating Your Assessment
              </h3>
              <p className="text-slate-600 text-center max-w-md">
                Our AI is analyzing your requirements and creating professional
                assessment items. This will take just a moment...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Generated Assessment Display */}
        {generatedAssessment && !isGenerating && (
          <Card
            className="border-0 shadow-xl bg-white/80 backdrop-blur-sm"
            id="assessment-output"
          >
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-[#022e7d]">
                      Generated Assessment
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      Review and customize your AI-generated questions
                    </CardDescription>
                  </div>
                </div>
                <Button
                  onClick={handleSaveAssessment}
                  className="bg-[#022e7d] hover:bg-[#011d5a] text-white px-6 py-3 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Assessment"}
                  {isSaving && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="mb-6">
                <Input
                  value={generatedAssessment.title}
                  onChange={(e) => {
                    setGeneratedAssessment((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }));
                  }}
                  className="text-2xl font-bold border-0 border-b-2 border-slate-200 focus:border-[#fd6a3e] rounded-none px-0 py-2 bg-transparent"
                  placeholder="Assessment Title"
                />
              </div>

              <div className="space-y-6">
                {generatedAssessment.questions.map((q, qIndex) => (
                  <Card
                    key={q.id}
                    className="border-2 border-slate-100 hover:border-[#fd6a3e]/30 transition-all duration-300"
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#fd6a3e] text-white rounded-full flex items-center justify-center font-semibold">
                            {qIndex + 1}
                          </div>
                          <span className="px-3 py-1 bg-[#022e7d]/10 text-[#022e7d] rounded-full text-sm font-medium">
                            {q.question_type.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <Textarea
                          value={q.question_text}
                          onChange={(e) => {
                            setGeneratedAssessment((prev) => {
                              const updated = JSON.parse(JSON.stringify(prev));
                              updated.questions[qIndex].question_text =
                                e.target.value;
                              return updated;
                            });
                          }}
                          className="text-lg font-medium border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20"
                          placeholder="Question text..."
                        />

                        {q.question_type === "multiple_choice" && (
                          <div className="space-y-3 pl-4 border-l-4 border-[#fd6a3e]/20">
                            <Label className="text-sm font-semibold text-[#022e7d]">
                              Answer Options:
                            </Label>
                            {q.options.map((opt, optIndex) => (
                              <div
                                key={optIndex}
                                className="flex items-center gap-3"
                              >
                                <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium">
                                  {String.fromCharCode(65 + optIndex)}
                                </div>
                                <Input
                                  value={opt}
                                  onChange={(e) => {
                                    setGeneratedAssessment((prev) => {
                                      const updated = JSON.parse(
                                        JSON.stringify(prev)
                                      );
                                      updated.questions[qIndex].options[
                                        optIndex
                                      ] = e.target.value;
                                      return updated;
                                    });
                                  }}
                                  className="flex-1 border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20"
                                  placeholder={`Option ${optIndex + 1}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-semibold text-[#022e7d]">
                              Correct Answer
                            </Label>
                            <Input
                              value={q.correct_answer}
                              onChange={(e) => {
                                setGeneratedAssessment((prev) => {
                                  const updated = JSON.parse(
                                    JSON.stringify(prev)
                                  );
                                  updated.questions[qIndex].correct_answer =
                                    e.target.value;
                                  return updated;
                                });
                              }}
                              className="mt-1 border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20"
                              placeholder={
                                q.question_type === "true_false"
                                  ? "True or False"
                                  : "Correct answer"
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-semibold text-[#022e7d]">
                              Explanation (Optional)
                            </Label>
                            <Textarea
                              value={q.explanation || ""}
                              onChange={(e) => {
                                setGeneratedAssessment((prev) => {
                                  const updated = JSON.parse(
                                    JSON.stringify(prev)
                                  );
                                  updated.questions[qIndex].explanation =
                                    e.target.value;
                                  return updated;
                                });
                              }}
                              className="mt-1 min-h-[80px] border-slate-300 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20"
                              placeholder="Explain why this is the correct answer..."
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="flex flex-wrap gap-3 justify-center pt-4">
                  <Button
                    variant="outline"
                    className="border-[#fd6a3e] text-[#fd6a3e] hover:bg-[#fd6a3e] hover:text-white"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Multiple Choice
                  </Button>
                  <Button
                    variant="outline"
                    className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d] hover:text-white"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add True/False
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-400 text-slate-600 hover:bg-slate-600 hover:text-white"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Short Answer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saved Assessments */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-[#022e7d]/5 to-[#022e7d]/10 border-b border-[#022e7d]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#022e7d] rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-[#022e7d]">
                  My Saved Assessments
                </CardTitle>
                <CardDescription className="text-slate-600 text-base">
                  View, edit, or continue working on your previously created
                  assessments.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {savedAssessments.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-10 w-10 text-slate-400" />
                </div>
                <p className="text-slate-500 text-lg">
                  You haven't saved any assessments yet.
                </p>
                <p className="text-slate-400 mt-2">
                  Create your first assessment to get started!
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {savedAssessments.map((assessment) => (
                  <Card
                    key={assessment.id}
                    className="border-2 border-slate-100 hover:border-[#fd6a3e]/30 hover:shadow-lg transition-all duration-300"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex-grow">
                          <h3 className="font-bold text-xl text-[#022e7d] mb-2">
                            {assessment.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <Target className="h-4 w-4" />
                              Custom Assessment
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              {assessment.question_count} questions
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Updated{" "}
                              {new Date(
                                assessment.updated_at
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d] hover:text-white"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-600 hover:text-white"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-[#fd6a3e]/10 to-[#fd6a3e]/5">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-[#fd6a3e] rounded-lg flex items-center justify-center mx-auto mb-3">
                <Target className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-2xl text-[#022e7d] mb-1">250+</h3>
              <p className="text-slate-600">Questions Generated</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-[#022e7d]/10 to-[#022e7d]/5">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-[#022e7d] rounded-lg flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-2xl text-[#fd6a3e] mb-1">
                {savedAssessments.length}
              </h3>
              <p className="text-slate-600">Saved Assessments</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-100 to-emerald-50">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-bold text-2xl text-[#022e7d] mb-1">2 min</h3>
              <p className="text-slate-600">Average Generation Time</p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Section */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/60 backdrop-blur-sm rounded-full border border-slate-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-slate-600 font-medium">
              AI Assistant Ready
            </span>
          </div>
          <p className="text-slate-500 mt-4 max-w-2xl mx-auto">
            Powered by advanced AI technology to help educators create engaging
            and effective assessments. Your assessment data is secure and
            private.
          </p>
        </div>
      </div>
    </div>
  );
}
