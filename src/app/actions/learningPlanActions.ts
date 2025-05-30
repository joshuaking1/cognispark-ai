"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import type { LearningPlan, LearningPlanItem } from "@/components/dashboard/LearningPlanGenerator";

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
  userGoal?: string
): Promise<PlanGenerationResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };

  const supabase = createSupabaseServerActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "User not authenticated." };
  }

  // Fetch user's profile for personalization
  const { data: profileData } = await supabase
    .from('profiles')
    .select('grade_level, subjects_of_interest, date_of_birth')
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
  }

  let goalContext = "Their current goal is to get general learning suggestions tailored to their profile.";
  if (userGoal && userGoal.trim() !== "") {
    goalContext = `Their specific learning goal is: "${userGoal.trim()}".`;
  }

  const prompt = `You are Nova, an expert AI learning coach.
${personalizationContext}
${goalContext}

Based on this information, generate a concise and actionable learning plan with 3 to 5 steps.
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