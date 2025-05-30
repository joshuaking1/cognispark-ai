"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { generateLearningPlanAction } from "@/app/actions/learningPlanActions";
import ChatMessageContentRenderer from "@/components/chat/ChatMessageContentRenderer";

// Define structure for a plan item
export interface LearningPlanItem {
  id: string;
  type: "chat_topic" | "smart_note_task" | "essay_helper_task" | "flashcard_task" | "external_resource" | "general_tip";
  title: string;
  description?: string;
  action_link?: string;
  resource_type?: string;
}

export interface LearningPlan {
  introduction?: string;
  steps: LearningPlanItem[];
  conclusion?: string;
}

interface LearningPlanGeneratorProps {
  onPlanGenerated: (plan: LearningPlan | null, error?: string) => void;
  initialGoal?: string;
}

export default function LearningPlanGenerator({ onPlanGenerated, initialGoal = "" }: LearningPlanGeneratorProps) {
  const [currentGoal, setCurrentGoal] = useState(initialGoal);
  const [isLoading, setIsLoading] = useState(false);

  const handleGeneratePlan = async () => {
    if (!currentGoal.trim()) {
      toast.info("Optional Goal", { 
        description: "No specific goal entered. Nova will generate a general plan based on your profile." 
      });
    }
    
    setIsLoading(true);
    try {
      const result = await generateLearningPlanAction(currentGoal.trim());
      if (result.success && result.plan) {
        onPlanGenerated(result.plan as LearningPlan);
        toast.success("Learning plan generated!");
      } else {
        onPlanGenerated(null, result.error || "Could not generate learning plan.");
        toast.error("Plan Generation Failed", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Plan Generation Error", { description: error.message });
      onPlanGenerated(null, error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="learningGoal" className="text-md font-medium">
          What's your current learning goal? (Optional)
        </Label>
        <Textarea
          id="learningGoal"
          value={currentGoal}
          onChange={(e) => setCurrentGoal(e.target.value)}
          placeholder="e.g., Understand photosynthesis, Prepare for my algebra test, Write an essay on climate change..."
          className="mt-1 min-h-[80px]"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Nova will use this and your profile (grade, subjects) to suggest a plan.
        </p>
      </div>
      <Button 
        onClick={handleGeneratePlan} 
        disabled={isLoading} 
        className="w-full sm:w-auto"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        Generate My Learning Plan
      </Button>
    </div>
  );
} 