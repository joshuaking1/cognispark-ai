"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import type { LearningPlan, LearningPlanItem } from "@/components/dashboard/LearningPlanGenerator";
import { revalidatePath } from "next/cache";

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) console.error("CRITICAL: GROQ_API_KEY for learning plan is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

interface PlanGenerationResult {
  success: boolean;
  plan?: LearningPlan;
  error?: string;
}

// Helper function to clean and validate JSON string
function cleanAndValidateJsonString(jsonString: string): string {
  try {
    // First attempt: try parsing as is
    JSON.parse(jsonString);
    return jsonString;
  } catch (e) {
    // If parsing fails, proceed with cleaning
  }

  // Remove any markdown code block markers and trim
  let cleaned = jsonString.replace(/```json\s*|\s*```/g, '').trim();
  
  // Find the first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No valid JSON object found in the response");
  }
  
  // Extract just the JSON object
  cleaned = cleaned.substring(firstBrace, lastBrace + 1);

  // Fix common JSON formatting issues
  cleaned = cleaned
    // Fix single quotes to double quotes for property names
    .replace(/(\w+):/g, '"$1":')
    // Fix single quotes to double quotes for string values
    .replace(/'/g, '"')
    // Remove trailing commas
    .replace(/,(\s*[}\]])/g, '$1')
    // Fix missing quotes around property names
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
    // Fix missing quotes in string values
    .replace(/(:\s*)([^"{\[\s][^,}\]]*?)(\s*[,}])/g, '$1"$2"$3')
    // Fix missing quotes in array values
    .replace(/(\[\s*)([^"{\[\s][^,}\]]*?)(\s*[,}\]])/g, '$1"$2"$3')
    // Fix missing quotes in object values
    .replace(/({\s*)([^"{\[\s][^,}\]]*?)(\s*[,}])/g, '$1"$2"$3')
    // Fix missing quotes in property values
    .replace(/(:\s*)([^"{\[\s][^,}\]]*?)(\s*[,}])/g, '$1"$2"$3')
    // Remove any remaining trailing commas
    .replace(/,(\s*[}\]])/g, '$1')
    // Fix any remaining unquoted property names
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

  // Try parsing the cleaned JSON
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    console.error("Failed to clean JSON:", e);
    console.error("Original string:", jsonString);
    console.error("Cleaned string:", cleaned);
    throw new Error("Failed to clean and validate JSON structure");
  }
}

export async function generateLearningPlanAction(
  currentUserGoalInput?: string // This is the optional, session-specific goal from the dashboard input
): Promise<PlanGenerationResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "User not authenticated." };

  // Fetch user's profile including grade, subjects, AND saved learning_goals
  const { data: profileData } = await supabase
    .from('profiles')
    .select('grade_level, subjects_of_interest, date_of_birth, learning_goals')
    .eq('id', user.id)
    .single();

  let personalizationContext = "The student is using CogniSpark AI, a platform with features like AI Chat (Nova), Smart Notes (summarizer), Essay Helper, Photo Problem Solver, and Flashcards.";
  if (profileData) {
    if (profileData.grade_level && profileData.grade_level !== "Not Specified") {
      personalizationContext += ` They are in ${profileData.grade_level}.`;
    }
    if (profileData.date_of_birth) {
      const birthDate = new Date(profileData.date_of_birth);
      const ageDiffMs = Date.now() - birthDate.getTime();
      const ageDate = new Date(ageDiffMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      if (age > 5 && age < 80) personalizationContext += ` They are approximately ${age} years old.`;
    }
    if (profileData.subjects_of_interest && (profileData.subjects_of_interest as string[]).length > 0) {
      personalizationContext += ` Their stated subjects of interest are: ${(profileData.subjects_of_interest as string[]).join(", ")}.`;
    }
    // Add learning goals to personalization context
    if (profileData.learning_goals && (profileData.learning_goals as string[]).length > 0) {
      personalizationContext += ` Their overarching learning goals include: ${(profileData.learning_goals as string[]).join("; ")}.`;
    }
  }

  let goalContext = "";
  if (currentUserGoalInput && currentUserGoalInput.trim() !== "") {
    goalContext = `For this specific session, their immediate focus or goal is: "${currentUserGoalInput.trim()}". Please try to align the plan with this immediate focus while keeping their profile and overarching goals in mind.`;
  } else if (profileData?.learning_goals && (profileData.learning_goals as string[]).length > 0) {
    goalContext = `Their current overarching learning goals are: ${(profileData.learning_goals as string[]).join("; ")}. Generate a plan that helps them make progress on one or more of these.`;
  } else {
    goalContext = "They haven't specified an immediate goal for this session nor have overarching goals saved. Generate a general learning plan tailored to their profile (grade, subjects) to help them explore or reinforce learning.";
  }

  const prompt = `You are Nova, an expert AI learning coach.
${personalizationContext}
${goalContext}

Based on all this information, generate a concise and actionable learning plan with 3 to 5 steps.
Each step should clearly guide the student on what to do. Steps can involve using features of CogniSpark AI or suggesting high-quality, free external resources.

CRITICAL: Your response must be a valid JSON object with the following strict requirements:
1. Use double quotes (") for ALL property names and string values
2. Do not include any text outside the JSON object
3. Do not use markdown formatting or code blocks
4. Do not include trailing commas
5. Do not include comments
6. Ensure ALL string values are properly quoted
7. Do not use apostrophes in text (use "is" instead of "is")

The JSON object must have this exact structure:
{
  "introduction": "Optional brief introduction",
  "steps": [
    {
      "id": "step_1",
      "type": "chat_topic",
      "title": "Step title",
      "description": "Optional description",
      "action_link": "Optional link",
      "resource_type": "Optional resource type"
    }
  ],
  "conclusion": "Optional conclusion"
}

Valid step types are: "chat_topic", "smart_note_task", "essay_helper_task", "flashcard_task", "external_resource", "general_tip"

Here is a complete example of a valid response:
{
  "introduction": "Let's help you understand photosynthesis better!",
  "steps": [
    {
      "id": "step_1",
      "type": "chat_topic",
      "title": "Discuss Photosynthesis Basics",
      "description": "Ask Nova to explain the basic process of photosynthesis and its importance.",
      "action_link": "/chat?prefill=Explain photosynthesis basics"
    },
    {
      "id": "step_2",
      "type": "flashcard_task",
      "title": "Create Photosynthesis Flashcards",
      "description": "Make flashcards for key terms like chlorophyll, glucose, and oxygen.",
      "action_link": "/flashcards/new"
    },
    {
      "id": "step_3",
      "type": "external_resource",
      "title": "Watch Photosynthesis Animation",
      "description": "Watch this interactive animation to visualize the process.",
      "action_link": "https://www.khanacademy.org/science/photosynthesis",
      "resource_type": "Video"
    }
  ],
  "conclusion": "Great job! You are well on your way to mastering photosynthesis."
}

Generate your response now, following this exact format. Remember to properly quote ALL string values.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192",
      temperature: 0.6,
      max_tokens: 1500,
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) return { success: false, error: "AI did not return a learning plan." };

    try {
      // Clean and validate the JSON string
      const cleanedJson = cleanAndValidateJsonString(rawResponse);
      const parsedPlan = JSON.parse(cleanedJson) as LearningPlan;

      // Validate plan structure
      if (!parsedPlan || !Array.isArray(parsedPlan.steps) || !parsedPlan.steps.every(s => s.id && s.type && s.title)) {
        console.error("Parsed learning plan has invalid structure:", parsedPlan);
        throw new Error("AI returned a plan with an unexpected structure.");
      }

      // Validate step types
      const validTypes = ["chat_topic", "smart_note_task", "essay_helper_task", "flashcard_task", "external_resource", "general_tip"];
      const invalidSteps = parsedPlan.steps.filter(step => !validTypes.includes(step.type));
      if (invalidSteps.length > 0) {
        console.error("Invalid step types found:", invalidSteps);
        throw new Error("AI returned steps with invalid types.");
      }

      return { success: true, plan: parsedPlan };
    } catch (parseError: any) {
      console.error("JSON Parse Error:", parseError);
      console.error("Raw Response:", rawResponse);
      return { success: false, error: `Failed to parse AI response: ${parseError.message}` };
    }
  } catch (error: any) {
    console.error("Groq Learning Plan Error:", error);
    return { success: false, error: `AI plan generation failed: ${error.message}` };
  }
}

export async function saveActiveLearningPlanAction(plan: LearningPlan): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "User not authenticated." };

  try {
    // Ensure we have a valid timestamp
    const now = new Date();
    if (isNaN(now.getTime())) {
      throw new Error("Invalid timestamp generated");
    }
    const timestamp = now.toISOString();

    // Ensure we have a valid plan
    if (!plan || !Array.isArray(plan.steps)) {
      throw new Error("Invalid learning plan structure");
    }

    // Log the data we're about to send
    console.log('Saving plan with data:', {
      active_learning_plan: plan,
      active_plan_generated_at: timestamp,
      active_plan_completed_steps: []
    });

    // Perform a single update with the new plan
    const { error } = await supabase
      .from("profiles")
      .update({
        active_learning_plan: plan,
        active_plan_generated_at: timestamp,
        active_plan_completed_steps: []
      })
      .eq("id", user.id);

    if (error) { 
      console.error("Error saving active plan:", error); 
      console.error("Full error object:", JSON.stringify(error, null, 2));
      return { success: false, error: error.message }; 
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error in saveActiveLearningPlanAction:", error);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    return { success: false, error: error.message };
  }
}

export async function markLearningPlanStepAction(stepId: string, completed: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "User not authenticated." };

  // Fetch current completed steps
  const { data: profileData, error: fetchError } = await supabase
    .from("profiles")
    .select("active_plan_completed_steps")
    .eq("id", user.id)
    .single();

  if (fetchError || !profileData) return { success: false, error: "Could not retrieve current plan."};

  let completedSteps: string[] = (profileData.active_plan_completed_steps as string[] || []);
  if (completed) {
    if (!completedSteps.includes(stepId)) completedSteps.push(stepId);
  } else {
    completedSteps = completedSteps.filter(id => id !== stepId);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ 
      active_plan_completed_steps: completedSteps, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", user.id);

  if (updateError) { 
    console.error("Error marking step:", updateError); 
    return { success: false, error: updateError.message };
  }
  revalidatePath("/dashboard");
  return { success: true };
}

export async function clearActiveLearningPlanAction(): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, error: "User not authenticated." };

  const { error } = await supabase
    .from("profiles")
    .update({
      active_learning_plan: null,
      active_plan_generated_at: null,
      active_plan_completed_steps: []
    })
    .eq("id", user.id);

  if (error) { 
    console.error("Error clearing active plan:", error);
    return { success: false, error: error.message }; 
  }
  revalidatePath("/dashboard");
  return { success: true };
} 