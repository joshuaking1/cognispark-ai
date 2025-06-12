// src/app/actions/essayActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server"; // For potential auth

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey)
  console.error("CRITICAL: GROQ_API_KEY for essay actions is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

interface BrainstormResult {
  success: boolean;
  ideas?: string[];
  error?: string;
}

interface OutlineSection {
  // Ensure this interface matches what you ask the LLM for
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
  if (!topic.trim())
    return { success: false, error: "Essay topic is required." };

  // Personalization: Fetch user profile
  let personalizationInstruction = "";
  try {
    const supabase = createSupabaseServerActionClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("grade_level, subjects_of_interest, date_of_birth, full_name")
        .eq("id", user.id)
        .single();
      if (profileData) {
        if (profileData.full_name) {
          personalizationInstruction += ` The student's name is ${profileData.full_name}.`;
        }
        if (
          profileData.grade_level &&
          profileData.grade_level !== "Not Specified"
        ) {
          personalizationInstruction += ` The ideas should be appropriate for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationInstruction += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the ideas if relevant.`;
        }
        if (
          profileData.subjects_of_interest &&
          (profileData.subjects_of_interest as string[]).length > 0
        ) {
          personalizationInstruction += ` If possible, relate the ideas to topics like ${(
            profileData.subjects_of_interest as string[]
          ).join(", ")}.`;
        }
      }
    }
  } catch (e) {
    /* Ignore personalization errors */
  }
  // Add current time and timezone
  const now = new Date();
  const timeString = now.toLocaleString();
  personalizationInstruction += ` Current time: ${timeString}.`;

  let prompt = `Brainstorm a list of diverse ideas and potential arguments for an essay on the topic: "${topic}".${personalizationInstruction}`;
  if (essayType) prompt += ` The essay is intended to be ${essayType}.`;
  if (userKeyPoints)
    prompt += ` Consider these user-provided key points or themes: "${userKeyPoints}".`;
  prompt +=
    "\n\nProvide a list of 5-7 distinct ideas or discussion points. Each idea should be a short phrase or sentence. Output as a simple list, each idea on a new line, without numbering or bullet points initially (we will parse it that way).";

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192", // Mixtral might be good for creative brainstorming too
      temperature: 0.7, // Higher temperature for more diverse ideas
      max_tokens: 300,
    });

    const rawIdeas = completion.choices[0]?.message?.content?.trim();
    if (!rawIdeas)
      return {
        success: false,
        error: "AI could not generate brainstorming ideas.",
      };

    // Split by newline and filter out empty lines
    const ideas = rawIdeas
      .split("\n")
      .map((idea) => idea.trim())
      .filter((idea) => idea.length > 0);

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
  if (!topic.trim())
    return { success: false, error: "Essay topic is required." };

  // Personalization: Fetch user profile
  let personalizationInstruction = "";
  try {
    const supabase = createSupabaseServerActionClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("grade_level, subjects_of_interest, date_of_birth, full_name")
        .eq("id", user.id)
        .single();
      if (profileData) {
        if (profileData.full_name) {
          personalizationInstruction += ` The student's name is ${profileData.full_name}.`;
        }
        if (
          profileData.grade_level &&
          profileData.grade_level !== "Not Specified"
        ) {
          personalizationInstruction += ` The outline should be appropriate for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationInstruction += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the outline if relevant.`;
        }
        if (
          profileData.subjects_of_interest &&
          (profileData.subjects_of_interest as string[]).length > 0
        ) {
          personalizationInstruction += ` If possible, relate the outline to topics like ${(
            profileData.subjects_of_interest as string[]
          ).join(", ")}.`;
        }
      }
    }
  } catch (e) {
    /* Ignore personalization errors */
  }
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
      temperature: 0.3, // Lower temperature for more predictable, structured output
      max_tokens: 1500, // Allow enough tokens for a detailed JSON outline
      // response_format: { type: "json_object" }, // If Groq/model supports this, it's ideal! Check Groq docs.
      // For now, we'll parse assuming it follows the text prompt.
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse) {
      return {
        success: false,
        error: "AI did not return any content for the outline.",
      };
    }

    // Attempt to parse the JSON
    let parsedOutline: { outline: OutlineSection[] } | null = null;
    try {
      // Sometimes LLMs might still wrap the JSON in markdown ```json ... ```
      const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStringToParse = jsonMatch ? jsonMatch[1] : rawResponse;
      parsedOutline = JSON.parse(jsonStringToParse);
    } catch (parseError: any) {
      console.error(
        "Failed to parse JSON outline from AI:",
        parseError.message
      );
      console.error("Raw AI response for outline:", rawResponse); // Log the raw response for debugging
      return {
        success: false,
        error:
          "AI returned an invalid outline format. Raw response logged on server.",
      };
    }

    if (
      !parsedOutline ||
      !parsedOutline.outline ||
      !Array.isArray(parsedOutline.outline)
    ) {
      console.error(
        "Parsed JSON does not match expected outline structure. Parsed:",
        parsedOutline
      );
      return {
        success: false,
        error: "AI returned data that doesn't match the outline structure.",
      };
    }

    // Validate structure of each section (optional but good)
    const isValidOutline = parsedOutline.outline.every(
      (section) =>
        typeof section.id === "string" &&
        typeof section.title === "string" &&
        Array.isArray(section.points) &&
        section.points.every((point) => typeof point === "string")
    );

    if (!isValidOutline) {
      console.error(
        "One or more sections in the outline have an invalid structure. Parsed:",
        parsedOutline.outline
      );
      return { success: false, error: "AI outline has malformed sections." };
    }

    return { success: true, outline: parsedOutline.outline };
  } catch (error: any) {
    console.error("Groq Outline Error (JSON attempt):", error);
    if (error instanceof Groq.APIError) {
      return {
        success: false,
        error: `AI outline generation failed: ${error.status} ${error.message}`,
      };
    }
    return {
      success: false,
      error: "AI outline generation encountered an unexpected issue.",
    };
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
  if (!paragraphText.trim())
    return { success: false, error: "Paragraph text is required." };
  if (feedbackTypes.length === 0)
    return {
      success: false,
      error: "At least one feedback type must be selected.",
    };

  // Personalization: Fetch user profile
  let personalizationContext = "";
  try {
    const supabase = createSupabaseServerActionClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("grade_level, subjects_of_interest, date_of_birth, full_name")
        .eq("id", user.id)
        .single();
      if (profileData) {
        if (profileData.full_name) {
          personalizationContext += ` The student's name is ${profileData.full_name}.`;
        }
        if (
          profileData.grade_level &&
          profileData.grade_level !== "Not Specified"
        ) {
          personalizationContext += ` The feedback should be appropriate for a ${profileData.grade_level} student.`;
        }
        if (profileData.date_of_birth) {
          personalizationContext += ` The student was born on ${profileData.date_of_birth}. Use this to further tailor the feedback if relevant.`;
        }
        if (
          profileData.subjects_of_interest &&
          (profileData.subjects_of_interest as string[]).length > 0
        ) {
          personalizationContext += ` If possible, relate the feedback to topics like ${(
            profileData.subjects_of_interest as string[]
          ).join(", ")}.`;
        }
      }
    }
  } catch (e) {
    /* Ignore personalization errors */
  }

  // Updated feedback categories to match the new granular system
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

  const selectedFeedbackLabels = feedbackTypes
    .map((id) => {
      const category = feedbackCategories.find((cat) => cat.id === id);
      return category ? category.label : id.replace(/_/g, " ");
    })
    .join(", ");

  let mainInstruction = "";
  let focusTextInstruction = "";

  if (selectedTextSnippet && selectedTextSnippet.trim() !== "") {
    focusTextInstruction = `
The student has SPECIFICALLY HIGHLIGHTED the following text segment for focused feedback:
---BEGIN HIGHLIGHTED TEXT---
${selectedTextSnippet.trim()}
---END HIGHLIGHTED TEXT---

For any feedback categories that are selection-focused (e.g., "Grammar & Spelling (for selection)", "Word Choice & Vocabulary (for selection)"), your feedback MUST primarily address this highlighted segment. Quote this segment in your 'original_text_segment' field for such feedback.
`;
    mainInstruction = `Please analyze the ENTIRE paragraph text provided below first for any selected "Overall" feedback categories. THEN, provide very focused feedback on the HIGHLIGHTED TEXT segment based on the selection-focused categories chosen by the student.`;
  } else {
    mainInstruction = `Please analyze the ENTIRE paragraph text provided below based on all the selected feedback categories.`;
  }

  const prompt = `You are Nova Pro, an expert writing tutor. A student requests feedback on a piece of their writing.

Student's essay topic (if known): "${essayTopic || "Not specified"}"
Type of essay (if known): "${essayType || "Not specified"}"
${personalizationContext}

The student is looking for feedback specifically in the following areas: ${selectedFeedbackLabels}.

${mainInstruction}
${focusTextInstruction}

---BEGIN FULL PARAGRAPH TEXT---
${paragraphText}
---END FULL PARAGRAPH TEXT---

Provide constructive feedback. For each piece of feedback:
1. Accurately state the "area" of feedback, matching one of the student's selected focus areas (e.g., "Grammar & Spelling (for selection)", "Overall Clarity & Conciseness").
2. Explain the issue or your observation clearly and constructively.
3. If your feedback pertains to a specific part of the text (either the highlighted selection or another part of the paragraph), quote that part accurately in the "original_text_segment" field.
4. If appropriate, offer a concrete "suggested_revision" as an example for improvement.

Structure your entire response as a single JSON array of feedback objects. Each object MUST have these keys:
- "area": string (matching a requested feedback area)
- "comment": string (your detailed feedback)
- "original_text_segment": string (optional, the exact segment from student's text)
- "suggested_revision": string (optional, a concrete suggestion)

Prioritize providing distinct, actionable feedback points for each selected category. If multiple issues are found for one category, you can provide multiple feedback objects for that same 'area'.

If feedback is specifically for the highlighted text, ensure 'original_text_segment' contains that highlighted text.

Generate the JSON array now.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Larger model for better analysis and granular feedback
      temperature: 0.4, // Balanced temperature for focused yet nuanced feedback
      max_tokens: 2500, // Increased tokens for more detailed granular feedback
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
      const arrayStartIndex = rawResponse.indexOf("[");
      if (arrayStartIndex !== -1) {
        jsonStringToParse = rawResponse.substring(arrayStartIndex);
      } else {
        // Try to find a JSON object that contains a feedback array
        const firstBraceIndex = rawResponse.indexOf("{");
        const lastBraceIndex = rawResponse.lastIndexOf("}");

        if (firstBraceIndex === -1 || lastBraceIndex === -1) {
          console.error(
            "No valid JSON structure found in AI response:",
            rawResponse
          );
          throw new Error(
            "AI response does not appear to contain valid JSON structure for feedback."
          );
        }

        jsonStringToParse = rawResponse.substring(
          firstBraceIndex,
          lastBraceIndex + 1
        );
      }
    }

    try {
      // Try parsing as an array first
      let parsedFeedback;
      if (jsonStringToParse.trim().startsWith("[")) {
        // Direct array format
        parsedFeedback = JSON.parse(
          jsonStringToParse
        ) as FeedbackPointForServer[];
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
      if (!parsedFeedback.every((item) => item.area && item.comment)) {
        console.error(
          "Parsed feedback is not a valid array of FeedbackPoint objects:",
          parsedFeedback
        );
        throw new Error("AI returned feedback in an unexpected structure.");
      }

      // Add IDs if they don't exist
      const feedbackWithIds = parsedFeedback.map((item, index) => ({
        ...item,
        id: item.id || `fb-${Date.now()}-${index}`,
      }));

      return { success: true, feedback: feedbackWithIds };
    } catch (error: any) {
      console.error("Failed to parse JSON feedback from AI:", error.message);
      console.error("Raw AI response for feedback:", rawResponse);
      return {
        success: false,
        error: `AI feedback generation failed: ${error.message}`,
      };
    }
  } catch (error: any) {
    console.error("Groq Granular Feedback Error:", error);
    return {
      success: false,
      error: `AI feedback generation failed: ${error.message}`,
    };
  }
}
