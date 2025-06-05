"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";
import { toast } from "sonner";
import { 
  GraduationCap, 
  BookOpen, 
  UserCircle2,
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  Loader2,
  Plus,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: {
    full_name: string;
    date_of_birth: string;
    grade_level: string;
    subjects_of_interest: string[];
  }) => Promise<void>;
}

type OnboardingStep = "welcome" | "personal" | "education" | "interests";

const gradeLevels = [
  { value: "not_specified", label: "Not Specified" },
  { value: "kindergarten", label: "Kindergarten" },
  { value: "grade_1", label: "1st Grade" },
  { value: "grade_2", label: "2nd Grade" },
  { value: "grade_3", label: "3rd Grade" },
  { value: "grade_4", label: "4th Grade" },
  { value: "grade_5", label: "5th Grade" },
  { value: "grade_6", label: "6th Grade" },
  { value: "grade_7", label: "7th Grade" },
  { value: "grade_8", label: "8th Grade" },
  { value: "grade_9", label: "9th Grade" },
  { value: "grade_10", label: "10th Grade (SHS1)" },
  { value: "grade_11", label: "11th Grade (SHS2)" },
  { value: "grade_12", label: "12th Grade (SHS3)" },
  { value: "college", label: "College/University" },
  { value: "adult_learner", label: "Adult Learner" },
  { value: "other", label: "Other" }
];

const popularSubjects = [
  "Mathematics", "Physics", "Chemistry", "Biology", "History", 
  "Geography", "English", "Literature",
  "ICT", "Art", "Music", "Economics",
];

