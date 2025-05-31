"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  CalendarDays,
  ArrowRight, 
  ArrowLeft,
  Sparkles
} from "lucide-react";

interface OnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (data: {
    fullName: string;
    dateOfBirth: string;
    gradeLevel: string;
    subjectsOfInterest: string[];
  }) => Promise<void>;
}

type OnboardingStep = "welcome" | "personal" | "education" | "interests";

const gradeLevels = [
  "Not Specified", "Kindergarten", "1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade",
  "6th Grade", "7th Grade", "8th Grade", "9th Grade", "10th Grade (SHS1)",
  "11th Grade (SHS2)", "12th Grade (SHS3)", "College/University", "Adult Learner", "Other"
];

export default function OnboardingDialog({ open, onOpenChange, onComplete }: OnboardingDialogProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    date_of_birth: "",
    grade_level: "Not Specified",
    subjects_of_interest: "",
  });

  const supabase = createPagesBrowserClient();

  const handleNext = () => {
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

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No user session found");

      const subjectsArray = formData.subjects_of_interest.split(',').map(s => s.trim()).filter(s => s.length > 0);

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim() || null,
          date_of_birth: formData.date_of_birth || null,
          grade_level: formData.grade_level === "Not Specified" ? null : formData.grade_level,
          subjects_of_interest: subjectsArray,
          onboarding_completed: true,
        })
        .eq('id', session.user.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      onComplete({
        fullName: formData.full_name,
        dateOfBirth: formData.date_of_birth,
        gradeLevel: formData.grade_level,
        subjectsOfInterest: subjectsArray,
      });
    } catch (error: any) {
      toast.error("Failed to update profile", {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold text-center">
              Welcome to CogniSpark AI!
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Let's personalize your learning experience. We'll ask you a few questions to better understand your needs and goals.
            </DialogDescription>
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
              <UserCircle2 className="w-6 h-6 text-blue-500" />
              <DialogTitle className="text-xl font-bold">
                Personal Information
              </DialogTitle>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Your full name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
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
              <GraduationCap className="w-6 h-6 text-purple-500" />
              <DialogTitle className="text-xl font-bold">
                Education Level
              </DialogTitle>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gradeLevel">Grade Level</Label>
                <Select
                  value={formData.grade_level}
                  onValueChange={(value) => setFormData({ ...formData, grade_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your grade level" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLevels.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <BookOpen className="w-6 h-6 text-blue-500" />
              <DialogTitle className="text-xl font-bold">
                Subjects of Interest
              </DialogTitle>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subjectsOfInterest">What subjects are you interested in learning?</Label>
                <Input
                  id="subjectsOfInterest"
                  placeholder="e.g., Math, Physics, History, Python Programming"
                  value={formData.subjects_of_interest}
                  onChange={(e) => setFormData({ ...formData, subjects_of_interest: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Enter subjects separated by commas.</p>
              </div>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </DialogHeader>
        <div className="flex justify-between mt-6">
          {currentStep !== "welcome" && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={isLoading}
            className={currentStep === "welcome" ? "w-full" : ""}
          >
            {currentStep === "interests" ? (
              isLoading ? "Saving..." : "Complete Setup"
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 