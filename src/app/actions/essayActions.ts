// src/app/actions/essayActions.ts
"use server";

import Groq from "groq-sdk";
import { createSupabaseServerActionClient } from "@/lib/supabase/server"; // For potential auth

const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey)
  console.error("CRITICAL: GROQ_API_KEY for essay actions is not set.");
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

// Helper function to verify user is authenticated
async function verifyUser() {
  try {
    const supabase = createSupabaseServerActionClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) return { user: null, error: "Authentication failed" };
    return { user, error: null };
  } catch (e) {
    return { user: null, error: "Authentication check failed" };
  }
}

// Helper function to verify teacher role
async function verifyTeacher() {
  try {
    const { user, error } = await verifyUser();
    if (error || !user) return { user: null, error: "Authentication failed" };

    const supabase = createSupabaseServerActionClient();
    const { data, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (roleError) return { user: null, error: "Role verification failed" };
    if (data?.role !== "teacher")
      return { user: null, error: "Teacher role required" };

    return { user, error: null };
  } catch (e) {
    return { user: null, error: "Teacher verification failed" };
  }
}

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
  id?: string;
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
// Shared feedback categories with client
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

export async function getParagraphFeedbackAction(
  paragraphText: string,
  feedbackTypes: string[], // Array of category IDs like "grammar_spelling_selection"
  selectedTextSnippet?: string, // The highlighted text
  essayTopic?: string,
  essayType?: string
): Promise<FeedbackResult> {
  const authCheck = await verifyTeacher();
  if (authCheck.error || !authCheck.user)
    return { success: false, error: authCheck.error };
  if (!groq) return { success: false, error: "AI Service not configured." };
  if (!paragraphText.trim())
    return { success: false, error: "Paragraph text is required." };
  if (feedbackTypes.length === 0)
    return {
      success: false,
      error: "At least one feedback type must be selected.",
    };

  const supabase = createSupabaseServerActionClient(); // For profile fetching
  const { data: profileData } = await supabase
    .from("profiles")
    .select("grade_level")
    .eq("id", authCheck.user.id)
    .single();

  const personalizationContext =
    profileData?.grade_level && profileData.grade_level !== "Not Specified"
      ? `The student providing this text is in ${profileData.grade_level}. Tailor your feedback complexity and examples accordingly.`
      : "The student is likely high school level. Tailor your feedback complexity and examples accordingly.";

  const selectedFeedbackLabels = feedbackTypes
    .map((id) => {
      const category = feedbackCategories.find((cat) => cat.id === id);
      return category
        ? category.label
        : id.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    })
    .join(", ");

  let focusInstruction = "";
  let mainAnalysisInstruction = `Please analyze the ENTIRE paragraph text provided below based on all the selected feedback categories: ${selectedFeedbackLabels}.`;

  if (selectedTextSnippet && selectedTextSnippet.trim() !== "") {
    focusInstruction = `
The student has also SPECIFICALLY HIGHLIGHTED the following text segment for focused feedback:
---BEGIN HIGHLIGHTED TEXT---
${selectedTextSnippet.trim()}
---END HIGHLIGHTED TEXT---
For any feedback categories that explicitly mention "(for selection)" or seem most relevant to a specific phrase (like "Word Choice", "Sentence Structure", "Passive Voice Usage"), your feedback MUST primarily address this HIGHLIGHTED segment.
When providing feedback on this highlighted segment:
- Accurately quote this segment in the "original_text_segment" field of your JSON response.
- Make it clear in your "comment" that this particular piece of feedback refers to their selection.`;

    mainAnalysisInstruction = `First, provide any feedback relevant to the ENTIRE paragraph for categories like "Overall Clarity & Conciseness", "Overall Argument Strength", "Overall Flow & Cohesion", "Overall Style & Tone Consistency" if they were selected.
After addressing the overall paragraph, THEN provide focused feedback on the HIGHLIGHTED TEXT segment based on the other selected feedback categories (especially those for selections like "Grammar & Spelling (for selection)", "Word Choice (for selection)", etc.).`;
  }

  const prompt = `You are Nova Pro, an expert and meticulous writing instructor AI. A student requests feedback on their writing.
Student's essay topic (if known): "${essayTopic || "Not specified"}"
Type of essay (if known): "${essayType || "Not specified"}"
${personalizationContext}
${mainAnalysisInstruction}
${focusInstruction}
---BEGIN FULL PARAGRAPH TEXT---
${paragraphText}
---END FULL PARAGRAPH TEXT---
Provide constructive, specific, and actionable feedback.
For each distinct piece of feedback:
1.  State the "area" of feedback, matching one of the student's selected focus areas (e.g., "Grammar & Spelling (for selection)", "Overall Clarity & Conciseness", "Word Choice & Vocabulary (for selection)").
2.  Explain the issue or your observation clearly and constructively.
3.  If your feedback pertains to a specific part of the text (either the highlighted selection OR another part of the paragraph if doing overall review), quote that part accurately in the "original_text_segment" field.
4.  If appropriate, offer a concrete "suggested_revision" as an example for improvement.
Structure your entire response as a single JSON array of feedback objects. Each object in the array represents one distinct piece of feedback and MUST have these keys:
- "area": string (The feedback category. If feedback applies to the HIGHLIGHTED text, try to use a category name that implies selection focus if one was chosen by the user, e.g., "Word Choice (for selection)").
- "comment": string (Your detailed feedback).
- "original_text_segment": string (Optional but highly encouraged, the exact segment from student's text this feedback refers to. For HIGHLIGHTED text, this MUST be the highlighted text).
- "suggested_revision": string (Optional, a concrete suggestion).
Ensure your feedback is polite and tailored to a student audience. Generate several distinct feedback points covering the requested areas and the highlighted text if provided. The entire response must be ONLY the JSON array.
`;

  try {
    // console.log("Sending to Groq for essay feedback. Prompt snippet:", prompt.substring(0, 500)); // For debugging prompt
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192",
      temperature: 0.4,
      max_tokens: 2000, // Allow for detailed feedback
    });

    const rawResponse = completion.choices[0]?.message?.content?.trim();
    if (!rawResponse)
      return { success: false, error: "AI did not return any feedback." };

    // Enhanced JSON parsing logic for an array of FeedbackPointForServer
    let jsonStringToParse = "";

    try {
      // First check if the response is wrapped in markdown code blocks
      const markdownJsonMatch = rawResponse.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/
      );
      if (markdownJsonMatch && markdownJsonMatch[1]) {
        // Extract content from code block
        jsonStringToParse = markdownJsonMatch[1].trim();
      } else if (
        rawResponse.includes("Here is the feedback") ||
        rawResponse.includes("JSON array format")
      ) {
        // Handle case where AI adds a preamble like "Here is the feedback in the requested JSON array format:"
        // Find the start of the JSON array
        const arrayStartIndex = rawResponse.indexOf("[");
        if (arrayStartIndex !== -1) {
          // Find the matching closing bracket
          let depth = 0;
          let arrayEndIndex = -1;

          for (let i = arrayStartIndex; i < rawResponse.length; i++) {
            if (rawResponse[i] === "[") depth++;
            else if (rawResponse[i] === "]") {
              depth--;
              if (depth === 0) {
                arrayEndIndex = i;
                break;
              }
            }
          }

          if (arrayEndIndex > arrayStartIndex) {
            jsonStringToParse = rawResponse.substring(
              arrayStartIndex,
              arrayEndIndex + 1
            );
          } else {
            throw new Error(
              "Could not find matching closing bracket for JSON array"
            );
          }
        } else {
          throw new Error("Could not locate JSON array start in AI response");
        }
      } else {
        // Just try to parse the whole response as JSON
        jsonStringToParse = rawResponse;
      }

      // Try to parse the extracted JSON
      const parsedFeedback = JSON.parse(
        jsonStringToParse
      ) as FeedbackPointForServer[];

      // Validate the structure
      if (!Array.isArray(parsedFeedback)) {
        throw new Error("Parsed result is not an array");
      }

      if (
        parsedFeedback.length > 0 &&
        !parsedFeedback.every((item) => item.area && item.comment)
      ) {
        throw new Error(
          "One or more feedback items are missing required fields"
        );
      }

      return { success: true, feedback: parsedFeedback };
    } catch (parseError: any) {
      console.error(
        "Failed to parse JSON feedback from AI:",
        parseError.message
      );
      console.error("Raw AI response for feedback:", rawResponse);
      console.error("Attempted to parse:", jsonStringToParse);

      // Try one more approach - look for array brackets and extract just that part
      try {
        const arrayStartIndex = rawResponse.indexOf("[");
        const arrayEndIndex = rawResponse.lastIndexOf("]");

        if (arrayStartIndex !== -1 && arrayEndIndex > arrayStartIndex) {
          const extractedJson = rawResponse.substring(
            arrayStartIndex,
            arrayEndIndex + 1
          );
          const parsedFeedback = JSON.parse(
            extractedJson
          ) as FeedbackPointForServer[];

          if (
            Array.isArray(parsedFeedback) &&
            parsedFeedback.length > 0 &&
            parsedFeedback.every((item) => item.area && item.comment)
          ) {
            return { success: true, feedback: parsedFeedback };
          }
        }
      } catch (fallbackError) {
        // Fallback failed, continue to error return
      }

      return {
        success: false,
        error: `AI feedback generation failed: ${parseError.message}`,
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

// --- Thesis Statement Analysis Action ---
interface ThesisAnalysisResult {
  success: boolean;
  feedback?: string; // Markdown formatted feedback
  error?: string;
}

export async function analyzeThesisAction(
  thesisStatement: string,
  essayTopic?: string, // Context
  essayType?: string // Context
): Promise<ThesisAnalysisResult> {
  if (!groq) return { success: false, error: "AI Service not configured." };
  if (!thesisStatement.trim())
    return { success: false, error: "Thesis statement is required." };

  // Personalization: Fetch user profile for grade level
  let gradeContext = "for a high school student";
  try {
    const supabase = createSupabaseServerActionClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!authError && user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("grade_level")
        .eq("id", user.id)
        .single();

      if (
        profileData?.grade_level &&
        profileData.grade_level !== "Not Specified"
      ) {
        gradeContext = `for a ${profileData.grade_level} student`;
      }
    }
  } catch (e) {
    /* Ignore personalization errors */
  }

  const prompt = `You are Nova Pro, an expert writing instructor. Analyze the following thesis statement ${gradeContext}.

Essay Topic (if known): "${essayTopic || "Not specified"}"
Type of Essay (if known): "${essayType || "Not specified"}"

Thesis Statement to Analyze:
"${thesisStatement}"

Please provide feedback on the thesis statement, considering the following aspects:
1. **Clarity:** Is the thesis clear and easy to understand?
2. **Arguability/Assertiveness:** Does it make a specific claim or argument, rather than just stating a fact or topic?
3. **Specificity & Scope:** Is it focused enough for a typical essay on this topic, or is it too broad or too narrow?
4. **Strength:** How effective is it as a guiding statement for an essay?
5. **(Optional) Originality/Insightfulness:** Does it offer a fresh perspective (if applicable)?

Provide your feedback as a well-structured Markdown text. Use headings for each aspect you evaluate (e.g., "### Clarity", "### Arguability"). Offer specific examples or suggestions for improvement if weaknesses are identified. Keep the tone constructive and supportive.

End with a "### Summary" section that provides an overall assessment and 1-2 concrete suggestions for improvement.
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-70b-8192", // Larger model for better analysis
      temperature: 0.3, // Lower temperature for more focused, analytical feedback
      max_tokens: 1500, // Allow for detailed feedback
    });

    const feedback = completion.choices[0]?.message?.content?.trim();
    if (!feedback)
      return {
        success: false,
        error: "AI did not return any feedback for the thesis.",
      };

    return { success: true, feedback };
  } catch (error: any) {
    console.error("Groq Thesis Analysis Error:", error);
    return {
      success: false,
      error: `AI thesis analysis failed: ${error.message}`,
    };
  }
}
