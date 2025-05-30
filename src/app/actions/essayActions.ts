// src/app/actions/essayActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server"; // For potential auth

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) console.error("CRITICAL: GROQ_API_KEY for essay actions is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

interface BrainstormResult {
  success: boolean;
  ideas?: string[];
  error?: string;
}

interface OutlineSection { // Ensure this interface matches what you ask the LLM for
  id: string;
  title: string;
  points: string[];
}
interface OutlineResult {
  success: boolean;
  outline?: OutlineSection[]; // This will now be directly from parsed JSON
  error?: string;
}

interface FeedbackPoint {
  id: string;
  area: string;
  comment: string;
  originalText?: string;
  suggestion?: string;
}

interface FeedbackResult {
  success: boolean;
  feedback?: FeedbackPoint[];
  error?: string;
}

// --- Brainstorming Action ---
export async function brainstormEssayIdeasAction(
  topic: string,
  userKeyPoints?: string,
  essayType?: string
): Promise<BrainstormResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };
  if (!topic.trim()) return { success: false, error: "Essay topic is required." };

  // Personalization: Fetch user profile
  let personalizationInstruction = "";
  try {
    const supabase = createSupabaseServerActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('grade_level, subjects_of_interest, date_of_birth, full_name')
        .eq('id', user.id)
        .single();
      if (profileData) {
        if (profileData.full_name) {
          personalizationInstruction += ` The student's name is ${profileData.full_name}.`;
        }
        if (profileData.grade_level && profileData.grade_level !== "Not Specified") {
          personalizationInstruction += ` The ideas should be appropriate for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationInstruction += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the ideas if relevant.`;
        }
        if (profileData.subjects_of_interest && (profileData.subjects_of_interest as string[]).length > 0) {
          personalizationInstruction += ` If possible, relate the ideas to topics like ${(profileData.subjects_of_interest as string[]).join(", ")}.`;
        }
      }
    }
  } catch (e) { /* Ignore personalization errors */ }
  // Add current time and timezone
  const now = new Date();
  const timeString = now.toLocaleString();
  personalizationInstruction += ` Current time: ${timeString}.`;

  let prompt = `Brainstorm a list of diverse ideas and potential arguments for an essay on the topic: "${topic}".${personalizationInstruction}`;
  if (essayType) prompt += ` The essay is intended to be ${essayType}.`;
  if (userKeyPoints) prompt += ` Consider these user-provided key points or themes: "${userKeyPoints}".`;
  prompt += "\n\nProvide a list of 5-7 distinct ideas or discussion points. Each idea should be a short phrase or sentence. Output as a simple list, each idea on a new line, without numbering or bullet points initially (we will parse it that way).";

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192", // Mixtral might be good for creative brainstorming too
      temperature: 0.7, // Higher temperature for more diverse ideas
      max_tokens: 300,
    });

    const rawIdeas = completion.choices[0]?.message?.content?.trim();
    if (!rawIdeas) return { success: false, error: "AI could not generate brainstorming ideas." };

    // Split by newline and filter out empty lines
    const ideas = rawIdeas.split('\n').map(idea => idea.trim()).filter(idea => idea.length > 0);

    return { success: true, ideas };

  } catch (error: any) {
    console.error("Groq Brainstorming Error:", error);
    return { success: false, error: "AI brainstorming failed." };
  }
}

