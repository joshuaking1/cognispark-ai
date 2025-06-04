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

// Ensure FeedbackPointForServer matches the client's FeedbackPoint for structure expected from AI
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
  original_text_segment?: string;
  suggested_revision?: string;
  applies_to_selection?: boolean;
}

interface FeedbackResult {
  success: boolean;
  feedback?: FeedbackPointForServer[];
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
  selectedTextSnippet?: string, // NEW: Specific text snippet for focused feedback
  essayTopic?: string,
  essayType?: string
): Promise<FeedbackResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };
  if (!paragraphText.trim()) return { success: false, error: "Paragraph text is required." };
  if (feedbackTypes.length === 0) return { success: false, error: "At least one feedback type must be selected." };

  // Personalization: Fetch user profile
  let personalizationContext = "";
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
          personalizationContext += ` The student's name is ${profileData.full_name}.`;
        }
        if (profileData.grade_level && profileData.grade_level !== "Not Specified") {
          personalizationContext += ` The feedback should be appropriate for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationContext += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the feedback if relevant.`;
        }
        if (profileData.subjects_of_interest && (profileData.subjects_of_interest as string[]).length > 0) {
          personalizationContext += ` If possible, relate the feedback to topics like ${(profileData.subjects_of_interest as string[]).join(", ")}.`;
        }
      }
    }
  } catch (e) { /* Ignore personalization errors */ }

  // Add focused instruction for selected text snippet
  let focusInstruction = "";
  if (selectedTextSnippet && selectedTextSnippet.trim() !== "") {
    focusInstruction = `The student has also highlighted the following specific text segment for focused feedback: "${selectedTextSnippet.trim()}". Please ensure some of your feedback directly addresses this selection if relevant to the chosen feedback types. Clearly indicate when feedback pertains to this specific selection by quoting it in 'original_text_segment' or mentioning 'your selection' in the 'comment'.`;
  }

  // Map feedback type IDs to more descriptive labels
  const feedbackCategories = [
    { id: "overall_clarity", label: "Overall Clarity & Conciseness" },
    { id: "grammar_spelling", label: "Grammar & Spelling" },
    { id: "argument_strength", label: "Argument Strength & Support" },
    { id: "style_tone", label: "Style & Tone Consistency" },
    { id: "flow_cohesion", label: "Flow & Cohesion (Transitions)" },
    { id: "word_choice", label: "Word Choice & Vocabulary" },
    { id: "sentence_structure", label: "Sentence Structure & Variety" },
    { id: "passive_voice", label: "Passive Voice Usage" },
  ];

  const feedbackAreasString = feedbackTypes.map(type => {
    // Map type.id to more descriptive phrases for the AI
    const typeObj = feedbackCategories.find(ft => ft.id === type);
    return typeObj ? typeObj.label : type.replace(/_/g, ' ');
  }).join(", ");

  let prompt = `You are Nova, an expert writing tutor. A student requests feedback on a piece of their writing.
Student's essay topic (if known): "${essayTopic || "Not specified"}"
Type of essay (if known): "${essayType || "Not specified"}"
${personalizationContext}

The student is looking for feedback specifically in the following areas: ${feedbackAreasString}.
${focusInstruction}

Please analyze the following text carefully:
---BEGIN STUDENT TEXT---
${paragraphText}
---END STUDENT TEXT---

Provide constructive feedback. For each piece of feedback:
1. State the area of feedback (e.g., "Grammar & Spelling", "Clarity & Conciseness", "Word Choice", "Sentence Structure", "Passive Voice Usage", "Argument Strength", "Flow & Cohesion", "Style & Tone").
2. Explain the issue or your observation clearly.
3. If your feedback pertains to a specific part of the text, quote that 'original_text_segment'. If it specifically addresses the student's highlighted selection, make that clear in your comment or by accurately quoting their selection.
4. If appropriate, offer a 'suggested_revision' as a concrete example for improvement.

Structure your entire response as a single JSON array of feedback objects. Each object in the array represents one distinct piece of feedback and MUST have these keys:
- "area": A string matching one of the requested feedback areas or a general "Suggestion".
- "comment": Your detailed feedback or observation (string).
- "original_text_segment": (Optional) The exact segment from the student's text this feedback refers to (string).
- "suggested_revision": (Optional) A suggested alternative phrasing or correction (string).

Example of a feedback object:
{
  "area": "Clarity & Conciseness",
  "comment": "This sentence is a bit long and could be more direct. The use of 'in order to' can often be shortened.",
  "original_text_segment": "The character decided to go to the store in order to buy some milk.",
  "suggested_revision": "The character went to the store to buy milk."
}

Ensure your feedback is constructive, polite, and tailored to a student audience. Generate several distinct feedback points covering the requested areas. The entire response must be ONLY the JSON array.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Larger model for better analysis
      temperature: 0.4,        // Slightly lower for more focused feedback
      max_tokens: 1800,        // Allow for more detailed feedback points
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    // For brevity, assuming the robust JSON parsing logic is here:
    if (!rawResponse) throw new Error("AI returned no feedback content.");
    
    let jsonStringToParse = rawResponse;
    const markdownJsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (markdownJsonMatch && markdownJsonMatch[1]) {
      jsonStringToParse = markdownJsonMatch[1].trim();
    } else {
      // Check if the response starts with an array directly
      const arrayStartIndex = rawResponse.indexOf('[');
      if (arrayStartIndex !== -1) {
        jsonStringToParse = rawResponse.substring(arrayStartIndex);
      } else {
        // Try to find a JSON object that contains a feedback array
        const firstBraceIndex = rawResponse.indexOf('{');
        const lastBraceIndex = rawResponse.lastIndexOf('}');
        
        if (firstBraceIndex === -1 || lastBraceIndex === -1) {
          console.error("No valid JSON structure found in AI response:", rawResponse);
          throw new Error("AI response does not appear to contain valid JSON structure for feedback.");
        }
        
        jsonStringToParse = rawResponse.substring(firstBraceIndex, lastBraceIndex + 1);
      }
    }
    
    try {
      // Try parsing as an array first
      let parsedFeedback;
      if (jsonStringToParse.trim().startsWith('[')) {
        // Direct array format
        parsedFeedback = JSON.parse(jsonStringToParse) as FeedbackPointForServer[];
      } else {
        // Object with feedback array property
        const parsed = JSON.parse(jsonStringToParse);
        if (parsed.feedback && Array.isArray(parsed.feedback)) {
          parsedFeedback = parsed.feedback;
        } else {
          throw new Error("JSON does not contain a valid feedback array");
        }
      }
      
      // Validate the structure
      if (!Array.isArray(parsedFeedback) || parsedFeedback.length === 0) {
        throw new Error("Parsed feedback is not a valid array or is empty");
      }
      
      // Check each feedback item has required fields
      if (!parsedFeedback.every(item => item.area && item.comment)) {
        console.error("Parsed feedback is not a valid array of FeedbackPoint objects:", parsedFeedback);
        throw new Error("AI returned feedback in an unexpected structure.");
      }
      
      // Add IDs if they don't exist
      const feedbackWithIds = parsedFeedback.map((item, index) => ({
        ...item,
        id: item.id || `fb-${Date.now()}-${index}`
      }));
      
      return { success: true, feedback: feedbackWithIds };
      
    } catch (error: any) {
      console.error("Failed to parse JSON feedback from AI:", error.message);
      console.error("Raw AI response for feedback:", rawResponse);
      return { success: false, error: `AI feedback generation failed: ${error.message}` };
    }

  } catch (error: any) {
    console.error("Groq Granular Feedback Error:", error);
    return { success: false, error: `AI feedback generation failed: ${error.message}` };
  }
}