export default function OnboardingDialog({ open, onOpenChange, onComplete }: OnboardingDialogProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [isLoading, setIsLoading] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    grade_level: "not_specified",
    subjects_of_interest: [] as string[],
  });

  const supabase = createPagesBrowserClient();

  const canProceed = () => {
    switch (currentStep) {
      case "welcome":
        return true;
      case "personal":
        return formData.full_name.trim().length > 0;
      case "education":
        return formData.grade_level !== "";
      case "interests":
        return formData.subjects_of_interest.length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) {
      toast.error("Please fill in all required fields");
      return;
    }

    switch (currentStep) {
      case "welcome":
        setCurrentStep("personal");
        break;
      case "personal":
        setCurrentStep("education");
        break;
      case "education":
        setCurrentStep("interests");
        break;
      case "interests":
        handleSubmit();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "personal":
        setCurrentStep("welcome");
        break;
      case "education":
        setCurrentStep("personal");
        break;
      case "interests":
        setCurrentStep("education");
        break;
    }
  };

  const addSubject = (subject: string) => {
    if (!formData.subjects_of_interest.includes(subject)) {
      setFormData({
        ...formData,
        subjects_of_interest: [...formData.subjects_of_interest, subject]
      });
    }
  };

  const removeSubject = (subject: string) => {
    setFormData({
      ...formData,
      subjects_of_interest: formData.subjects_of_interest.filter(s => s !== subject)
    });
  };

  const addCustomSubject = () => {
    const trimmedSubject = customSubject.trim();
    if (trimmedSubject && !formData.subjects_of_interest.includes(trimmedSubject)) {
      addSubject(trimmedSubject);
      setCustomSubject("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentStep === "interests" && customSubject.trim()) {
        addCustomSubject();
      } else {
        handleNext();
      }
    }
  };

  const handleSubmit = async () => {
    if (formData.subjects_of_interest.length === 0) {
      toast.error("Please select at least one subject of interest");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No user session found");

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          date_of_birth: formData.date_of_birth || null,
          grade_level: formData.grade_level === "not_specified" ? null : formData.grade_level,
          subjects_of_interest: formData.subjects_of_interest,
          has_completed_onboarding: true,
        })
        .eq('id', session.user.id);

      if (error) throw error;

      toast.success("Welcome to LearnBrigeEdu! Your profile has been set up successfully.");
      
      await onComplete({
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth,
        grade_level: formData.grade_level,
        subjects_of_interest: formData.subjects_of_interest,
      });
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error("Failed to complete setup", {
        description: error.message || "Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepProgress = () => {
    const steps = ["welcome", "personal", "education", "interests"];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 text-center"
          >
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                <img src="/LearnBridge logo inverted2.png" alt="LearnBrigeEdu Logo" className="h-12 w-auto" />
              </div>
            </div>
            <div className="space-y-4">
              <DialogTitle className="text-2xl font-bold">
                Welcome to LearnBrigeEdu!
              </DialogTitle>
              <DialogDescription className="text-base leading-relaxed">
                Let's personalize your learning experience. We'll ask you a few questions to better understand your needs and create a tailored learning journey just for you.
              </DialogDescription>
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                This should only take about 2 minutes to complete.
              </div>
            </div>
          </motion.div>
        );

      case "personal":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <UserCircle2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Personal Information
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Tell us a bit about yourself
                </DialogDescription>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  placeholder="Enter your full name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  onKeyPress={handleKeyPress}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth" className="text-sm font-medium">
                  Date of Birth
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Optional - helps us provide age-appropriate content
                </p>
              </div>
            </div>
          </motion.div>
        );

      case "education":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Education Level
                </DialogTitle>
                <DialogDescription className="text-sm">
                  What's your current education level?
                </DialogDescription>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gradeLevel" className="text-sm font-medium">
                  Grade Level <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.grade_level}
                  onValueChange={(value) => setFormData({ ...formData, grade_level: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select your grade level" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLevels.map((grade) => (
                      <SelectItem key={grade.value} value={grade.value}>
                        {grade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This helps us recommend appropriate learning materials
                </p>
              </div>
            </div>
          </motion.div>
        );

      case "interests":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Subjects of Interest
                </DialogTitle>
                <DialogDescription className="text-sm">
                  What would you like to learn about?
                </DialogDescription>
              </div>
            </div>
            
            {/* Selected subjects */}
            {formData.subjects_of_interest.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Selected Subjects:</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.subjects_of_interest.map((subject) => (
                    <Badge
                      key={subject}
                      variant="secondary"
                      className="px-3 py-1 flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      {subject}
                      <button
                        onClick={() => removeSubject(subject)}
                        className="ml-1 hover:text-destructive-foreground"
                        type="button"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Popular subjects */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Popular Subjects:</Label>
              <div className="flex flex-wrap gap-2">
                {popularSubjects.map((subject) => (
                  <Badge
                    key={subject}
                    variant={formData.subjects_of_interest.includes(subject) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      formData.subjects_of_interest.includes(subject)
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-white dark:bg-gray-950 hover:bg-primary/10 hover:text-primary"
                    )}
                    onClick={() => 
                      formData.subjects_of_interest.includes(subject) 
                        ? removeSubject(subject) 
                        : addSubject(subject)
                    }
                  >
                    {subject}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Custom subject input */}
            <div className="space-y-2">
              <Label htmlFor="customSubject" className="text-sm font-medium">
                Add Custom Subject:
              </Label>
              <div className="flex gap-2">
                <Input
                  id="customSubject"
                  placeholder="e.g., Python Programming, Ancient History"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 h-10 bg-white dark:bg-gray-950"
                />
                <Button
                  type="button"
                  onClick={addCustomSubject}
                  disabled={!customSubject.trim()}
                  size="sm"
                  className="h-10 px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {formData.subjects_of_interest.length === 0 && (
              <p className="text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
                Please select at least one subject to continue.
              </p>
            )}
          </motion.div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        {/* Progress bar */}
        {currentStep !== "welcome" && (
          <div className="w-full bg-muted rounded-full h-2 mb-4">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${getStepProgress()}%` }}
            />
          </div>
        )}

        <DialogHeader>
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </DialogHeader>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          {currentStep !== "welcome" ? (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <div></div>
          )}

          <div className="flex items-center gap-2">
            {currentStep !== "welcome" && (
              <span className="text-sm text-muted-foreground">
                Step {["personal", "education", "interests"].indexOf(currentStep) + 1} of 3
              </span>
            )}
            <Button
              onClick={handleNext}
              disabled={isLoading || !canProceed()}
              className={`flex items-center gap-2 ${currentStep === "welcome" ? "w-full" : ""}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {currentStep === "interests" ? "Completing Setup..." : "Loading..."}
                </>
              ) : currentStep === "interests" ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Complete Setup
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}