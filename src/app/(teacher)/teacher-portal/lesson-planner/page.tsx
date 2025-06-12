"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import {
  Loader2,
  Wand2,
  Download,
  Edit,
  Save,
  Trash2,
  FilePlus2,
  BookOpen,
  Clock,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Server Actions
import {
  generateLessonPlanAction,
  saveLessonPlanAction,
  getSavedLessonPlansAction,
  deleteLessonPlanAction,
  getLessonPlanByIdAction,
} from "@/app/actions/lessonPlanActions";

// Define types for the lesson plan structure
interface LessonPlanActivity {
  activity: string;
  time_minutes?: number;
  description?: string;
}

interface GeneratedLessonPlan {
  id?: string;
  title?: string;
  subject: string;
  week: string;
  duration_minutes: number;
  form_grade_level: string;
  strand?: string;
  sub_strand?: string;
  content_standard?: string;
  learning_outcomes?: string[];
  learning_indicators?: string[];
  essential_questions?: string[];
  pedagogical_strategies?: string[];
  teaching_learning_resources?: string[];
  differentiation_notes?: string;
  keywords?: string[];
  starter_activity?: string;
  main_activities?: LessonPlanActivity[];
  plenary_ending_activity?: string;
  assessment_methods?: string;
  homework_follow_up?: string;
}

interface SavedLessonPlanMeta {
  id: string;
  title: string;
  subject: string;
  form_grade_level: string;
  updated_at: string;
}

const commonDurations = [30, 45, 50, 60, 75, 90, 120];
const commonFormsOrGrades = [
  "Form 1",
  "Form 2",
  "Form 3",
  "Form 4",
  "Form 5",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Year 1",
  "Year 2",
  "Other",
];