// --- Outline Generation Action ---
export async function generateEssayOutlineAction(
  topic: string,
  contextFromUserOrBrainstorm?: string,
  essayType?: string
): Promise<OutlineResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };
  if (!topic.trim()) return { success: false, error: "Essay topic is required." };

  // Personalization: Fetch user profile
  let personalizationInstruction = "";
  try {
    const supabase = createSupabaseServerActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('grade_level, subjects_of_interest, date_of_birth, full_name')
        .eq('id', user.id)
        .single();
      if (profileData) {
        if (profileData.full_name) {
          personalizationInstruction += ` The student's name is ${profileData.full_name}.`;
        }
        if (profileData.grade_level && profileData.grade_level !== "Not Specified") {
          personalizationInstruction += ` The outline should be appropriate for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationInstruction += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the outline if relevant.`;
        }
        if (profileData.subjects_of_interest && (profileData.subjects_of_interest as string[]).length > 0) {
          personalizationInstruction += ` If possible, relate the outline to topics like ${(profileData.subjects_of_interest as string[]).join(", ")}.`;
        }
      }
    }
  } catch (e) { /* Ignore personalization errors */ }
  // Add current time and timezone
  const now = new Date();
  const timeString = now.toLocaleString();
  personalizationInstruction += ` Current time: ${timeString}.`;

  let prompt = `Generate a structured essay outline for the topic: "${topic}".${personalizationInstruction}`;
  if (essayType) prompt += ` The essay is intended to be ${essayType}.`;
  if (contextFromUserOrBrainstorm) {
    prompt += ` Consider these key points or previously brainstormed ideas: "${contextFromUserOrBrainstorm}".`;
  }

  prompt += `

The output MUST be a single, valid JSON object. Do not include any text or explanation outside of this JSON object.
The JSON object should have a single root key named "outline".
The value of "outline" should be an array of section objects.
Each section object in the array must have the following three keys:
1.  "id": A unique string identifier for the section (e.g., "introduction", "body_1", "conclusion").
2.  "title": A string representing the title of that section (e.g., "Introduction", "Main Argument: The Impact on Mental Health", "Conclusion").
3.  "points": An array of strings, where each string is a key point or sub-topic to be discussed in that section. Aim for 2-4 points per section.

Example of the desired JSON structure:
{
  "outline": [
    {
      "id": "introduction",
      "title": "Introduction",
      "points": [
        "Hook the reader with a compelling statistic about social media usage.",
        "Briefly introduce the main arguments regarding the impact of social media.",
        "State the thesis: While offering connectivity, the impact of social media on teenagers is predominantly negative due to effects on mental health and exposure to cyberbullying."
      ]
    },
    {
      "id": "body_1",
      "title": "Impact on Mental Health",
      "points": [
        "Discuss the correlation between high social media use and increased anxiety/depression.",
        "Explain the concept of social comparison and its negative effects.",
        "Mention the fear of missing out (FOMO)."
      ]
    },
    // ... more body sections ...
    {
      "id": "conclusion",
      "title": "Conclusion",
      "points": [
        "Restate the thesis in different words.",
        "Summarize the main points discussed.",
        "Offer a final thought or a call to action (e.g., promoting mindful social media use)."
      ]
    }
  ]
}

Generate the JSON object now.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Larger models are generally better at following complex JSON instructions
      temperature: 0.3,        // Lower temperature for more predictable, structured output
      max_tokens: 1500,        // Allow enough tokens for a detailed JSON outline
      // response_format: { type: "json_object" }, // If Groq/model supports this, it's ideal! Check Groq docs.
                                                  // For now, we'll parse assuming it follows the text prompt.
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) {
      return { success: false, error: "AI did not return any content for the outline." };
    }

    // Attempt to parse the JSON
    let parsedOutline: { outline: OutlineSection[] } | null = null;
    try {
      // Sometimes LLMs might still wrap the JSON in markdown ```json ... ```
      const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStringToParse = jsonMatch ? jsonMatch[1] : rawResponse;
      parsedOutline = JSON.parse(jsonStringToParse);
    } catch (parseError: any) {
      console.error("Failed to parse JSON outline from AI:", parseError.message);
      console.error("Raw AI response for outline:", rawResponse); // Log the raw response for debugging
      return { success: false, error: "AI returned an invalid outline format. Raw response logged on server." };
    }

    if (!parsedOutline || !parsedOutline.outline || !Array.isArray(parsedOutline.outline)) {
      console.error("Parsed JSON does not match expected outline structure. Parsed:", parsedOutline);
      return { success: false, error: "AI returned data that doesn't match the outline structure." };
    }

    // Validate structure of each section (optional but good)
    const isValidOutline = parsedOutline.outline.every(section =>
        typeof section.id === 'string' &&
        typeof section.title === 'string' &&
        Array.isArray(section.points) &&
        section.points.every(point => typeof point === 'string')
    );

    if (!isValidOutline) {
        console.error("One or more sections in the outline have an invalid structure. Parsed:", parsedOutline.outline);
        return { success: false, error: "AI outline has malformed sections." };
    }

    return { success: true, outline: parsedOutline.outline };

  } catch (error: any) {
    console.error("Groq Outline Error (JSON attempt):", error);
    if (error instanceof Groq.APIError) {
        return { success: false, error: `AI outline generation failed: ${error.status} ${error.message}` };
    }
    return { success: false, error: "AI outline generation encountered an unexpected issue." };
  }
}

// --- Paragraph Feedback Action ---
export async function getParagraphFeedbackAction(
  paragraphText: string,
  feedbackTypes: string[],
  essayTopic?: string,
  essayType?: string
): Promise<FeedbackResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };
  if (!paragraphText.trim()) return { success: false, error: "Paragraph text is required." };
  if (feedbackTypes.length === 0) return { success: false, error: "At least one feedback type must be selected." };

  // Personalization: Fetch user profile
  let personalizationInstruction = "";
  try {
    const supabase = createSupabaseServerActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('grade_level, subjects_of_interest, date_of_birth, full_name')
        .eq('id', user.id)
        .single();
      if (profileData) {
        if (profileData.full_name) {
          personalizationInstruction += ` The student's name is ${profileData.full_name}.`;
        }
        if (profileData.grade_level && profileData.grade_level !== "Not Specified") {
          personalizationInstruction += ` The feedback should be appropriate for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationInstruction += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the feedback if relevant.`;
        }
        if (profileData.subjects_of_interest && (profileData.subjects_of_interest as string[]).length > 0) {
          personalizationInstruction += ` If possible, relate the feedback to topics like ${(profileData.subjects_of_interest as string[]).join(", ")}.`;
        }
      }
    }
  } catch (e) { /* Ignore personalization errors */ }

  let prompt = `You are an expert writing tutor, Nova. A student has provided a piece of text from their essay and requests feedback.${personalizationInstruction}

Student's essay topic (if known): "${essayTopic || "Not specified"}"
Type of essay (if known): "${essayType || "Not specified"}"

The student is looking for feedback specifically in the following areas: ${feedbackTypes.join(", ")}.

Please analyze the following text carefully:
---BEGIN STUDENT TEXT---
${paragraphText}
---END STUDENT TEXT---

Provide constructive feedback based *only* on the selected areas.
For each piece of feedback:
1. Clearly state the area of feedback (e.g., "Grammar", "Clarity", "Argument Strength").
2. Explain the issue or your observation.
3. If possible, quote the specific part of the student's text your feedback refers to.
4. If appropriate, offer a concrete suggestion for improvement or a revised phrasing.

IMPORTANT: Your response MUST be a single, valid JSON object with NO additional text or explanations before or after it.
The JSON object must have this exact structure:
{
  "feedback": [
    {
      "id": "fb1",
      "area": "Grammar",
      "comment": "The subject-verb agreement is incorrect. 'Many student' should be 'Many students'.",
      "originalText": "Many student finds it hard to focus.",
      "suggestion": "Many students find it hard to focus."
    }
  ]
}

Each feedback object in the array MUST have these exact fields:
- "id": A unique string identifier (e.g., "fb1", "fb2")
- "area": The specific area of feedback (e.g., "Grammar", "Clarity", "Argument Strength")
- "comment": Your detailed feedback comment
- "originalText": (Optional) The specific text segment being commented on
- "suggestion": (Optional) A suggested rewrite or improvement

DO NOT include any text, notes, or explanations outside of this JSON object.
DO NOT include any personalization notes or subject-related comments.
Your entire response should be ONLY the JSON object, nothing else.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Larger model for better analysis
      temperature: 0.3,        // Lower temperature for more focused feedback
      max_tokens: 1500,        // Allow enough tokens for detailed feedback
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) {
      return { success: false, error: "AI did not return any feedback." };
    }

    // Attempt to parse the JSON
    let parsedFeedback: { feedback: FeedbackPoint[] } | null = null;
    try {
      // Clean up the response by removing any control characters
      const cleanResponse = rawResponse
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .trim();

      // Find the first complete JSON object
      const firstBraceIndex = cleanResponse.indexOf('{');
      const lastBraceIndex = cleanResponse.lastIndexOf('}');
      
      if (firstBraceIndex === -1 || lastBraceIndex === -1) {
        throw new Error("No valid JSON object found in response");
      }

      // Extract just the JSON object, ignoring any text after it
      const jsonString = cleanResponse.substring(firstBraceIndex, lastBraceIndex + 1);
      
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.feedback && Array.isArray(parsed.feedback)) {
          parsedFeedback = parsed;
        } else {
          throw new Error("JSON object does not contain a valid feedback array");
        }
      } catch (parseError) {
        console.error("Failed to parse extracted JSON:", parseError);
        throw new Error("Invalid JSON structure in response");
      }

    } catch (parseError: any) {
      console.error("Failed to parse JSON feedback from AI:", parseError.message);
      console.error("Raw AI response for feedback:", rawResponse);
      return { success: false, error: "AI returned an invalid feedback format. Raw response logged on server." };
    }

    if (!parsedFeedback || !parsedFeedback.feedback || !Array.isArray(parsedFeedback.feedback)) {
      console.error("Parsed JSON does not match expected feedback structure. Parsed:", parsedFeedback);
      return { success: false, error: "AI returned data that doesn't match the feedback structure." };
    }

    // Validate structure of each feedback point
    const isValidFeedback = parsedFeedback.feedback.every(point =>
      typeof point.id === 'string' &&
      typeof point.area === 'string' &&
      typeof point.comment === 'string' &&
      (point.originalText === undefined || typeof point.originalText === 'string') &&
      (point.suggestion === undefined || typeof point.suggestion === 'string')
    );

    if (!isValidFeedback) {
      console.error("One or more feedback points have an invalid structure. Parsed:", parsedFeedback.feedback);
      return { success: false, error: "AI feedback has malformed points." };
    }

    return { success: true, feedback: parsedFeedback.feedback };

  } catch (error: any) {
    console.error("Groq Feedback Error:", error);
    if (error instanceof Groq.APIError) {
      return { success: false, error: `AI feedback generation failed: ${error.status} ${error.message}` };
    }
    return { success: false, error: "AI feedback generation encountered an unexpected issue." };
  }
}