export default function LessonPlannerPage() {
  const router = useRouter();
  // User Inputs
  const [subject, setSubject] = useState("");
  const [week, setWeek] = useState("");
  const [duration, setDuration] = useState<number>(45);
  const [formGrade, setFormGrade] = useState("");
  const [strand, setStrand] = useState("");
  const [subStrand, setSubStrand] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");

  // AI Output
  const [generatedPlan, setGeneratedPlan] =
    useState<GeneratedLessonPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Saved plans
  const [savedPlans, setSavedPlans] = useState<SavedLessonPlanMeta[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [currentEditingPlanId, setCurrentEditingPlanId] = useState<
    string | null
  >(null);

  const fetchSavedPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const result = await getSavedLessonPlansAction();
      if (result.success && result.plans) {
        setSavedPlans(result.plans as SavedLessonPlanMeta[]);
      } else {
        toast.error("Failed to load saved plans", {
          description: result.error,
        });
      }
    } catch (e: any) {
      toast.error("Error loading plans", { description: e.message });
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    fetchSavedPlans();
  }, []);

  const loadPlanForEditing = async (planId: string) => {
    toast.info("Loading plan for editing...");
    setIsGenerating(true);
    try {
      const result = await getLessonPlanByIdAction(planId);
      if (result.success && result.plan) {
        const plan = result.plan as GeneratedLessonPlan;
        setSubject(plan.subject);
        setWeek(plan.week || "");
        setDuration(plan.duration_minutes);
        setFormGrade(plan.form_grade_level);
        setStrand(plan.strand || "");
        setSubStrand(plan.sub_strand || "");
        setGeneratedPlan(plan);
        setLessonTitle(plan.title || "");
        setCurrentEditingPlanId(plan.id);
        setEditMode(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        toast.error("Failed to load plan", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Error loading plan", { description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeletePlan = async (planId: string, planTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the lesson plan "${planTitle}"? This action cannot be undone.`
      )
    )
      return;

    try {
      const result = await deleteLessonPlanAction(planId);
      if (result.success) {
        toast.success(`Lesson plan "${planTitle}" deleted.`);
        fetchSavedPlans();
        if (currentEditingPlanId === planId || generatedPlan?.id === planId) {
          setGeneratedPlan(null);
          setCurrentEditingPlanId(null);
          setEditMode(false);
        }
      } else {
        toast.error("Delete failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Error deleting plan", { description: e.message });
    }
  };

  const handleCreateNew = () => {
    setSubject("");
    setWeek("");
    setDuration(45);
    setFormGrade("");
    setStrand("");
    setSubStrand("");
    setLessonTitle("");
    setGeneratedPlan(null);
    setCurrentEditingPlanId(null);
    setEditMode(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGeneratePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject || !formGrade || !duration) {
      toast.error("Required Fields Missing", {
        description: "Please provide Subject, Form/Grade, and Duration.",
      });
      return;
    }
    setIsGenerating(true);
    setGeneratedPlan(null);
    try {
      const payload = {
        subject,
        week,
        duration_minutes: duration,
        form_grade_level: formGrade,
        strand,
        sub_strand: subStrand,
      };
      const result = await generateLessonPlanAction(payload);
      if (result.success && result.plan) {
        setGeneratedPlan(result.plan as GeneratedLessonPlan);
        setLessonTitle(
          result.plan.title || `${subject} - ${formGrade} - Week ${week}`
        );
        setCurrentEditingPlanId(null);
        setEditMode(true);
        toast.success("Lesson plan draft generated!");
        window.scrollTo({
          top: document.getElementById("lesson-plan-output")?.offsetTop || 0,
          behavior: "smooth",
        });
      } else {
        toast.error("Generation Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Generation Error", { description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    if (!generatedPlan) return;
    if (!lessonTitle.trim()) {
      toast.error("Title Required", {
        description:
          "Please provide a title for this lesson plan before saving.",
      });
      return;
    }
    setIsSaving(true);
    try {
      const planToSave: GeneratedLessonPlan = {
        ...generatedPlan,
        title: lessonTitle,
        subject,
        week,
        duration_minutes: duration,
        form_grade_level: formGrade,
        strand,
        sub_strand: subStrand,
        id: currentEditingPlanId || undefined,
      };

      const result = await saveLessonPlanAction(planToSave);
      if (result.success && result.lessonPlanId) {
        setGeneratedPlan((prev) =>
          prev ? { ...prev, id: result.lessonPlanId } : null
        );
        setCurrentEditingPlanId(result.lessonPlanId);
        setEditMode(false);
        toast.success(
          `Lesson plan ${
            currentEditingPlanId ? "updated" : "saved"
          } successfully!`
        );
        fetchSavedPlans();
      } else {
        toast.error("Save Failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error("Save Error", { description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlanChange = (field: keyof GeneratedLessonPlan, value: any) => {
    if (generatedPlan) {
      setGeneratedPlan((prev) => (prev ? { ...prev, [field]: value } : null));
    }
  };

  const handleActivityChange = (
    index: number,
    field: keyof LessonPlanActivity,
    value: string
  ) => {
    if (generatedPlan && generatedPlan.main_activities) {
      const updatedActivities = [...generatedPlan.main_activities];
      // @ts-ignore
      updatedActivities[index][field] = value;
      handlePlanChange("main_activities", updatedActivities);
    }
  };

  const handleDownload = (format: "pdf" | "docx") => {
    if (!generatedPlan) return;
    toast.info(`Download as ${format.toUpperCase()} coming soon!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/20">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#022e7d] via-[#1e40af] to-[#fd6a3e] p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h1 className="text-4xl font-bold">AI Lesson Planner</h1>
              </div>
              <p className="text-blue-100 text-lg max-w-2xl">
                Create comprehensive, curriculum-aligned lesson plans powered by
                advanced AI technology
              </p>
            </div>
            <Button
              onClick={handleCreateNew}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white shadow-lg transition-all duration-200"
              size="lg"
            >
              <FilePlus2 className="mr-2 h-5 w-5" />
              Create New Plan
            </Button>
          </div>
        </div>

        {/* Create/Edit Form */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <Accordion
            type="single"
            defaultValue="item-1"
            collapsible
            className="w-full"
          >
            <AccordionItem value="item-1" className="border-0">
              <AccordionTrigger className="px-8 py-6 text-xl font-semibold text-[#022e7d] hover:text-[#fd6a3e] transition-colors">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-6 w-6" />
                  {currentEditingPlanId
                    ? "Edit Lesson Plan"
                    : "Create New Lesson Plan"}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="px-8 pb-8">
                  <form onSubmit={handleGeneratePlan} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label
                          htmlFor="subject"
                          className="text-[#022e7d] font-medium flex items-center gap-2"
                        >
                          <BookOpen className="h-4 w-4" />
                          Subject <span className="text-[#fd6a3e]">*</span>
                        </Label>
                        <Input
                          id="subject"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          required
                          className="border-2 border-slate-200 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 transition-all duration-200"
                          placeholder="e.g., Mathematics, Science, English"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="week"
                          className="text-[#022e7d] font-medium"
                        >
                          Week / Unit
                        </Label>
                        <Input
                          id="week"
                          value={week}
                          onChange={(e) => setWeek(e.target.value)}
                          className="border-2 border-slate-200 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 transition-all duration-200"
                          placeholder="e.g., Week 5, Unit 2"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="duration"
                          className="text-[#022e7d] font-medium flex items-center gap-2"
                        >
                          <Clock className="h-4 w-4" />
                          Duration (minutes){" "}
                          <span className="text-[#fd6a3e]">*</span>
                        </Label>
                        <Select
                          value={String(duration)}
                          onValueChange={(val) => setDuration(Number(val))}
                          required
                        >
                          <SelectTrigger className="border-2 border-slate-200 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {commonDurations.map((d) => (
                              <SelectItem key={d} value={String(d)}>
                                {d} mins
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="formGrade"
                          className="text-[#022e7d] font-medium flex items-center gap-2"
                        >
                          <GraduationCap className="h-4 w-4" />
                          Form / Grade Level{" "}
                          <span className="text-[#fd6a3e]">*</span>
                        </Label>
                        <Select
                          value={formGrade}
                          onValueChange={setFormGrade}
                          required
                        >
                          <SelectTrigger className="border-2 border-slate-200 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20">
                            <SelectValue placeholder="Select grade..." />
                          </SelectTrigger>
                          <SelectContent>
                            {commonFormsOrGrades.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="strand"
                          className="text-[#022e7d] font-medium"
                        >
                          Strand (Optional)
                        </Label>
                        <Input
                          id="strand"
                          value={strand}
                          onChange={(e) => setStrand(e.target.value)}
                          className="border-2 border-slate-200 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 transition-all duration-200"
                          placeholder="e.g., Algebra, Biology"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="subStrand"
                          className="text-[#022e7d] font-medium"
                        >
                          Sub-Strand (Optional)
                        </Label>
                        <Input
                          id="subStrand"
                          value={subStrand}
                          onChange={(e) => setSubStrand(e.target.value)}
                          className="border-2 border-slate-200 focus:border-[#fd6a3e] focus:ring-[#fd6a3e]/20 transition-all duration-200"
                          placeholder="e.g., Linear Equations"
                        />
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Button
                        type="submit"
                        disabled={isGenerating}
                        className="bg-gradient-to-r from-[#fd6a3e] to-[#ff8c42] hover:from-[#e55a36] hover:to-[#fd6a3e] text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                        size="lg"
                      >
                        {isGenerating ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          <Wand2 className="mr-2 h-5 w-5" />
                        )}
                        {currentEditingPlanId
                          ? "Regenerate Lesson Plan"
                          : "Generate Lesson Plan Draft"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>

        {/* Loading State */}
        {isGenerating && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-orange-50">
            <CardContent className="text-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-[#fd6a3e]/20 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#fd6a3e] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-[#022e7d]">
                    Nova Pro is crafting your lesson plan...
                  </h3>
                  <p className="text-slate-600">
                    This may take a few moments while we generate your
                    comprehensive lesson plan
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generated Plan Display */}
        {generatedPlan && !isGenerating && (
          <Card
            className="border-0 shadow-2xl bg-white"
            id="lesson-plan-output"
          >
            <CardHeader className="bg-gradient-to-r from-[#022e7d]/5 to-[#fd6a3e]/5 border-b border-slate-200">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="flex-1 space-y-3">
                  <Label
                    htmlFor="lessonTitle"
                    className="text-sm text-[#022e7d] font-medium"
                  >
                    Lesson Plan Title
                  </Label>
                  <Input
                    id="lessonTitle"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    className="text-2xl font-bold border-0 shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent text-[#022e7d]"
                    placeholder="Enter Lesson Title"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleSavePlan}
                    disabled={isSaving}
                    className="bg-[#022e7d] hover:bg-[#1e3a8a] text-white shadow-lg"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Plan
                  </Button>
                  <Button
                    onClick={() => handleDownload("pdf")}
                    variant="outline"
                    disabled={isSaving}
                    className="border-[#fd6a3e] text-[#fd6a3e] hover:bg-[#fd6a3e] hover:text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Plan Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[#022e7d]">
                    Subject
                  </div>
                  {editMode ? (
                    <Input
                      value={generatedPlan.subject}
                      onChange={(e) =>
                        handlePlanChange("subject", e.target.value)
                      }
                      className="border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                    />
                  ) : (
                    <div className="text-lg font-semibold text-slate-700">
                      {generatedPlan.subject}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[#022e7d]">
                    Week/Unit
                  </div>
                  {editMode ? (
                    <Input
                      value={generatedPlan.week}
                      onChange={(e) => handlePlanChange("week", e.target.value)}
                      className="border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                    />
                  ) : (
                    <div className="text-lg font-semibold text-slate-700">
                      {generatedPlan.week}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[#022e7d]">
                    Duration
                  </div>
                  {editMode ? (
                    <Input
                      type="number"
                      value={generatedPlan.duration_minutes}
                      onChange={(e) =>
                        handlePlanChange(
                          "duration_minutes",
                          Number(e.target.value)
                        )
                      }
                      className="border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                    />
                  ) : (
                    <div className="text-lg font-semibold text-slate-700">
                      {generatedPlan.duration_minutes} mins
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[#022e7d]">
                    Form/Grade
                  </div>
                  {editMode ? (
                    <Input
                      value={generatedPlan.form_grade_level}
                      onChange={(e) =>
                        handlePlanChange("form_grade_level", e.target.value)
                      }
                      className="border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                    />
                  ) : (
                    <div className="text-lg font-semibold text-slate-700">
                      {generatedPlan.form_grade_level}
                    </div>
                  )}
                </div>
                {generatedPlan.strand && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-[#022e7d]">
                      Strand
                    </div>
                    {editMode ? (
                      <Input
                        value={generatedPlan.strand}
                        onChange={(e) =>
                          handlePlanChange("strand", e.target.value)
                        }
                        className="border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                      />
                    ) : (
                      <div className="text-lg font-semibold text-slate-700">
                        {generatedPlan.strand}
                      </div>
                    )}
                  </div>
                )}
                {generatedPlan.sub_strand && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-[#022e7d]">
                      Sub-Strand
                    </div>
                    {editMode ? (
                      <Input
                        value={generatedPlan.sub_strand}
                        onChange={(e) =>
                          handlePlanChange("sub_strand", e.target.value)
                        }
                        className="border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                      />
                    ) : (
                      <div className="text-lg font-semibold text-slate-700">
                        {generatedPlan.sub_strand}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator className="bg-gradient-to-r from-[#022e7d]/20 via-[#fd6a3e]/20 to-[#022e7d]/20" />

              {/* Plan Content */}
              <div className="space-y-8">
                {Object.entries(generatedPlan).map(([key, value]) => {
                  if (
                    [
                      "id",
                      "title",
                      "subject",
                      "week",
                      "duration_minutes",
                      "form_grade_level",
                      "strand",
                      "sub_strand",
                    ].includes(key) ||
                    !value
                  )
                    return null;

                  const formattedKey = key
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase());

                  return (
                    <div key={key} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 bg-gradient-to-b from-[#fd6a3e] to-[#022e7d] rounded-full"></div>
                        <h4 className="text-xl font-bold text-[#022e7d]">
                          {formattedKey}
                        </h4>
                      </div>
                      <div className="ml-6 p-6 bg-gradient-to-br from-white to-slate-50/50 rounded-xl border border-slate-200 shadow-sm">
                        {editMode &&
                        key === "main_activities" &&
                        Array.isArray(value) ? (
                          <div className="space-y-4">
                            {value.map(
                              (activity: LessonPlanActivity, index: number) => (
                                <div
                                  key={index}
                                  className="p-4 bg-white rounded-lg border border-slate-200 space-y-3"
                                >
                                  <Label className="text-sm font-medium text-[#022e7d]">
                                    Activity {index + 1}
                                  </Label>
                                  <Textarea
                                    value={activity.activity}
                                    onChange={(e) =>
                                      handleActivityChange(
                                        index,
                                        "activity",
                                        e.target.value
                                      )
                                    }
                                    className="min-h-[80px] border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                                  />
                                  <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium text-[#022e7d]">
                                      Time (mins)
                                    </Label>
                                    <Input
                                      type="number"
                                      value={activity.time_minutes || ""}
                                      onChange={(e) =>
                                        handleActivityChange(
                                          index,
                                          "time_minutes",
                                          e.target.value
                                        )
                                      }
                                      className="w-24 border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                                    />
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        ) : editMode && typeof value !== "object" ? (
                          <Textarea
                            value={String(value)}
                            onChange={(e) =>
                              handlePlanChange(
                                key as keyof GeneratedLessonPlan,
                                e.target.value
                              )
                            }
                            className="min-h-[100px] border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                          />
                        ) : editMode &&
                          Array.isArray(value) &&
                          key !== "main_activities" ? (
                          <Textarea
                            value={value.join("\n")}
                            onChange={(e) =>
                              handlePlanChange(
                                key as keyof GeneratedLessonPlan,
                                e.target.value.split("\n")
                              )
                            }
                            className="min-h-[100px] border-[#fd6a3e]/30 focus:border-[#fd6a3e]"
                          />
                        ) : Array.isArray(value) &&
                          key === "main_activities" ? (
                          <div className="space-y-4">
                            {value.map(
                              (activity: LessonPlanActivity, index: number) => (
                                <div
                                  key={index}
                                  className="p-4 bg-white rounded-lg border border-slate-200"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-[#fd6a3e] text-white rounded-full flex items-center justify-center text-sm font-bold">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                      {activity.time_minutes && (
                                        <div className="text-sm font-medium text-[#022e7d]">
                                          {activity.time_minutes} minutes
                                        </div>
                                      )}
                                      <ChatMessageContentRenderer
                                        content={activity.activity}
                                      />
                                      {activity.description && (
                                        <div className="text-sm text-slate-600 pl-4 border-l-2 border-slate-200">
                                          <ChatMessageContentRenderer
                                            content={activity.description}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        ) : Array.isArray(value) ? (
                          <ul className="space-y-2">
                            {value.map((item, index) => (
                              <li
                                key={index}
                                className="flex items-start gap-3"
                              >
                                <div className="w-2 h-2 bg-[#fd6a3e] rounded-full mt-2 flex-shrink-0"></div>
                                <ChatMessageContentRenderer
                                  content={String(item)}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <ChatMessageContentRenderer content={String(value)} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!editMode && (
                <div className="flex justify-center pt-6">
                  <Button
                    onClick={() => setEditMode(true)}
                    className="bg-gradient-to-r from-[#fd6a3e] to-[#ff8c42] hover:from-[#e55a36] hover:to-[#fd6a3e] text-white shadow-lg"
                    size="lg"
                  >
                    <Edit className="mr-2 h-5 w-5" />
                    Edit This Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Saved Lesson Plans */}
        <Card className="border-0 shadow-xl bg-white">
          <CardHeader className="bg-gradient-to-r from-[#022e7d]/5 to-[#fd6a3e]/5 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#022e7d] rounded-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl text-[#022e7d]">
                  My Saved Lesson Plans
                </CardTitle>
                <CardDescription className="text-slate-600">
                  View, edit, or continue working on your previously saved
                  lesson plans
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {isLoadingPlans && (
              <div className="text-center py-12">
                <div className="relative mx-auto w-12 h-12">
                  <div className="w-12 h-12 border-4 border-[#fd6a3e]/20 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-12 h-12 border-4 border-[#fd6a3e] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="mt-4 text-slate-600">
                  Loading your lesson plans...
                </p>
              </div>
            )}

            {!isLoadingPlans && savedPlans.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  No lesson plans yet
                </h3>
                <p className="text-slate-500">
                  You haven't saved any lesson plans yet. Generate one above to
                  get started!
                </p>
              </div>
            )}

            {!isLoadingPlans && savedPlans.length > 0 && (
              <div className="grid gap-6">
                {savedPlans.map((plan) => (
                  <Card
                    key={plan.id}
                    className="border border-slate-200 hover:border-[#fd6a3e]/50 hover:shadow-lg transition-all duration-200 bg-gradient-to-r from-white to-slate-50/30"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <h3 className="text-xl font-bold text-[#022e7d] group-hover:text-[#fd6a3e] transition-colors">
                            {plan.title}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" />
                              {plan.subject}
                            </span>
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-4 w-4" />
                              {plan.form_grade_level}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Last updated:{" "}
                            {new Date(plan.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            onClick={() => loadPlanForEditing(plan.id)}
                            className="border-[#022e7d] text-[#022e7d] hover:bg-[#022e7d] hover:text-white"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit / View
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              handleDeletePlan(plan.id, plan.title)
                            }
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
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
      </div>
    </div>
  );
}
